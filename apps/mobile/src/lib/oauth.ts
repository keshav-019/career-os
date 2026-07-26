import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { GithubAuthProvider, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "./firebase";
import { API_BASE_URL } from "../config/env";

/**
 * Google sign-in uses a dedicated Android-type OAuth client (public/native, PKCE, no secret - registered
 * against this app's package name + the debug/release signing cert's SHA-1 in Google Cloud Console) so the whole
 * flow runs client-side: system browser -> PKCE code exchange straight against Google -> signInWithCredential.
 * No backend involved at all for Google.
 *
 * GitHub has no equivalent native/public client type - GitHub OAuth Apps always require a client secret for code
 * exchange, so that half still goes through apps/mobile-backend/src/routes/oauth.ts, which holds the secret
 * server-side and only ever hands this app a short-lived provider access token.
 */

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_ANDROID_CLIENT_ID = "718498812867-t90bm4fdputicamhsbr8b948nofbl4ek.apps.googleusercontent.com";
// Google's own convention for native/installed app redirect URIs - the reversed form of the client ID's
// ".apps.googleusercontent.com" suffix, registered as this app's custom URL scheme in app.json's
// android.intentFilters. Google recognizes this exact format for the matching Android-type client automatically;
// it doesn't need to be separately entered anywhere in Google Cloud Console.
const GOOGLE_REDIRECT_URI = "com.googleusercontent.apps.718498812867-t90bm4fdputicamhsbr8b948nofbl4ek:/oauth2redirect";

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke"
};

async function signInWithGoogleNative(): Promise<void> {
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_ANDROID_CLIENT_ID,
    redirectUri: GOOGLE_REDIRECT_URI,
    responseType: AuthSession.ResponseType.Code,
    scopes: ["openid", "email", "profile"],
    usePKCE: true
  });

  const result = await request.promptAsync(GOOGLE_DISCOVERY);
  if (result.type === "cancel" || result.type === "dismiss") {
    throw new Error("Sign-in was cancelled.");
  }
  if (result.type === "error") {
    throw new Error(result.error?.message || result.params?.error_description || "Google sign-in failed.");
  }
  if (result.type !== "success" || !result.params.code) {
    throw new Error("Google sign-in did not complete.");
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId: GOOGLE_ANDROID_CLIENT_ID,
      code: result.params.code,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
      redirectUri: GOOGLE_REDIRECT_URI
    },
    GOOGLE_DISCOVERY
  );

  if (!tokenResult.idToken && !tokenResult.accessToken) {
    throw new Error("Google did not return a usable token.");
  }

  const credential = GoogleAuthProvider.credential(tokenResult.idToken ?? null, tokenResult.accessToken ?? undefined);
  await signInWithCredential(auth, credential);
}

const GITHUB_REDIRECT_URL = Linking.createURL("oauthredirect");

function githubCallbackUrl(): string {
  return `${API_BASE_URL}/api/oauth/github/callback`;
}

type GithubConfigResponse = {
  providers: { github: { enabled: boolean; clientId?: string } };
};

async function fetchGithubConfig(): Promise<{ enabled: boolean; clientId?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/oauth/config`);
  if (!response.ok) {
    throw new Error("Could not load sign-in configuration.");
  }
  const payload = (await response.json()) as GithubConfigResponse;
  return payload.providers.github;
}

async function signInWithGithubRelay(): Promise<void> {
  const config = await fetchGithubConfig();
  if (!config?.enabled || !config.clientId) {
    throw new Error("GitHub sign-in isn't configured yet.");
  }

  const redirectUri = githubCallbackUrl();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email"
  });
  const authorizeUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, GITHUB_REDIRECT_URL);
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

  const exchangeResponse = await fetch(`${API_BASE_URL}/api/oauth/github/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri })
  });
  const exchangePayload = (await exchangeResponse.json().catch(() => ({}))) as {
    ok?: boolean;
    accessToken?: string;
    error?: string;
  };
  if (!exchangeResponse.ok || !exchangePayload.ok || !exchangePayload.accessToken) {
    throw new Error(exchangePayload.error || "Could not complete sign-in.");
  }

  await signInWithCredential(auth, GithubAuthProvider.credential(exchangePayload.accessToken));
}

export function signInWithGoogle(): Promise<void> {
  return signInWithGoogleNative();
}

export function signInWithGithub(): Promise<void> {
  return signInWithGithubRelay();
}
