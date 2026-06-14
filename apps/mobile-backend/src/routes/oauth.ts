import { Router } from "express";
import { checkSlidingWindowRateLimit } from "@/lib/server/rate-limit";

/**
 * Server-side half of the mobile app's "Continue with Google/GitHub" flow (see apps/mobile/src/lib/oauth.ts for
 * the client half). Mirrors apps/web/src/app/api/extension/oauth/[provider]/route.ts's reasoning: a public app
 * bundle can't safely hold a Google/GitHub OAuth client secret, so the client only ever gets an authorization
 * CODE and hands it here for the actual token exchange.
 *
 * Unlike the extension route, this does NOT also mint a Firebase idToken/refreshToken via accounts:signInWithIdp
 * - the mobile app already has the full Firebase JS SDK loaded, so it signs in itself via
 * GoogleAuthProvider.credential()/GithubAuthProvider.credential() + signInWithCredential() once it has the
 * provider access token from /exchange below. That's the officially supported SDK path (same call
 * signInWithPopup makes internally on web) and keeps the SDK's own persistence/refresh timers in charge.
 *
 * Also reuses the *same* Google/GitHub OAuth app registrations as the web app and extension (same env vars) -
 * both are "confidential" client types (Google "Web application", GitHub OAuth App) that require a secret for
 * code exchange, so mobile goes through this relay instead of registering new native OAuth clients. Google and
 * GitHub also don't allow a custom URI scheme (careeros://) as an authorized redirect for that client type, so
 * /callback below is a plain https URL that the provider redirects to, which then 302s onward to the app's
 * careeros:// scheme - see the GET handler.
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

type ProviderId = "google" | "github";

function isProviderId(value: string): value is ProviderId {
  return value === "google" || value === "github";
}

function providerCredentials(provider: ProviderId): { clientId: string; clientSecret: string } {
  if (provider === "google") {
    return {
      clientId: readFirstEnv("GOOGLE_OAUTH_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID"),
      clientSecret: readFirstEnv("GOOGLE_OAUTH_CLIENT_SECRET")
    };
  }
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
  const google = providerCredentials("google");
  const github = providerCredentials("github");
  res.json({
    ok: true,
    providers: {
      google: google.clientId && google.clientSecret ? { enabled: true, clientId: google.clientId } : { enabled: false },
      github: github.clientId && github.clientSecret ? { enabled: true, clientId: github.clientId } : { enabled: false }
    }
  });
});

router.get("/:provider/callback", (req, res) => {
  const provider = req.params.provider;
  const params = new URLSearchParams();
  if (typeof req.query.code === "string") params.set("code", req.query.code);
  if (typeof req.query.state === "string") params.set("state", req.query.state);
  if (typeof req.query.error === "string") params.set("error", req.query.error);
  if (typeof req.query.error_description === "string") {
    params.set("error_description", req.query.error_description);
  }
  if (!isProviderId(provider) && !params.has("error")) {
    params.set("error", "unsupported_provider");
  }
  res.redirect(`careeros://oauthredirect?${params.toString()}`);
});

type TokenExchangeResult = { accessToken: string } | { error: string };

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const { clientId, clientSecret } = providerCredentials("google");
  if (!clientId || !clientSecret) {
    return { error: "Google sign-in isn't configured on this server yet." };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    }).toString()
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!response.ok || !payload.access_token) {
    return { error: payload.error_description || payload.error || "Google rejected that sign-in attempt." };
  }
  return { accessToken: payload.access_token };
}

async function exchangeGithubCode(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const { clientId, clientSecret } = providerCredentials("github");
  if (!clientId || !clientSecret) {
    return { error: "GitHub sign-in isn't configured on this server yet." };
  }

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
    return { error: payload.error_description || payload.error || "GitHub rejected that sign-in attempt." };
  }
  return { accessToken: payload.access_token };
}

router.post("/:provider/exchange", async (req, res) => {
  const provider = req.params.provider;
  if (!isProviderId(provider)) {
    return res.status(400).json({ ok: false, error: `Unsupported provider "${provider}".` });
  }

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

  try {
    const exchanged = provider === "google" ? await exchangeGoogleCode(code, redirectUri) : await exchangeGithubCode(code, redirectUri);
    if ("error" in exchanged) {
      return res.status(400).json({ ok: false, error: exchanged.error });
    }
    res.json({ ok: true, accessToken: exchanged.accessToken });
  } catch (error) {
    console.error("Mobile OAuth exchange failed.", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "Unable to complete sign-in." });
  }
});

export default router;
