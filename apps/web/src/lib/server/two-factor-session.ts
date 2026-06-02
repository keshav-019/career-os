import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { TWO_FACTOR_SESSION_TTL_MS } from "@/lib/two-factor-session";

export type TwoFactorSession = {
  expiresAtMs: number;
  issuedAtMs: number;
  token: string;
  tokenHash: string;
};

type ValidateTwoFactorSessionOptions = {
  authTimeMs: number | null;
  issuedAtMs: number | null;
  nowMs?: number;
  providedToken: string | null;
  storedTokenHash: string | null;
};

export type TwoFactorSessionValidationResult =
  | { valid: true }
  | { reason: "expired" | "login-newer" | "mismatch" | "missing"; valid: false };

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeEqualHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createTwoFactorSession(): TwoFactorSession {
  const issuedAtMs = Date.now();
  const token = randomBytes(32).toString("base64url");

  return {
    expiresAtMs: issuedAtMs + TWO_FACTOR_SESSION_TTL_MS,
    issuedAtMs,
    token,
    tokenHash: hashSessionToken(token)
  };
}

export function validateTwoFactorSession({
  authTimeMs,
  issuedAtMs,
  nowMs = Date.now(),
  providedToken,
  storedTokenHash
}: ValidateTwoFactorSessionOptions): TwoFactorSessionValidationResult {
  if (!providedToken || !storedTokenHash || !issuedAtMs) {
    return { reason: "missing", valid: false };
  }

  if (nowMs - issuedAtMs > TWO_FACTOR_SESSION_TTL_MS) {
    return { reason: "expired", valid: false };
  }

  if (authTimeMs && issuedAtMs < authTimeMs) {
    return { reason: "login-newer", valid: false };
  }

  const providedHash = hashSessionToken(providedToken);
  if (!safeEqualHash(providedHash, storedTokenHash)) {
    return { reason: "mismatch", valid: false };
  }

  return { valid: true };
}
