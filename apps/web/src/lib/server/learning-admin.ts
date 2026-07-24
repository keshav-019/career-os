import crypto from "node:crypto";

export const LEARNING_ADMIN_SESSION_COOKIE = "careeros-learning-admin-session";
export const LEARNING_ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type LearningAdminConfig = {
  enabled: boolean;
  password: string;
  username: string;
};

type LearningAdminCookieOptions = {
  httpOnly: true;
  maxAge: number;
  path: string;
  sameSite: "lax";
  secure: boolean;
};

function timingSafeStringEqual(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

// Falls back to deriving a secret from the password (rather than using the password itself as the HMAC key)
// when CAREEROS_LEARNING_ADMIN_SESSION_SECRET isn't set - a leaked signing key this way still can't be used to
// log in directly, unlike reusing the raw password.
function getSessionSecret(config: LearningAdminConfig): string {
  const configured = (process.env.CAREEROS_LEARNING_ADMIN_SESSION_SECRET ?? "").trim();
  if (configured) {
    return configured;
  }

  return crypto.createHash("sha256").update(`careeros-learning-admin-session:${config.password}`).digest("base64url");
}

export function getLearningAdminConfig(): LearningAdminConfig {
  const password = (process.env.CAREEROS_LEARNING_ADMIN_PASSWORD ?? "").trim();
  const username = (process.env.CAREEROS_LEARNING_ADMIN_USERNAME ?? "admin").trim() || "admin";
  const editFlag = (process.env.ALLOW_LEARNING_CONTENT_EDIT ?? "").trim() === "1";

  return {
    enabled: editFlag && password.length > 0,
    password,
    username
  };
}

export function getLearningAdminCookieOptions(): LearningAdminCookieOptions {
  return {
    httpOnly: true,
    maxAge: LEARNING_ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  };
}

export function getClearLearningAdminCookieOptions(): LearningAdminCookieOptions {
  return {
    ...getLearningAdminCookieOptions(),
    maxAge: 0
  };
}

export function verifyLearningAdminCredentials(username: string, password: string): boolean {
  const config = getLearningAdminConfig();
  if (!config.enabled) {
    return false;
  }

  return timingSafeStringEqual(username.trim(), config.username) && timingSafeStringEqual(password, config.password);
}

export function createLearningAdminSessionCookieValue(username: string): string | null {
  const config = getLearningAdminConfig();
  if (!config.enabled || username.trim() !== config.username) {
    return null;
  }

  const payload = toBase64Url(
    JSON.stringify({
      issuedAt: Date.now(),
      username: config.username
    })
  );
  const signature = signPayload(payload, getSessionSecret(config));
  return `${payload}.${signature}`;
}

export function verifyLearningAdminSessionCookie(value: string | undefined): boolean {
  const config = getLearningAdminConfig();
  if (!config.enabled || !value) {
    return false;
  }

  const [payload, signature, ...rest] = value.split(".");
  if (!payload || !signature || rest.length > 0) {
    return false;
  }

  const expectedSignature = signPayload(payload, getSessionSecret(config));
  if (!timingSafeStringEqual(signature, expectedSignature)) {
    return false;
  }

  const rawPayload = fromBase64Url(payload);
  if (!rawPayload) {
    return false;
  }

  try {
    const parsed = JSON.parse(rawPayload) as { issuedAt?: unknown; username?: unknown };
    if (parsed.username !== config.username || typeof parsed.issuedAt !== "number") {
      return false;
    }

    const expiresAt = parsed.issuedAt + LEARNING_ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
    return Date.now() <= expiresAt;
  } catch {
    return false;
  }
}
