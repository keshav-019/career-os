import { NextResponse, type NextRequest } from "next/server";

function isDesktopAppRequest(): boolean {
  return process.env.CAREEROS_DESKTOP_BUILD === "1" || process.env.CAREEROS_DESKTOP_APP === "1";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const desktopOnlyPath =
    pathname === "/resumes" ||
    pathname.startsWith("/resumes/") ||
    pathname === "/ai-match" ||
    pathname.startsWith("/ai-match/") ||
    pathname === "/coding-room" ||
    pathname.startsWith("/coding-room/") ||
    pathname.startsWith("/api/ai/") ||
    pathname === "/api/resume/extract";

  if (!isDesktopAppRequest() && desktopOnlyPath) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/resumes/:path*", "/ai-match/:path*", "/coding-room/:path*", "/api/ai/:path*", "/api/resume/extract"]
};
