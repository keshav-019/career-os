import { Router } from "express";
import { checkSlidingWindowRateLimit } from "@/lib/server/rate-limit";

/**
 * Server-side half of the mobile app's "Continue with GitHub" flow (see apps/mobile/src/lib/oauth.ts for the
 * client half). GitHub OAuth Apps have no public/native client type - code exchange always requires a client
 * secret, so this app can't do it alone. Google sign-in does NOT go through here: it uses a dedicated
 * Android-type OAuth client (public, PKCE, no secret) entirely client-side - see oauth.ts.
 *
 * This does NOT also mint a Firebase idToken/refreshToken - the mobile app already has the full Firebase JS SDK
 * loaded, so it signs in itself via GithubAuthProvider.credential() + signInWithCredential() once it has the
 * provider access token from /exchange below. That's the officially supported SDK path (same call
 * signInWithPopup makes internally on web) and keeps the SDK's own persistence/refresh timers in charge.
 */

const router = Router();

function readFirstEnv(...names: string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function githubCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: readFirstEnv("GITHUB_OAUTH_CLIENT_ID", "NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID"),
    clientSecret: readFirstEnv("GITHUB_OAUTH_CLIENT_SECRET")
  };
}

function clientIp(req: import("express").Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return first?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

router.get("/config", (_req, res) => {
  const { clientId, clientSecret } = githubCredentials();
  res.json({
    ok: true,
    providers: {
      github: clientId && clientSecret ? { enabled: true, clientId } : { enabled: false }
    }
  });
});

router.get("/github/callback", (req, res) => {
  const params = new URLSearchParams();
  if (typeof req.query.code === "string") params.set("code", req.query.code);
  if (typeof req.query.state === "string") params.set("state", req.query.state);
  if (typeof req.query.error === "string") params.set("error", req.query.error);
  if (typeof req.query.error_description === "string") {
    params.set("error_description", req.query.error_description);
  }
  res.redirect(`careeros://oauthredirect?${params.toString()}`);
});

router.post("/github/exchange", async (req, res) => {
  const rateLimit = checkSlidingWindowRateLimit({
    key: `oauth-exchange:${clientIp(req)}`,
    maxRequests: 20,
    windowMs: 60_000
  });
  if (!rateLimit.allowed) {
    res.set("Retry-After", String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))));
    return res.status(429).json({ ok: false, error: "Too many requests. Please retry shortly." });
  }

  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const redirectUri = typeof req.body?.redirectUri === "string" ? req.body.redirectUri.trim() : "";
  if (!code || !redirectUri) {
    return res.status(400).json({ ok: false, error: "Expected { code, redirectUri }." });
  }

  const { clientId, clientSecret } = githubCredentials();
  if (!clientId || !clientSecret) {
    return res.status(400).json({ ok: false, error: "GitHub sign-in isn't configured on this server yet." });
  }

  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      }).toString()
    });

    const payload = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      error_description?: string;
      error?: string;
    };
    if (!response.ok || !payload.access_token) {
      return res.status(400).json({
        ok: false,
        error: payload.error_description || payload.error || "GitHub rejected that sign-in attempt."
      });
    }

    res.json({ ok: true, accessToken: payload.access_token });
  } catch (error) {
    console.error("Mobile GitHub OAuth exchange failed.", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to complete sign-in." });
  }
});

export default router;
