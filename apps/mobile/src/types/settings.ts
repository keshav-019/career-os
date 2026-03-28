import type { ThemeMode } from "../theme/theme";

// Mirrors SettingsData from apps/web/src/app/settings/page.tsx, minus the two web/desktop-only sections (Chrome
// extension token pairing, Google Calendar account linking, and 2FA setup - none of those apply to or were
// requested for the phone app; see apps/mobile/README.md for the full list of what's deliberately out of scope).
export type SessionTimeout = "30m" | "2h" | "8h";
export type ProfileVisibility = "private" | "link-only" | "public";

export type SettingsData = {
  themePreference: ThemeMode;
  sessionTimeout: SessionTimeout;
  calendarSyncEnabled: boolean;
  pushInterviewReminders: boolean;
  pushApplicationUpdates: boolean;
  pushDeadlineAlerts: boolean;
  profileVisibility: ProfileVisibility;
  marketingEmails: boolean;
};

export function buildDefaultSettings(): SettingsData {
  return {
    themePreference: "dark",
    sessionTimeout: "2h",
    calendarSyncEnabled: false,
    pushInterviewReminders: true,
    pushApplicationUpdates: true,
    pushDeadlineAlerts: true,
    profileVisibility: "private",
    marketingEmails: false
  };
}
