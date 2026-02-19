import { NextResponse } from "next/server";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { encryptTwoFactorSecret } from "@/lib/server/two-factor-crypto";
import { checkSlidingWindowRateLimit } from "@/lib/server/rate-limit";
import { updateUserTwoFactorSettings } from "@/lib/server/two-factor-store";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to generate authenticator setup.";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getAppBaseUrl(request: Request): string {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || null;
  if (configuredBaseUrl) {
    return trimTrailingSlash(configuredBaseUrl);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProtocol = request.headers.get("x-forwarded-proto") || "https";
    return `${forwardedProtocol}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

function getTotpLogoUrl(request: Request): string | null {
  const configuredLogoUrl =
    process.env.TOTP_APP_IMAGE_URL
    || process.env.NEXT_PUBLIC_TOTP_APP_IMAGE_URL
    || null;
  if (configuredLogoUrl) {
    return configuredLogoUrl;
  }

  const origin = getAppBaseUrl(request);
  const parsed = new URL(origin);

  // Authenticator apps on phones cannot fetch localhost assets from a dev machine.
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "0.0.0.0") {
    return null;
  }

  return new URL("/careeros-logo-128.png", origin).toString();
}

export async function POST(request: Request) {
  try {
    const auth = await verifyRequestAuth(request.headers.get("authorization"));

    const rateLimit = checkSlidingWindowRateLimit({
      key: `2fa-setup:${auth.userId}`,
      maxRequests: 20,
      windowMs: 60 * 60_000
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many setup requests. Please retry later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000)))
          }
        }
      );
    }

    if (auth.signInProvider === "google.com" || auth.signInProvider === "github.com") {
      return NextResponse.json(
        { error: "Authenticator setup is disabled for Google and GitHub sign-ins." },
        { status: 400 }
      );
    }

    const secret = generateSecret();
    const generatedUri = generateURI({
      issuer: "CareerOS",
      label: auth.email || auth.userId,
      secret
    });
    const uri = new URL(generatedUri);

    // Non-standard vendor metadata. Some apps use it, many (including Google Authenticator) ignore it.
    const logoUrl = getTotpLogoUrl(request);
    if (logoUrl) {
      uri.searchParams.set("image", logoUrl);
      uri.searchParams.set("icon", logoUrl);
    }
    const brandedUri = uri.toString();

    const qrCode = await QRCode.toDataURL(brandedUri);
    const encryptedSecret = encryptTwoFactorSecret(secret);

    await updateUserTwoFactorSettings(auth.idToken, auth.userId, {
      twoFactorEnabled: false,
      twoFactorPendingSecret: encryptedSecret,
      twoFactorSecret: null,
      twoFactorSessionHash: null,
      twoFactorSessionIssuedAt: null
    });

    return NextResponse.json({
      otpauthUrl: brandedUri,
      qrCode,
      setupKey: secret
    });
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    const status =
      message.includes("Bearer")
      || message.includes("Invalid or expired authentication token")
      || message.includes("authentication token")
        ? 401
        : 500;
    const safeMessage = status === 401 ? "Invalid or expired authentication token." : "Failed to generate authenticator setup.";

    return NextResponse.json(
      { error: safeMessage },
      { status }
    );
  }
}
