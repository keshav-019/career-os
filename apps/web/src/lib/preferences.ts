export const THEME_PREFERENCE_KEY = "careeros-theme-preference";
export const THEME_CHANGE_EVENT = "careeros-theme-change";
export const CALENDAR_SYNC_PREFERENCE_KEY = "careeros-calendar-sync-enabled";
export const CALENDAR_SYNC_CHANGE_EVENT = "careeros-calendar-sync-change";
export const PROFILE_STORAGE_KEY = "careeros-profile-v1";
export const PROFILE_CHANGE_EVENT = "careeros-profile-change";
export const PROFILE_SAVE_REQUEST_EVENT = "careeros-profile-save-request";
export const SETTINGS_STORAGE_KEY = "careeros-settings-v1";
export const CALENDAR_EVENTS_STORAGE_KEY = "careeros-calendar-events-v1";

export type ThemePreference = "light" | "dark";

export function readThemePreference(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedPreference = window.localStorage.getItem(THEME_PREFERENCE_KEY);
  return storedPreference === "light" || storedPreference === "dark" ? storedPreference : null;
}

export function writeThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_PREFERENCE_KEY, preference);
  window.dispatchEvent(new CustomEvent<ThemePreference>(THEME_CHANGE_EVENT, { detail: preference }));
}

export function readCalendarSyncEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(CALENDAR_SYNC_PREFERENCE_KEY) === "enabled";
}

export function writeCalendarSyncEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  const value = enabled ? "enabled" : "disabled";
  window.localStorage.setItem(CALENDAR_SYNC_PREFERENCE_KEY, value);
  window.dispatchEvent(new CustomEvent<boolean>(CALENDAR_SYNC_CHANGE_EVENT, { detail: enabled }));
}

function readStoredProfile(): { fullName?: unknown; photoURL?: unknown } | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!storedProfile) {
    return null;
  }

  try {
    return JSON.parse(storedProfile) as { fullName?: unknown; photoURL?: unknown };
  } catch {
    return null;
  }
}

function sanitizeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function readProfileNamePreference(): string | null {
  const parsed = readStoredProfile();
  if (!parsed || typeof parsed.fullName !== "string") {
    return null;
  }

  const trimmedName = parsed.fullName.trim();
  return trimmedName.length > 0 ? trimmedName : null;
}

export function readProfilePhotoPreference(): string | null {
  const parsed = readStoredProfile();
  if (!parsed) {
    return null;
  }

  return sanitizeHttpUrl(parsed.photoURL);
}
