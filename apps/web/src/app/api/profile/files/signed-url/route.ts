import { NextResponse } from "next/server";
import { getR2SignedUrl } from "@/lib/r2/client";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

function sanitizeR2Key(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^\/+/, "").slice(0, 1024) : "";
}

export async function POST(request: Request) {
  try {
    const verifiedAuth = await verifyRequestAuth(request.headers.get("authorization"));
    const body = (await request.json().catch(() => null)) as { r2Key?: unknown } | null;
    const r2Key = sanitizeR2Key(body?.r2Key);
    const allowedPrefix = `users/${verifiedAuth.userId}/profile/`;

    if (!r2Key || !r2Key.startsWith(allowedPrefix)) {
      return NextResponse.json({ error: "File key is not available for this account." }, { status: 403 });
    }

    const signedUrl = await getR2SignedUrl(r2Key);
    return NextResponse.json({ ok: true, signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create a file preview link.";
    const status = message.includes("Bearer") || message.includes("authentication") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
