import { useEffect, useState } from "react";
import { View } from "react-native";
import { CalendarDays, Lock, MoonStar } from "lucide-react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../theme/ThemeContext";
import { loadSettings, saveSettings } from "../../lib/settings";
import type { ProfileVisibility, SessionTimeout, SettingsData } from "../../types/settings";
import { Card, ErrorText, GhostButton, LoadingView, Screen, SectionHeader, SuccessText } from "../../components/ui/Primitives";
import { PickerField } from "../../components/ui/PickerField";
import { SwitchRow } from "../../components/ui/SwitchRow";

const SESSION_TIMEOUT_OPTIONS: { value: SessionTimeout; label: string }[] = [
  { value: "30m", label: "30 minutes" },
  { value: "2h", label: "2 hours" },
  { value: "8h", label: "8 hours" }
];

const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string }[] = [
  { value: "private", label: "Private (only me)" },
  { value: "link-only", label: "Anyone with my profile link" },
  { value: "public", label: "Public profile" }
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const { user, resetPassword, signOutUser } = useAuth();

  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then((s) => setSettings({ ...s, themePreference: mode }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value };
      void saveSettings(next);
      return next;
    });
  }

  async function handleResetPassword() {
    if (!user?.email) {
      setPasswordError("No email on file for this account.");
      return;
    }
    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordNotice(null);
    try {
      await resetPassword(user.email);
      setPasswordNotice("Password reset email sent.");
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setPasswordBusy(false);
    }
  }

  if (!settings) {
    return (
      <Screen>
        <LoadingView label="Loading settings..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader eyebrow="Settings" title="Account and app preferences" />

      <Card>
        <SectionHeader eyebrow="Security" title="Session and password" right={<Lock color={colors.text} size={18} />} />
        <PickerField label="Session timeout" value={settings.sessionTimeout} options={SESSION_TIMEOUT_OPTIONS} onChange={(v) => update("sessionTimeout", v)} />
        <GhostButton label={passwordBusy ? "Sending..." : "Send password reset email"} onPress={() => void handleResetPassword()} disabled={passwordBusy} />
        {passwordNotice ? <SuccessText text={passwordNotice} /> : null}
        {passwordError ? <ErrorText text={passwordError} /> : null}
      </Card>

      <Card>
        <SectionHeader eyebrow="Appearance" title="Theme and app behavior" right={<MoonStar color={colors.text} size={18} />} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <GhostButton
            label="Dark"
            tone={mode === "dark" ? "brand" : "muted"}
            onPress={() => {
              setMode("dark");
              update("themePreference", "dark");
            }}
          />
          <GhostButton
            label="Light"
            tone={mode === "light" ? "brand" : "muted"}
            onPress={() => {
              setMode("light");
              update("themePreference", "light");
            }}
          />
        </View>
        <SwitchRow title="Interview reminders" description="Push alerts for upcoming interviews and prep sessions." value={settings.pushInterviewReminders} onValueChange={(v) => update("pushInterviewReminders", v)} />
        <SwitchRow title="Application updates" description="Status updates when application stages change." value={settings.pushApplicationUpdates} onValueChange={(v) => update("pushApplicationUpdates", v)} />
        <SwitchRow title="Deadline alerts" description="Reminders before important forms or follow-ups are due." value={settings.pushDeadlineAlerts} onValueChange={(v) => update("pushDeadlineAlerts", v)} />
      </Card>

      <Card>
        <SectionHeader eyebrow="Calendar" title="Calendar sync preferences" right={<CalendarDays color={colors.text} size={18} />} />
        <SwitchRow title="Sync CareerOS events to Google Calendar" description="Only enable if you want events copied to your Google calendar." value={settings.calendarSyncEnabled} onValueChange={(v) => update("calendarSyncEnabled", v)} />
      </Card>

      <Card>
        <SectionHeader eyebrow="Privacy" title="Profile visibility and communication" />
        <PickerField label="Profile visibility" value={settings.profileVisibility} options={VISIBILITY_OPTIONS} onChange={(v) => update("profileVisibility", v)} />
        <SwitchRow title="Product emails" description="Occasional updates about new features and release notes." value={settings.marketingEmails} onValueChange={(v) => update("marketingEmails", v)} />
      </Card>

      <GhostButton label="Sign out" tone="danger" onPress={() => void signOutUser()} />
    </Screen>
  );
}
