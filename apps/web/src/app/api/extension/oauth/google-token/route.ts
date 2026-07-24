import { NextRequest } from "next/server";
import { extensionCorsPreflight, jsonWithExtensionCors } from "@/lib/server/extension-cors";
import { buildAuthPackage, readFirstEnv, signInWithIdp } from "@/lib/server/extension-oauth-idp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chrome-native counterpart to ../[provider]/route.ts, used only by the Chrome build's
 * chrome.identity.getAuthToken() flow (see apps/extension/src/background.js's startGoogleSignInChromeNative()).
 * Chrome hands the extension a real Google access token directly, validated against the extension's own
 * published Chrome Web Store ID - no authorization code, no redirect_uri, no client secret anywhere in this
 * flow - so this route skips straight to the same accounts:signInWithIdp exchange [provider]/route.ts does
 * after its own code-for-token exchange step.
 */

const REQUEST_URI = readFirstEnv("NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL") || "https://keshav-019-career-os.vercel.app";

export async function OPTIONS(request: Request) {
  return extensionCorsPreflight(request, ["OPTIONS", "POST"]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
    if (!accessToken) {
      return jsonWithExtensionCors(request, { ok: false, error: "Expected { accessToken }." }, 400);
    }

    const idpResult = await signInWithIdp("google.com", accessToken, REQUEST_URI);
    return jsonWithExtensionCors(request, { ok: true, auth: buildAuthPackage(idpResult, "google.com") });
  } catch (error) {
    console.error("Extension Chrome-native Google sign-in failed.", error);
    return jsonWithExtensionCors(
      request,
      { ok: false, error: error instanceof Error ? error.message : "Unable to complete sign-in." },
      500
    );
  }
}
