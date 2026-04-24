import { NextResponse, type NextRequest } from "next/server";

function isDesktopAppRequest(): boolean {
  return process.env.CAREEROS_DESKTOP_BUILD === "1" || process.env.CAREEROS_DESKTOP_APP === "1";
}

// Resume Studio, AI Match, and their /api/ai/* + /api/resume/extract routes used to be gated here too, but
// nothing about them actually requires desktop-local compute (career-ai.ts just calls OpenRouter; resume/extract
// just parses an uploaded file) - Coding Arena is the one area that genuinely needs a local judge/compiler, so
// it's the only thing still gated.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const desktopOnlyPath = pathname === "/coding-room" || pathname.startsWith("/coding-room/");

  if (!isDesktopAppRequest() && desktopOnlyPath) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/coding-room/:path*"]
};
