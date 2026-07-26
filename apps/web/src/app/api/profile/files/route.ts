import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getR2SignedUrl, uploadToR2 } from "@/lib/r2/client";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

const MAX_PROFILE_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/markdown"
]);

function sanitizeFileName(value: string): string {
  return value
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function extensionFromFileName(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return extension.slice(0, 12);
}

function sanitizeKind(value: FormDataEntryValue | null): string {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "document"
    : "document";
}

export async function POST(request: Request) {
  try {
    const verifiedAuth = await verifyRequestAuth(request.headers.get("authorization"));
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a file." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }

    if (file.size > MAX_PROFILE_FILE_BYTES) {
      return NextResponse.json({ error: "Profile documents must be 15 MB or smaller." }, { status: 413 });
    }

    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_FILE_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF, DOC, DOCX, PNG, JPG, WEBP, TXT, or Markdown files." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const originalName = sanitizeFileName(file.name || "profile-document");
    const extension = extensionFromFileName(originalName);
    const kind = sanitizeKind(formData.get("kind"));
    const id = randomUUID();
    const r2Key = `users/${verifiedAuth.userId}/profile/${kind}/${id}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(r2Key, buffer, contentType);
    const signedUrl = await getR2SignedUrl(r2Key);

    return NextResponse.json({
      ok: true,
      file: {
        id,
        contentType,
        kind,
        name: originalName,
        r2Key,
        signedUrl,
        size: file.size,
        uploadedAt: nowIso
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload profile document.";
    const status = message.includes("Bearer") || message.includes("authentication") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
