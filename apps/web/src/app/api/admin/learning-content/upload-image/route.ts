import { getR2SignedUrl, uploadToR2 } from "@/lib/r2/client";
import { requireAdmin } from "@/lib/server/require-admin";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"]);

/** Uploads one Learning Center figure image to R2 (learning-admin/{categoryId}/{filename}) and returns the R2 key
 *  (stored on the topic's figure entry, see admin-content.ts) plus a short-lived signed URL for immediately
 *  previewing what was just uploaded in the admin UI. */
export async function POST(request: Request) {
  try {
    await requireAdmin(request.headers.get("authorization"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Admin access required." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const categoryId = String(formData.get("categoryId") ?? "").trim();

    if (!(file instanceof File)) {
      return Response.json({ error: "Upload an image file." }, { status: 400 });
    }
    if (!categoryId) {
      return Response.json({ error: "categoryId is required." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Image is too large. Upload a file under 8MB." }, { status: 413 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: "Unsupported image type. Use PNG, JPEG, WEBP, GIF, or SVG." }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `learning-admin/${categoryId}/${Date.now()}-${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(key, buffer, file.type);
    const previewUrl = await getR2SignedUrl(key);

    return Response.json({ ok: true, key, previewUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to upload this image." }, { status: 500 });
  }
}
