import { NextResponse } from "next/server";
import { TWO_FACTOR_SESSION_HEADER, TWO_FACTOR_SESSION_TTL_MS } from "@/lib/two-factor-session";
import { validateTwoFactorSession } from "@/lib/server/two-factor-session";
import { getUserTwoFactorSettings, updateUserTwoFactorSettings } from "@/lib/server/two-factor-store";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to validate two-factor session.";
}

export async function GET(request: Request) {
  try {
    const auth = await verifyRequestAuth(request.headers.get("authorization"));

    if (auth.signInProvider === "google.com" || auth.signInProvider === "github.com") {
      return NextResponse.json({
        reason: "oauth-provider-session",
        required: false,
        valid: true
      });
    }

    const settings = await getUserTwoFactorSettings(auth.idToken, auth.userId);

    if (!settings.twoFactorEnabled) {
      return NextResponse.json({
        required: false,
        valid: true
      });
    }

    // Self-heal invalid states so users are not locked out by partial 2FA setup records.
    if (!settings.twoFactorSecret) {
      await updateUserTwoFactorSettings(auth.idToken, auth.userId, {
        twoFactorEnabled: false,
        twoFactorPendingSecret: null,
        twoFactorSessionHash: null,
        twoFactorSessionIssuedAt: null
      });

      return NextResponse.json({
        required: false,
        valid: true
      });
    }

    const providedToken = request.headers.get(TWO_FACTOR_SESSION_HEADER);
    const validation = validateTwoFactorSession({
      authTimeMs: auth.authTimeMs,
      issuedAtMs: settings.twoFactorSessionIssuedAtMs,
      providedToken,
      storedTokenHash: settings.twoFactorSessionHash
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          reason: validation.reason,
          required: true,
          valid: false
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      expiresAtMs: (settings.twoFactorSessionIssuedAtMs ?? 0) + TWO_FACTOR_SESSION_TTL_MS,
      required: true,
      valid: true
    });
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    const status =
      message.includes("Bearer")
      || message.includes("Invalid or expired authentication token")
      || message.includes("authentication token")
        ? 401
        : 500;
    const safeMessage = status === 401 ? "Invalid or expired authentication token." : "Failed to validate two-factor session.";

    return NextResponse.json(
      { error: safeMessage },
      { status }
    );
  }
}
