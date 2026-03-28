import { CLOUDINARY_CONFIG } from "../config/env";

/** Mirrors apps/web/src/lib/cloudinary/upload-image.ts - same unsigned-upload preset, same Cloudinary account.
 *  On mobile the "file" comes from expo-image-picker as a local file URI instead of a browser File object, so the
 *  FormData entry shape is the RN convention ({ uri, name, type }) rather than a File instance. */
export async function uploadImageUriToCloudinary(uri: string, fileName = "photo.jpg"): Promise<string> {
  const formData = new FormData();
  formData.append("file", { uri, name: fileName, type: "image/jpeg" } as unknown as Blob);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
    method: "POST",
    body: formData
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.secure_url) {
    const message = payload?.error?.message || "Image upload failed.";
    throw new Error(message);
  }

  return payload.secure_url as string;
}
