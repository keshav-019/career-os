import { NextResponse } from "next/server";
import { updateUserTwoFactorSettings } from "@/lib/server/two-factor-store";
import { verifyRequestAuth } from "@/lib/server/verify-request-auth";

export const runtime = "nodejs";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to disable authenticator login.";
}

export async function POST(request: Request) {
  try {
    const auth = await verifyRequestAuth(request.headers.get("authorization"));

    await updateUserTwoFactorSettings(auth.idToken, auth.userId, {
      twoFactorEnabled: false,
      twoFactorPendingSecret: null,
      twoFactorSecret: null,
      twoFactorSessionHash: null,
      twoFactorSessionIssuedAt: null
    });

    return NextResponse.json({ disabled: true });
  } catch (error: unknown) {
    const message = toErrorMessage(error);
    const status =
      message.includes("Bearer")
      || message.includes("Invalid or expired authentication token")
      || message.includes("authentication token")
        ? 401
        : 500;
    const safeMessage = status === 401 ? "Invalid or expired authentication token." : "Failed to disable authenticator login.";

    return NextResponse.json(
      { error: safeMessage },
      { status }
    );
  }
}
