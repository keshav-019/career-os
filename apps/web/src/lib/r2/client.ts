import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-compatible) client, used for: resume file storage (lib/resumeStorage.ts - raw PDF/DOCX bytes
 * plus, for LaTeX resumes, the compiled PDF alongside the .tex source) and Learning Center content (lib/learning/*
 * - JSON + images, replacing what used to be bundled into every app/web/electron build).
 *
 * R2 buckets are private by default (no public bucket URL configured for this project), so every read goes
 * through a short-lived presigned GET URL rather than a permanent public link - this matters most for resumes,
 * which contain personal data and must never be reachable without the app generating the link on the user's
 * behalf. Learning content uses the same mechanism for consistency, even though it isn't sensitive.
 */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
const R2_ENDPOINT = process.env.R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
// learningAssetUrl() (lib/learning/asset-url.ts) calls r2PublicUrl() from both server code and plain "use client"
// components (e.g. app/interview-prep/page.tsx, app/learning/page.tsx render figure/card images straight from
// client-side state) - process.env.R2_PUBLIC_BASE_URL alone would be stripped from the client bundle since it
// isn't NEXT_PUBLIC_-prefixed, so we fall back to a NEXT_PUBLIC_ mirror. The bucket's R2.dev URL is a public,
// non-secret value (public read access is what makes it useful here), so inlining it into client JS is fine.
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || "";

/** Resolves a bucket key to a permanent public URL via the bucket's R2.dev public access domain. Only use this
 *  for content that's fine being reachable by anyone with the URL (learning/interview content images) - never for
 *  resumes or other personal data, which must keep going through getR2SignedUrl below. */
export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_BASE_URL}/${key.replace(/^\/+/, "")}`;
}

export const isR2Configured = Boolean(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_ENDPOINT);

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (!isR2Configured) {
    throw new Error("R2 is not configured - set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.");
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
    });
  }
  return cachedClient;
}

export async function uploadToR2(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: body, ContentType: contentType })
  );
}

export async function deleteFromR2(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

/** Signed URLs default to 1 hour - long enough for a single screen load/session, short enough that a leaked URL
 *  (browser history, logs) doesn't stay valid indefinitely. Callers needing a fresh link just re-request one. */
export async function getR2SignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds });
}

/** Fetches a JSON object from R2. Used by lib/interview/*-bank.ts and lib/learning/material-library.ts to lazily
 *  load the big question-bank/learning-material JSON that used to be bundled at build time via a static
 *  `import ... from "*.json"` - see each module's ensure*Loaded() function. None of this content is sensitive
 *  (unlike resumes, which must stay on the presigned-URL path in getR2SignedUrl), so this tries the bucket's
 *  public r2.dev URL first - a plain fetch, no S3 credentials needed at all. That matters beyond just avoiding
 *  an unnecessary signed request: the desktop app's packaged build has no way to safely ship real R2 API
 *  credentials (unlike NEXT_PUBLIC_R2_PUBLIC_BASE_URL, which is public by design), so without this fallback
 *  order, every one of these lazy-loaded content banks would silently fail to load in the desktop app. Falls
 *  back to the authenticated API if the public fetch fails or no public base URL is configured. */
export async function getR2Json<T>(key: string): Promise<T> {
  if (R2_PUBLIC_BASE_URL) {
    try {
      const response = await fetch(r2PublicUrl(key));
      if (response.ok) {
        return (await response.json()) as T;
      }
    } catch {
      // Fall through to the authenticated API below.
    }
  }

  const response = await getClient().send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
  const body = await response.Body?.transformToString();
  if (!body) {
    throw new Error(`R2 object "${key}" has no body.`);
  }
  return JSON.parse(body) as T;
}

export async function listR2Objects(prefix: string): Promise<{ key: string; size: number; lastModified?: Date }[]> {
  const results: { key: string; size: number; lastModified?: Date }[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await getClient().send(
      new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, Prefix: prefix, ContinuationToken: continuationToken })
    );
    for (const item of response.Contents ?? []) {
      if (item.Key) {
        results.push({ key: item.Key, size: item.Size ?? 0, lastModified: item.LastModified });
      }
    }
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return results;
}
