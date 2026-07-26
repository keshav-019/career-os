import { NextResponse } from "next/server";
import { generate, verify } from "otplib";
import { createTwoFactorSession } from "@/lib/server/two-factor-session";
import { decryptTwoFactorSecret } from "@/lib/server/two-factor-crypto";
import { buildExtensionCorsHeaders, extensionCorsPreflight, jsonWithExtensionCors } from "@/lib/server/extension-cors";
import { checkSlidingWindowRateLimit } from "@/lib/server/rate-limit";
import {
  getUserTwoFactorSettings,
  updateUserTwoFactorSettings
} from "@/lib/server/two-factor-store";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";
const TOTP_PERIOD_SECONDS = 30;
const CONSECUTIVE_WINDOW_STEPS = 3;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to verify authenticator code.";
}

async function verifyConsecutiveSetupCodes(secret: string, firstToken: string, secondToken: string): Promise<boolean> {
  const nowEpochSeconds = Math.floor(Date.now() / 1000);

  for (let offset = -CONSECUTIVE_WINDOW_STEPS; offset <= CONSECUTIVE_WINDOW_STEPS; offset += 1) {
    const firstEpoch = nowEpochSeconds + offset * TOTP_PERIOD_SECONDS;
    const expectedFirst = await generate({
      epoch: firstEpoch,
      period: TOTP_PERIOD_SECONDS,
      secret
    });

    if (expectedFirst !== firstToken) {
      continue;
    }

    const expectedSecond = await generate({
      epoch: firstEpoch + TOTP_PERIOD_SECONDS,
      period: TOTP_PERIOD_SECONDS,
      secret
    });

    if (expectedSecond === secondToken) {
      return true;
    }
  }

  return false;
}

export async function OPTIONS(request: Request) {
  return extensionCorsPreflight(request, ["OPTIONS", "POST"]);
}

export async function POST(request: Request) {
  try {
    const auth = await verifyRequestAuth(request.headers.get("authorization"));

    if (auth.signInProvider === "google.com" || auth.signInProvider === "github.com") {
      return jsonWithExtensionCors(
        request,
        {
          code: "TWO_FACTOR_NOT_APPLICABLE",
          error: "Authenticator verification is not required for Google or GitHub sign-ins."
        },
        400
      );
    }

    const payload = (await request.json()) as { nextToken?: unknown; token?: unknown };
    const normalizedToken = String(payload.token ?? "").trim();
    const normalizedNextToken = String(payload.nextToken ?? "").trim();

    const rateLimit = checkSlidingWindowRateLimit({
      key: `2fa-verify:${auth.userId}`,
      maxRequests: 12,
      windowMs: 5 * 60_000
    });
    if (!rateLimit.allowed) {
      const headers = buildExtensionCorsHeaders(request, ["OPTIONS", "POST"]);
      headers.set("Retry-After", String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))));
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          error: "Too many authenticator attempts. Please wait and try again."
        },
        {
          status: 429,
          headers
        }
      );
    }

    if (!/^\d{6}$/.test(normalizedToken)) {
      return jsonWithExtensionCors(
        request,
        {
          code: "INVALID_2FA_INPUT",
          error: "Enter a valid 6-digit authenticator code."
        },
        400
      );
    }

    const settings = await getUserTwoFactorSettings(auth.idToken, auth.userId);
    const encryptedSecret = settings.twoFactorPendingSecret || settings.twoFactorSecret;
    const isPendingSetup = Boolean(settings.twoFactorPendingSecret);

    if (!encryptedSecret) {
      return jsonWithExtensionCors(
        request,
        {
          code: "TWO_FACTOR_NOT_CONFIGURED",
          error: "Two-factor authentication is not configured for this account."
        },
        400
      );
    }

    const decryptedSecret = decryptTwoFactorSecret(encryptedSecret);

    if (isPendingSetup) {
      if (!/^\d{6}$/.test(normalizedNextToken)) {
        return jsonWithExtensionCors(
          request,
          {
            code: "INVALID_2FA_NEXT_INPUT",
            error: "Enter the next 6-digit authenticator code after refresh."
          },
          400
        );
      }

      if (normalizedToken === normalizedNextToken) {
        return jsonWithExtensionCors(
          request,
          {
            code: "CONSECUTIVE_CODES_REQUIRED",
            error: "The two setup codes must be consecutive. Wait for code refresh and try again."
          },
          400
        );
      }

      const hasConsecutiveCodes = await verifyConsecutiveSetupCodes(
        decryptedSecret,
        normalizedToken,
        normalizedNextToken
      );

      if (!hasConsecutiveCodes) {
        return jsonWithExtensionCors(
          request,
          {
            code: "CONSECUTIVE_CODES_REQUIRED",
            error: "Setup needs two consecutive valid authenticator codes. Please retry setup verification."
          },
          400
        );
      }

      const enrollmentSession = createTwoFactorSession();

      await updateUserTwoFactorSettings(auth.idToken, auth.userId, {
        twoFactorEnabled: true,
        twoFactorPendingSecret: null,
        twoFactorSecret: encryptedSecret,
        twoFactorSessionHash: enrollmentSession.tokenHash,
        twoFactorSessionIssuedAt: new Date(enrollmentSession.issuedAtMs)
      });

      return jsonWithExtensionCors(request, {
        firstEnrollment: true,
        twoFactorSessionExpiresAt: new Date(enrollmentSession.expiresAtMs).toISOString(),
        twoFactorSessionToken: enrollmentSession.token,
        verified: true
      });
    }

    const verificationResult = await verify({
      epochTolerance: 30,
      secret: decryptedSecret,
      token: normalizedToken
    });
    const isVerified =
      typeof verificationResult === "boolean"
        ? verificationResult
        : Boolean((verificationResult as { valid?: boolean }).valid);

    if (!isVerified) {
      return jsonWithExtensionCors(request, { verified: false });
    }

    const twoFactorSession = createTwoFactorSession();

    await updateUserTwoFactorSettings(auth.idToken, auth.userId, {
      twoFactorSessionHash: twoFactorSession.tokenHash,
      twoFactorSessionIssuedAt: new Date(twoFactorSession.issuedAtMs)
    });

    return jsonWithExtensionCors(request, {
      firstEnrollment: false,
      twoFactorSessionExpiresAt: new Date(twoFactorSession.expiresAtMs).toISOString(),
      twoFactorSessionToken: twoFactorSession.token,
      verified: true
    });
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    const status =
      message.includes("Bearer")
      || message.includes("Invalid or expired authentication token")
      || message.includes("authentication token")
        ? 401
        : 500;
    const safeMessage = status === 401 ? "Invalid or expired authentication token." : "Failed to verify authenticator code.";

    return jsonWithExtensionCors(
      request,
      { error: safeMessage },
      status
    );
  }
}
