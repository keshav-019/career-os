import { createHash } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { getFirebaseWebApiKey } from "@/lib/public-runtime-env";

export type VerifiedRequestAuth = {
  authTimeMs: number | null;
  email: string | null;
  idToken: string;
  signInProvider: string | null;
  userId: string;
};

type IdentityToolkitUser = {
  email?: string;
  localId?: string;
};

type AccountsLookupResponse = {
  users?: IdentityToolkitUser[];
};

type CachedAuthEntry = {
  expiresAtMs: number;
  value: VerifiedRequestAuth;
};

declare global {
  var __CAREER_OS_AUTH_CACHE__: Map<string, CachedAuthEntry> | undefined;
}

const authCache = globalThis.__CAREER_OS_AUTH_CACHE__ ?? new Map<string, CachedAuthEntry>();
if (!globalThis.__CAREER_OS_AUTH_CACHE__) {
  globalThis.__CAREER_OS_AUTH_CACHE__ = authCache;
}

const FIREBASE_WEB_API_KEY = getFirebaseWebApiKey();

const LOOKUP_ENDPOINT = FIREBASE_WEB_API_KEY
  ? `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`
  : "";
const MAX_AUTH_CACHE_ENTRIES = 2_000;
const MAX_ID_TOKEN_LENGTH = 4_096;

function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  if (token.length > MAX_ID_TOKEN_LENGTH) {
    return null;
  }

  return token;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function clearExpiredCacheEntries(nowMs: number): void {
  for (const [cacheKey, entry] of authCache.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      authCache.delete(cacheKey);
    }
  }
}

function enforceCacheLimit(nowMs: number): void {
  clearExpiredCacheEntries(nowMs);
  if (authCache.size <= MAX_AUTH_CACHE_ENTRIES) {
    return;
  }

  const overflow = authCache.size - MAX_AUTH_CACHE_ENTRIES;
  const keys = authCache.keys();
  for (let index = 0; index < overflow; index += 1) {
    const next = keys.next();
    if (next.done) {
      break;
    }

    authCache.delete(next.value);
  }
}

function decodeJwtMetadata(token: string): {
  authTimeMs: number | null;
  expiresAtMs: number | null;
  signInProvider: string | null;
} {
  const [, payloadRaw] = token.split(".");
  if (!payloadRaw) {
    return { authTimeMs: null, expiresAtMs: null, signInProvider: null };
  }

  try {
    const normalizedPayload = payloadRaw.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );
    const decodedPayload = Buffer.from(paddedPayload, "base64").toString("utf8");
    const parsedPayload = JSON.parse(decodedPayload) as {
      auth_time?: unknown;
      exp?: unknown;
      firebase?: { sign_in_provider?: unknown };
    };

    const authTimeMs =
      typeof parsedPayload.auth_time === "number" && Number.isFinite(parsedPayload.auth_time)
        ? parsedPayload.auth_time * 1000
        : null;
    const expiresAtMs =
      typeof parsedPayload.exp === "number" && Number.isFinite(parsedPayload.exp) ? parsedPayload.exp * 1000 : null;
    const signInProvider =
      typeof parsedPayload.firebase?.sign_in_provider === "string"
        ? parsedPayload.firebase.sign_in_provider
        : null;

    return { authTimeMs, expiresAtMs, signInProvider };
  } catch {
    return { authTimeMs: null, expiresAtMs: null, signInProvider: null };
  }
}

export async function verifyRequestAuth(authorizationHeader: string | null): Promise<VerifiedRequestAuth> {
  const idToken = extractBearerToken(authorizationHeader);
  if (!idToken) {
    throw new Error("Missing Bearer auth token.");
  }

  const nowMs = Date.now();
  if (authCache.size > 250) {
    enforceCacheLimit(nowMs);
  }

  const cacheKey = hashToken(idToken);
  const cachedEntry = authCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAtMs > nowMs) {
    return cachedEntry.value;
  }

  if (isFirebaseAdminConfigured) {
    let decoded: DecodedIdToken;
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken, true);
    } catch {
      throw new Error("Invalid or expired authentication token.");
    }
    const authTimeMs = typeof decoded.auth_time === "number" ? decoded.auth_time * 1000 : null;
    const expiresAtMs = typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
    const signInProvider =
      typeof decoded.firebase?.sign_in_provider === "string" ? decoded.firebase.sign_in_provider : null;

    const verifiedAuth: VerifiedRequestAuth = {
      authTimeMs,
      email: typeof decoded.email === "string" ? decoded.email : null,
      idToken,
      signInProvider,
      userId: decoded.uid
    };

    const ttlMs = Math.min(
      Math.max((expiresAtMs ?? nowMs + 5 * 60_000) - nowMs - 5_000, 30_000),
      15 * 60_000
    );
    authCache.set(cacheKey, {
      expiresAtMs: nowMs + ttlMs,
      value: verifiedAuth
    });
    enforceCacheLimit(nowMs);

    return verifiedAuth;
  }

  if (!LOOKUP_ENDPOINT) {
    throw new Error("Server authentication is not configured.");
  }

  const jwtMetadata = decodeJwtMetadata(idToken);
  const lookupResponse = await fetch(LOOKUP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idToken }),
    cache: "no-store"
  });

  if (!lookupResponse.ok) {
    throw new Error("Invalid or expired authentication token.");
  }

  const lookupPayload = (await lookupResponse.json()) as AccountsLookupResponse;
  const firstUser = lookupPayload.users?.[0];
  if (!firstUser?.localId) {
    throw new Error("Invalid or expired authentication token.");
  }

  const verifiedAuth: VerifiedRequestAuth = {
    authTimeMs: jwtMetadata.authTimeMs,
    email: typeof firstUser.email === "string" ? firstUser.email : null,
    idToken,
    signInProvider: jwtMetadata.signInProvider,
    userId: firstUser.localId
  };

  const ttlMs = Math.min(
    Math.max((jwtMetadata.expiresAtMs ?? nowMs + 5 * 60_000) - nowMs - 5_000, 30_000),
    15 * 60_000
  );
  authCache.set(cacheKey, {
    expiresAtMs: nowMs + ttlMs,
    value: verifiedAuth
  });
  enforceCacheLimit(nowMs);

  return verifiedAuth;
}
