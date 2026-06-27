/**
 * Shared by apps/web/src/app/api/extension/oauth/[provider]/route.ts (code-for-token exchange, used by GitHub
 * always and by Google on Firefox) and .../oauth/google-token/route.ts (Chrome's chrome.identity.getAuthToken()
 * flow, which already has a provider access token and skips the code exchange step). Both end up here: trading
 * a provider access token for a Firebase idToken/refreshToken pair via Identity Toolkit's accounts:signInWithIdp
 * REST endpoint - the same underlying call the Firebase JS SDK's signInWithPopup makes internally.
 */

export function readFirstEnv(...names: string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

export const FIREBASE_WEB_API_KEY = readFirstEnv("FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY");

type SignInWithIdpResponse = {
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
  email?: string;
  localId?: string;
  providerId?: string;
  error?: { message?: string };
};

export async function signInWithIdp(providerId: "google.com" | "github.com", accessToken: string, requestUri: string) {
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

export function buildAuthPackage(idpResult: SignInWithIdpResponse, providerId: string) {
  return {
    apiKey: FIREBASE_WEB_API_KEY,
    idToken: idpResult.idToken,
    refreshToken: idpResult.refreshToken ?? "",
    email: idpResult.email ?? "",
    userId: idpResult.localId ?? "",
    providerId,
    expiresAtMs: idpResult.expiresIn ? Date.now() + Number(idpResult.expiresIn) * 1000 : undefined
  };
}
