export const LOCAL_ADMIN_SESSION_STORAGE_KEY = "careeros-local-admin-session";

export type LocalAdminSession = {
  displayName: string;
  email: string;
  username: string;
};

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

export function readLocalAdminSession(): LocalAdminSession | null {
  try {
    const storage = getSessionStorage();
    const raw = storage?.getItem(LOCAL_ADMIN_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<LocalAdminSession>;
    const username = typeof parsed.username === "string" ? parsed.username.trim() : "";
    if (!username) {
      return null;
    }

    return {
      username,
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName.trim()
          ? parsed.displayName.trim()
          : "Learning Admin",
      email:
        typeof parsed.email === "string" && parsed.email.trim()
          ? parsed.email.trim()
          : `${username}@local.admin`
    };
  } catch {
    return null;
  }
}

export function writeLocalAdminSession(session: LocalAdminSession): void {
  try {
    getSessionStorage()?.setItem(LOCAL_ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore sessionStorage failures in restricted browser contexts.
  }
}

export function clearLocalAdminSessions(): void {
  try {
    const storage = getSessionStorage();
    storage?.removeItem(LOCAL_ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // Ignore sessionStorage failures in restricted browser contexts.
  }
}
