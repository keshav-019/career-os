import { extensionCorsPreflight, jsonWithExtensionCors } from "@/lib/server/extension-cors";
import { getFirebaseWebApiKey } from "@/lib/public-runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readFirstEnv(...names: string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * Public, unauthenticated (there's no user yet - this is consulted BEFORE sign-in). Tells the Chrome extension
 * popup which OAuth providers are actually configured server-side, and hands over the PUBLIC client ids it needs
 * to build each provider's authorize URL. The matching client SECRETS never leave this server - see
 * /api/extension/oauth/[provider]/route.ts, which is the only place they're read.
 */
export async function OPTIONS(request: Request) {
  return extensionCorsPreflight(request, ["GET", "OPTIONS"]);
}

export async function GET(request: Request) {
  const firebaseApiKey = readFirstEnv("FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY") || getFirebaseWebApiKey();
  const googleClientId = readFirstEnv("GOOGLE_OAUTH_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID");
  const googleClientSecret = readFirstEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const githubClientId = readFirstEnv("GITHUB_OAUTH_CLIENT_ID", "NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID");
  const githubClientSecret = readFirstEnv("GITHUB_OAUTH_CLIENT_SECRET");

  return jsonWithExtensionCors(request, {
    auth: {
      emailPasswordEnabled: Boolean(firebaseApiKey),
      firebaseApiKey
    },
    ok: true,
    providers: {
      google:
        googleClientId && googleClientSecret
          ? { enabled: true, clientId: googleClientId }
          : { enabled: false, clientId: googleClientId || null },
      github:
        githubClientId && githubClientSecret
          ? { enabled: true, clientId: githubClientId }
          : { enabled: false, clientId: githubClientId || null }
    }
  });
}
