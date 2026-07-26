import { NextResponse } from "next/server";
import { isAllowedExtensionOrigin } from "@/lib/server/extension-origin";

const CONFIGURED_ALLOWED_ORIGINS = (process.env.CAREEROS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const DEFAULT_ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  process.env.NEXT_PUBLIC_SITE_URL
].filter((value): value is string => Boolean(value && value.trim()));

const ALLOWED_WEB_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...CONFIGURED_ALLOWED_ORIGINS
]);

function isAllowedOrigin(request: Request, origin: string): boolean {
  try {
    if (origin === new URL(request.url).origin) {
      return true;
    }
  } catch {
    // Continue with the explicit checks below.
  }

  return isAllowedExtensionOrigin(origin) || ALLOWED_WEB_ORIGINS.has(origin);
}

export function buildExtensionCorsHeaders(
  request: Request,
  methods: string[] = ["GET", "POST", "OPTIONS"]
): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-2FA-Session",
    "Access-Control-Allow-Methods": methods.join(", "),
    Vary: "Origin"
  });
  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(request, origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

export function extensionCorsPreflight(
  request: Request,
  methods?: string[]
): Response {
  return new NextResponse(null, {
    headers: buildExtensionCorsHeaders(request, methods),
    status: 204
  });
}

export function jsonWithExtensionCors(
  request: Request,
  data: unknown,
  status = 200,
  methods?: string[]
) {
  return NextResponse.json(data, {
    headers: buildExtensionCorsHeaders(request, methods),
    status
  });
}
