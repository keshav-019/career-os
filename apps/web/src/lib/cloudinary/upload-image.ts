import { sanitizeExternalUrl } from "@/lib/url-safety";

export const MAX_UPLOAD_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function readCloudinaryErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Image upload failed.";
  }

  const errorRecord = (payload as { error?: unknown }).error;
  if (errorRecord && typeof errorRecord === "object") {
    const message = (errorRecord as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  return "Image upload failed.";
}

/**
 * Unsigned direct-to-Cloudinary upload, same pattern as the profile photo uploader in app/profile/page.tsx. Used by
 * the admin coding-problem editor to drop images into a problem statement - the returned URL is meant to be embedded
 * inline in text via a `[[image:<url>]]` marker (see @/lib/coding-catalog/statement-images), not stored as a
 * separate field, since a statement can contain any number of images at arbitrary positions.
 */
export async function uploadImageToCloudinary(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file.");
  }
  if (file.size > MAX_UPLOAD_IMAGE_SIZE_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "").trim();
  const uploadPreset = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "").trim();
  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Missing Cloudinary configuration. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: "POST",
    body: formData
  });
  const payload = (await response.json().catch(() => null)) as { secure_url?: unknown } | null;

  if (!response.ok || !payload) {
    throw new Error(readCloudinaryErrorMessage(payload));
  }

  const secureUrl = sanitizeExternalUrl(payload.secure_url);
  if (!secureUrl) {
    throw new Error("Cloudinary did not return a valid secure image URL.");
  }

  return secureUrl;
}
