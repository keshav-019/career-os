import { NextRequest } from "next/server";
import { extensionCorsPreflight, jsonWithExtensionCors } from "@/lib/server/extension-cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side half of the Chrome extension's "Continue with Google/GitHub" flow (see
 * apps/extension/src/background.js's CAREEROS_OAUTH_START handler for the client half).
 *
 * A Manifest V3 extension can't safely hold a Google/GitHub OAuth client SECRET (anything shipped in the
 * extension bundle is effectively public), so the extension only ever gets an authorization CODE back from
 * chrome.identity.launchWebAuthFlow() and hands it to this route. This route does the two steps a normal
 * server-side OAuth login does:
 *   1. Exchange that code for a provider access token, using the client secret (env-var only, never sent to
 *      the extension).
 *   2. Trade that provider access token for a Firebase idToken/refreshToken pair via Identity Toolkit's
 *      accounts:signInWithIdp REST endpoint - the same underlying call the Firebase JS SDK's
 *      signInWithPopup(auth, new GoogleAuthProvider()) makes internally on the web login page. Reusing this
 *      REST endpoint means both the web app and the extension mint tokens against the exact same Firebase
 *      identity, so signing in either place lands on the same CareerOS account.
 *
 * The response shape matches exactly what background.js's normalizeAuthState() already expects (the same
 * shape as the "paste token package" flow from Settings), so both auth paths converge on one code path
 * downstream.
 */

function readFirstEnv(...names: string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

const FIREBASE_WEB_API_KEY = readFirstEnv("FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY");

type ProviderId = "google" | "github";

function isProviderId(value: string): value is ProviderId {
  return value === "google" || value === "github";
}

type TokenExchangeResult = { accessToken: string } | { error: string };

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const clientId = readFirstEnv("GOOGLE_OAUTH_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = readFirstEnv("GOOGLE_OAUTH_CLIENT_SECRET");
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

  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    return { error: payload.error_description || payload.error || "Google rejected that sign-in attempt." };
  }

  return { accessToken: payload.access_token };
}

async function exchangeGithubCode(code: string, redirectUri: string): Promise<TokenExchangeResult> {
  const clientId = readFirstEnv("GITHUB_OAUTH_CLIENT_ID", "NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID");
  const clientSecret = readFirstEnv("GITHUB_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return { error: "GitHub sign-in isn't configured on this server yet." };
  }

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    }).toString()
  });

  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    return { error: payload.error_description || payload.error || "GitHub rejected that sign-in attempt." };
  }

  return { accessToken: payload.access_token };
}

type SignInWithIdpResponse = {
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  email?: string;
  localId?: string;
  providerId?: string;
  error?: { message?: string };
};

async function signInWithIdp(providerId: "google.com" | "github.com", accessToken: string, requestUri: string) {
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY - cannot mint a CareerOS session.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${encodeURIComponent(accessToken)}&providerId=${providerId}`,
        requestUri,
        returnIdpCredential: true,
        returnSecureToken: true
      })
    }
  );

  const payload = (await response.json().catch(() => ({}))) as SignInWithIdpResponse;
  if (!response.ok || !payload.idToken) {
    throw new Error(payload.error?.message || "Could not complete sign-in with that account.");
  }

  return payload;
}

export async function OPTIONS(request: Request) {
  return extensionCorsPreflight(request, ["OPTIONS", "POST"]);
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const { provider } = await context.params;
    if (!isProviderId(provider)) {
      return jsonWithExtensionCors(request, { ok: false, error: `Unsupported provider "${provider}".` }, 400);
    }

    const body = await request.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const redirectUri = typeof body?.redirectUri === "string" ? body.redirectUri.trim() : "";
    if (!code || !redirectUri) {
      return jsonWithExtensionCors(request, { ok: false, error: "Expected { code, redirectUri }." }, 400);
    }

    const exchanged = provider === "google" ? await exchangeGoogleCode(code, redirectUri) : await exchangeGithubCode(code, redirectUri);
    if ("error" in exchanged) {
      return jsonWithExtensionCors(request, { ok: false, error: exchanged.error }, 400);
    }

    const providerId = provider === "google" ? "google.com" : "github.com";
    const idpResult = await signInWithIdp(providerId, exchanged.accessToken, redirectUri);

    return jsonWithExtensionCors(request, {
      ok: true,
      auth: {
        apiKey: FIREBASE_WEB_API_KEY,
        idToken: idpResult.idToken,
        refreshToken: idpResult.refreshToken ?? "",
        email: idpResult.email ?? "",
        userId: idpResult.localId ?? "",
        providerId,
        expiresAtMs: idpResult.expiresIn ? Date.now() + Number(idpResult.expiresIn) * 1000 : undefined
      }
    });
  } catch (error) {
    console.error("Extension OAuth exchange failed.", error);
    return jsonWithExtensionCors(
      request,
      { ok: false, error: error instanceof Error ? error.message : "Unable to complete sign-in." },
      500
    );
  }
}
