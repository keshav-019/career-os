import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { GithubAuthProvider, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "./firebase";
import { API_BASE_URL } from "../config/env";

/**
 * Client half of the mobile app's "Continue with Google/GitHub" flow - see
 * apps/mobile-backend/src/routes/oauth.ts for the server half and the full reasoning. Short version: this app
 * can't hold the Google/GitHub OAuth client secret, so it only ever sees a short-lived authorization code
 * (via the system browser, never a WebView) and hands that to the backend to exchange for a provider access
 * token. That token is then used with the Firebase SDK's own signInWithCredential - the same call
 * signInWithPopup(auth, new GoogleAuthProvider()) makes internally on the web login page - so mobile, web, and
 * the browser extension all land on the same Firebase identity for the same provider account.
 */

WebBrowser.maybeCompleteAuthSession();

type ProviderId = "google" | "github";

const REDIRECT_URL = Linking.createURL("oauthredirect");

function callbackUrl(provider: ProviderId): string {
  return `${API_BASE_URL}/api/oauth/${provider}/callback`;
}

type OAuthConfigResponse = {
  providers: Record<ProviderId, { enabled: boolean; clientId?: string }>;
};

async function fetchOAuthConfig(): Promise<OAuthConfigResponse["providers"]> {
  const response = await fetch(`${API_BASE_URL}/api/oauth/config`);
  if (!response.ok) {
    throw new Error("Could not load sign-in configuration.");
  }
  const payload = (await response.json()) as OAuthConfigResponse;
  return payload.providers;
}

function buildAuthorizeUrl(provider: ProviderId, clientId: string): string {
  const redirectUri = callbackUrl(provider);
  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account"
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email"
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function signInWithProvider(provider: ProviderId): Promise<void> {
  const providers = await fetchOAuthConfig();
  const config = providers[provider];
  if (!config?.enabled || !config.clientId) {
    throw new Error(`${provider === "google" ? "Google" : "GitHub"} sign-in isn't configured yet.`);
  }

  const authorizeUrl = buildAuthorizeUrl(provider, config.clientId);
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, REDIRECT_URL);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new Error("Sign-in was cancelled.");
  }
  if (result.type !== "success" || !result.url) {
    throw new Error("Sign-in did not complete.");
  }

  const { queryParams } = Linking.parse(result.url);
  const error = queryParams?.error;
  if (typeof error === "string") {
    const description = queryParams?.error_description;
    throw new Error(typeof description === "string" ? description : error);
  }
  const code = queryParams?.code;
  if (typeof code !== "string" || !code) {
    throw new Error("Sign-in did not return an authorization code.");
  }

  const exchangeResponse = await fetch(`${API_BASE_URL}/api/oauth/${provider}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri: callbackUrl(provider) })
  });
  const exchangePayload = (await exchangeResponse.json().catch(() => ({}))) as {
    ok?: boolean;
    accessToken?: string;
    error?: string;
  };
  if (!exchangeResponse.ok || !exchangePayload.ok || !exchangePayload.accessToken) {
    throw new Error(exchangePayload.error || "Could not complete sign-in.");
  }

  const credential =
    provider === "google"
      ? GoogleAuthProvider.credential(null, exchangePayload.accessToken)
      : GithubAuthProvider.credential(exchangePayload.accessToken);

  await signInWithCredential(auth, credential);
}

export function signInWithGoogle(): Promise<void> {
  return signInWithProvider("google");
}

export function signInWithGithub(): Promise<void> {
  return signInWithProvider("github");
}
