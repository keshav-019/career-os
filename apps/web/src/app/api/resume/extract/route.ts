import { requireAuthAndRateLimit } from "@/lib/server/require-auth-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RESUME_FILE_BYTES = 12 * 1024 * 1024;

function fileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFile(formValue: FormDataEntryValue | null): File | null {
  if (typeof File === "undefined" || !(formValue instanceof File)) {
    return null;
  }

  return formValue;
}

async function extractTextFile(file: File): Promise<string> {
  return normalizeExtractedText(await file.text());
}

async function extractDocxFile(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(await file.arrayBuffer())
  });

  return normalizeExtractedText(result.value || "");
}

async function extractPdfFile(file: File): Promise<string> {
  const runtimeImport = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>;
  const pdfjs = await runtimeImport("pdfjs-dist/legacy/build/pdf.mjs");
  const documentTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableFontFace: true,
    isEvalSupported: false,
    useWorkerFetch: false
  });
  const document = await documentTask.promise;

  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .filter(Boolean)
        .join(" ");

      if (pageText.trim()) {
        pages.push(pageText);
      }

      page.cleanup();
    }

    return normalizeExtractedText(pages.join("\n\n"));
  } finally {
    await document.destroy();
  }
}

async function extractResumeText(file: File): Promise<string> {
  const extension = fileExtension(file.name);
  const mimeType = file.type.toLowerCase();

  if (mimeType.startsWith("text/") || ["latex", "md", "markdown", "tex", "txt"].includes(extension)) {
    return extractTextFile(file);
  }

  if (extension === "pdf" || mimeType === "application/pdf") {
    return extractPdfFile(file);
  }

  if (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxFile(file);
  }

  if (extension === "doc") {
    throw new Error("Legacy .doc files cannot be read reliably. Save the resume as PDF or DOCX and upload it again.");
  }

  throw new Error("Unsupported resume file. Upload a PDF, DOCX, TXT, Markdown, or LaTeX file.");
}

export async function POST(request: Request) {
  const gate = await requireAuthAndRateLimit(request, "resume-extract");
  if (!gate.ok) return gate.response;

  try {
    const formData = await request.formData();
    const file = getFile(formData.get("file"));

    if (!file) {
      return Response.json({ error: "Upload a resume file." }, { status: 400 });
    }

    if (file.size > MAX_RESUME_FILE_BYTES) {
      return Response.json({ error: "Resume file is too large. Upload a file under 12 MB." }, { status: 413 });
    }

    const text = await extractResumeText(file);
    if (!text) {
      return Response.json(
        {
          error:
            "No readable text was found in this resume. If it is a scanned PDF, export an OCR/searchable PDF and try again."
        },
        { status: 422 }
      );
    }

    return Response.json({
      characterCount: text.length,
      fileName: file.name,
      ok: true,
      text
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to extract resume text."
      },
      { status: 422 }
    );
  }
}
