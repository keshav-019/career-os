import { checkSlidingWindowRateLimit } from "@/lib/server/rate-limit";
import { verifyRequestAuth, type VerifiedRequestAuth } from "@/lib/server/verify-request-auth";

type Gate = { auth: VerifiedRequestAuth; ok: true } | { ok: false; response: Response };

/** Shared guard for routes that only need "is this a signed-in user" plus abuse-rate protection - no ownership
 *  check beyond that (unlike routes that also scope a Firestore/R2 path to auth.userId). Used by the AI routes,
 *  resume/extract, and the profile lookup proxies, all of which were previously reachable with no auth at all. */
export async function requireAuthAndRateLimit(
  request: Request,
  routeKey: string,
  { maxRequests = 20, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}
): Promise<Gate> {
  let auth: VerifiedRequestAuth;
  try {
    auth = await verifyRequestAuth(request.headers.get("authorization"));
  } catch (error) {
    return {
      ok: false,
      response: Response.json(
        { error: error instanceof Error ? error.message : "Sign-in required." },
        { status: 401 }
      )
    };
  }

  const rateLimit = checkSlidingWindowRateLimit({
    key: `${routeKey}:${auth.userId}`,
    maxRequests,
    windowMs
  });
  if (!rateLimit.allowed) {
    return {
      ok: false,
      response: Response.json(
        { error: "Too many requests. Please retry shortly." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))) } }
      )
    };
  }

  return { auth, ok: true };
}
