import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated (there's no user yet - this is consulted BEFORE sign-in). Tells the Chrome extension
 * popup which OAuth providers are actually configured server-side, and hands over the PUBLIC client ids it needs
 * to build each provider's authorize URL. The matching client SECRETS never leave this server - see
 * /api/extension/oauth/[provider]/route.ts, which is the only place they're read.
 */
export async function GET() {
  const googleClientId = (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
  const githubClientId = (process.env.GITHUB_OAUTH_CLIENT_ID ?? "").trim();

  return NextResponse.json({
    ok: true,
    providers: {
      google: googleClientId ? { enabled: true, clientId: googleClientId } : { enabled: false, clientId: null },
      github: githubClientId ? { enabled: true, clientId: githubClientId } : { enabled: false, clientId: null }
    }
  });
}
