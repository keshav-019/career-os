export const TWO_FACTOR_SESSION_HEADER = "x-2fa-session";
export const TWO_FACTOR_SESSION_STORAGE_KEY = "careeros-2fa-session-token";
export const TWO_FACTOR_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const hasWindow = () => typeof window !== "undefined";

export function getStoredTwoFactorSessionToken(): string | null {
  if (!hasWindow()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(TWO_FACTOR_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredTwoFactorSessionToken(token: string): void {
  if (!hasWindow()) {
    return;
  }

  try {
    window.sessionStorage.setItem(TWO_FACTOR_SESSION_STORAGE_KEY, token);
  } catch {
    // Ignore sessionStorage failures (private mode or restricted browser settings).
  }
}

export function clearStoredTwoFactorSessionToken(): void {
  if (!hasWindow()) {
    return;
  }

  try {
    window.sessionStorage.removeItem(TWO_FACTOR_SESSION_STORAGE_KEY);
  } catch {
    // Ignore sessionStorage failures (private mode or restricted browser settings).
  }
}
