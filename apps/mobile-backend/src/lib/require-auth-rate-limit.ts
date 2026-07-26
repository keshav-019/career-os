import type { Request, Response } from "express";
import { checkSlidingWindowRateLimit } from "@/lib/server/rate-limit";
import { verifyRequestAuth, type VerifiedRequestAuth } from "@/lib/server/verify-request-auth";

/** Express equivalent of apps/web/src/lib/server/require-auth-rate-limit.ts - same shared rate-limit/auth-verify
 *  logic (both are plain framework-agnostic modules reachable via the @/* -> ../web/src/* alias), just Express
 *  req/res plumbing instead of a Next.js Request/Response. Used by ai.ts and interview.ts, which (unlike
 *  systemDesign.ts) had no auth at all until now - see the security audit for why that mattered. */
export async function requireAuthAndRateLimit(
  req: Request,
  res: Response,
  routeKey: string,
  { maxRequests = 20, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}
): Promise<VerifiedRequestAuth | null> {
  let auth: VerifiedRequestAuth;
  try {
    auth = await verifyRequestAuth((req.headers.authorization as string) ?? null);
  } catch (error) {
    res.status(401).json({ ok: false, error: error instanceof Error ? error.message : "Sign-in required." });
    return null;
  }

  const rateLimit = checkSlidingWindowRateLimit({ key: `${routeKey}:${auth.userId}`, maxRequests, windowMs });
  if (!rateLimit.allowed) {
    res.set("Retry-After", String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))));
    res.status(429).json({ ok: false, error: "Too many requests. Please retry shortly." });
    return null;
  }

  return auth;
}
