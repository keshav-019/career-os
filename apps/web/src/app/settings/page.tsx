"use client";

import { CalendarDays, Lock, MoonStar, ShieldCheck, Smartphone } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import {
  clearStoredTwoFactorSessionToken,
  setStoredTwoFactorSessionToken
} from "@/lib/two-factor-session";
import {
  SETTINGS_STORAGE_KEY,
  type ThemePreference,
  readCalendarSyncEnabled,
  readThemePreference,
  writeCalendarSyncEnabled,
  writeThemePreference
} from "@/lib/preferences";

type SessionTimeout = "30m" | "2h" | "8h";
type ProfileVisibility = "private" | "link-only" | "public";

type SettingsData = {
  themePreference: ThemePreference;
  sessionTimeout: SessionTimeout;
  calendarSyncEnabled: boolean;
  pushInterviewReminders: boolean;
  pushApplicationUpdates: boolean;
  pushDeadlineAlerts: boolean;
  profileVisibility: ProfileVisibility;
  marketingEmails: boolean;
};

type SecurityBusyState = "generate" | "verify" | "disable" | null;

type SetupPayload = {
  otpauthUrl?: string;
  qrCode?: string;
  setupKey?: string;
};

type VerifyPayload = {
  twoFactorSessionToken?: string;
  verified?: boolean;
};

function buildDefaultSettings(): SettingsData {
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

function hydrateSettings(raw: unknown): SettingsData {
  const base = buildDefaultSettings();

  if (!raw || typeof raw !== "object") {
    return base;
  }

  const candidate = raw as Partial<SettingsData>;

  return {
    ...base,
    themePreference: candidate.themePreference === "light" ? "light" : "dark",
    sessionTimeout:
      candidate.sessionTimeout === "30m" || candidate.sessionTimeout === "8h" ? candidate.sessionTimeout : "2h",
    calendarSyncEnabled: Boolean(candidate.calendarSyncEnabled),
    pushInterviewReminders: candidate.pushInterviewReminders ?? base.pushInterviewReminders,
    pushApplicationUpdates: candidate.pushApplicationUpdates ?? base.pushApplicationUpdates,
    pushDeadlineAlerts: candidate.pushDeadlineAlerts ?? base.pushDeadlineAlerts,
    profileVisibility:
      candidate.profileVisibility === "public" || candidate.profileVisibility === "link-only"
        ? candidate.profileVisibility
        : "private",
    marketingEmails: Boolean(candidate.marketingEmails)
  };
}

function isGoogleLinked(user: User | null): boolean {
  if (!user) {
    return false;
  }

  return user.providerData.some((provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID);
}

function hasProvider(user: User | null, providerId: string): boolean {
  if (!user) {
    return false;
  }

  return user.providerData.some((provider) => provider.providerId === providerId);
}

async function readCurrentSignInProvider(user: User | null): Promise<string | null> {
  if (!user) {
    return null;
  }

  const tokenResult = await user.getIdTokenResult();
  const firebaseClaims = tokenResult.claims.firebase as { sign_in_provider?: unknown } | undefined;
  return typeof firebaseClaims?.sign_in_provider === "string" ? firebaseClaims.sign_in_provider : null;
}

async function readTwoFactorEnabled(user: User | null): Promise<boolean> {
  if (!db || !user) {
    return false;
  }

  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists()) {
    return false;
  }

  return snapshot.data().twoFactorEnabled === true;
}

function getSettingsErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    switch (error.code) {
      case "auth/requires-recent-login":
        return "Please sign out and sign back in, then retry this security action.";
      case "auth/popup-closed-by-user":
        return "Google account linking popup was closed before completion.";
      case "auth/popup-blocked":
        return "Your browser blocked the popup. Allow popups and try again.";
      case "auth/provider-already-linked":
        return "Google account is already connected.";
      default:
        return "Unable to complete the request. Please try again.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to complete the request. Please try again.";
}

async function getAuthHeaders(user: User): Promise<HeadersInit> {
  const idToken = await user.getIdToken(true);
  return {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json"
  };
}

async function parseApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // Ignore response parsing failures.
  }

  return fallback;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData>(() => buildDefaultSettings());
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [currentSignInProvider, setCurrentSignInProvider] = useState<string | null>(null);
  const [isTwoFactorConfigured, setIsTwoFactorConfigured] = useState(false);
  const [authenticatorEnabled, setAuthenticatorEnabled] = useState(false);
  const [securityBusy, setSecurityBusy] = useState<SecurityBusyState>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [setupKey, setSetupKey] = useState("");
  const [setupUri, setSetupUri] = useState("");
  const [setupQrCode, setSetupQrCode] = useState("");
  const [setupOtp, setSetupOtp] = useState("");
  const [setupNextOtp, setSetupNextOtp] = useState("");
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenNotice, setTokenNotice] = useState<string | null>(null);
  const [hasHydratedSettings, setHasHydratedSettings] = useState(false);

  const hasGoogleProvider = hasProvider(activeUser, GoogleAuthProvider.PROVIDER_ID);
  const hasGithubProvider = hasProvider(activeUser, GithubAuthProvider.PROVIDER_ID);
  const hasPasswordProvider = hasProvider(activeUser, "password");
  const isSocialSession = currentSignInProvider === GoogleAuthProvider.PROVIDER_ID
    || currentSignInProvider === GithubAuthProvider.PROVIDER_ID;
  const disableSocialSecurityFeatures =
    isSocialSession || (!currentSignInProvider && !hasPasswordProvider && (hasGoogleProvider || hasGithubProvider));
  const canConfigureAuthenticator = Boolean(activeUser) && !disableSocialSecurityFeatures;
  const canChangePassword =
    Boolean(activeUser?.email)
    && !disableSocialSecurityFeatures
    && (currentSignInProvider === "password" || (!currentSignInProvider && hasPasswordProvider));
  const shouldShowAuthenticatorSetup = canConfigureAuthenticator && authenticatorEnabled && !isTwoFactorConfigured;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;

    const defaults = buildDefaultSettings();
    const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    let nextSettings = defaults;

    if (stored) {
      try {
        nextSettings = hydrateSettings(JSON.parse(stored));
      } catch {
        nextSettings = defaults;
      }
    }

    const storedThemePreference = readThemePreference();
    animationFrameId = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      setSettings({
        ...nextSettings,
        themePreference: storedThemePreference ?? nextSettings.themePreference,
        calendarSyncEnabled: readCalendarSyncEnabled()
      });
      setHasHydratedSettings(true);
    });

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!hasHydratedSettings) {
      return;
    }

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    writeThemePreference(settings.themePreference);
    writeCalendarSyncEnabled(settings.calendarSyncEnabled);
  }, [hasHydratedSettings, settings]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setActiveUser(user);
      setGoogleLinked(isGoogleLinked(user));

      if (!user) {
        setCurrentSignInProvider(null);
        setIsTwoFactorConfigured(false);
        setAuthenticatorEnabled(false);
        return;
      }

      void readCurrentSignInProvider(user)
        .then((provider) => {
          setCurrentSignInProvider(provider);
        })
        .catch(() => {
          setCurrentSignInProvider(null);
        });

      void readTwoFactorEnabled(user)
        .then((enabled) => {
          setIsTwoFactorConfigured(enabled);
          setAuthenticatorEnabled(enabled);
        })
        .catch(() => {
          setIsTwoFactorConfigured(false);
          setAuthenticatorEnabled(false);
        });
    });

    return unsubscribe;
  }, []);

  const setField = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  };

  const clearAuthenticatorSetup = () => {
    setSetupKey("");
    setSetupUri("");
    setSetupQrCode("");
    setSetupOtp("");
    setSetupNextOtp("");
  };

  const handleGenerateSetupSecret = async () => {
    if (!activeUser) {
      setSecurityError("Please sign in again to set up authenticator login.");
      return;
    }

    setSecurityBusy("generate");
    setSecurityError(null);
    setSecurityNotice(null);

    try {
      const response = await fetch("/api/2fa/setup", {
        method: "POST",
        headers: await getAuthHeaders(activeUser)
      });

      if (!response.ok) {
        const message = await parseApiError(response, "Failed to generate authenticator setup key.");
        throw new Error(message);
      }

      const payload = (await response.json()) as SetupPayload;
      setSetupKey(typeof payload.setupKey === "string" ? payload.setupKey : "");
      setSetupUri(typeof payload.otpauthUrl === "string" ? payload.otpauthUrl : "");
      setSetupQrCode(typeof payload.qrCode === "string" ? payload.qrCode : "");
      setSetupOtp("");
      setSetupNextOtp("");
      setSecurityNotice(
        "Scan the QR code, enter your current code, then wait for the next code refresh and enter the next one."
      );
    } catch (error) {
      setSecurityError(getSettingsErrorMessage(error));
    } finally {
      setSecurityBusy(null);
    }
  };

  const handleVerifySetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeUser) {
      setSecurityError("Please sign in again to complete authenticator setup.");
      return;
    }

    const otp = setupOtp.trim();
    if (!/^\d{6}$/.test(otp)) {
      setSecurityError("Enter a valid first 6-digit code from your authenticator app.");
      return;
    }

    const nextOtp = setupNextOtp.trim();
    if (!/^\d{6}$/.test(nextOtp)) {
      setSecurityError("Enter a valid second 6-digit code after the code refreshes.");
      return;
    }

    if (otp === nextOtp) {
      setSecurityError("The two setup codes must be consecutive. Wait for refresh and enter the next code.");
      return;
    }

    setSecurityBusy("verify");
    setSecurityError(null);
    setSecurityNotice(null);

    try {
      const response = await fetch("/api/2fa/verify", {
        method: "POST",
        headers: await getAuthHeaders(activeUser),
        body: JSON.stringify({ token: otp, nextToken: nextOtp })
      });

      if (!response.ok) {
        const message = await parseApiError(response, "Failed to verify authenticator code.");
        throw new Error(message);
      }

      const payload = (await response.json()) as VerifyPayload;
      if (!payload.verified) {
        setSecurityError("Invalid authenticator code. Please try again.");
        return;
      }

      if (typeof payload.twoFactorSessionToken === "string" && payload.twoFactorSessionToken.length > 0) {
        setStoredTwoFactorSessionToken(payload.twoFactorSessionToken);
      }

      setIsTwoFactorConfigured(true);
      setAuthenticatorEnabled(true);
      clearAuthenticatorSetup();
      setSecurityNotice("Authenticator app is active. You will be asked for a code at sign-in.");
    } catch (error) {
      setSecurityError(getSettingsErrorMessage(error));
    } finally {
      setSecurityBusy(null);
    }
  };

  const handleAuthenticatorToggle = async (enabled: boolean) => {
    setSecurityError(null);
    setSecurityNotice(null);

    if (!canConfigureAuthenticator) {
      setAuthenticatorEnabled(false);
      setSecurityNotice("Authenticator setup is unavailable for Google/GitHub sign-ins.");
      return;
    }

    if (!enabled) {
      if (!activeUser) {
        setSecurityError("Please sign in again to update authenticator settings.");
        setAuthenticatorEnabled(isTwoFactorConfigured);
        return;
      }

      setSecurityBusy("disable");
      try {
        const response = await fetch("/api/2fa/disable", {
          method: "POST",
          headers: await getAuthHeaders(activeUser)
        });

        if (!response.ok) {
          const message = await parseApiError(response, "Failed to disable authenticator login.");
          throw new Error(message);
        }

        setIsTwoFactorConfigured(false);
        setAuthenticatorEnabled(false);
        clearAuthenticatorSetup();
        clearStoredTwoFactorSessionToken();
        setSecurityNotice("Authenticator app login is disabled. Turning it on again will require a fresh setup.");
      } catch (error) {
        setAuthenticatorEnabled(true);
        setSecurityError(getSettingsErrorMessage(error));
      } finally {
        setSecurityBusy(null);
      }
      return;
    }

    setAuthenticatorEnabled(true);
    clearAuthenticatorSetup();
    setSecurityNotice("Fresh setup is required. Scan the new QR code to re-enable authenticator login.");
    await handleGenerateSetupSecret();
  };

  const handleConnectGoogle = async () => {
    if (!activeUser || !auth) {
      setGoogleError("Please sign in again to connect your Google account.");
      return;
    }

    setGoogleBusy(true);
    setGoogleError(null);
    setGoogleNotice(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/calendar.events");
      await linkWithPopup(activeUser, provider);
      await activeUser.reload();
      const refreshedUser = auth.currentUser ?? activeUser;
      setActiveUser(refreshedUser);
      setGoogleLinked(isGoogleLinked(refreshedUser));
      setGoogleNotice("Google account connected. CareerOS can now sync events when enabled.");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "auth/provider-already-linked"
      ) {
        setGoogleLinked(true);
        setGoogleNotice("Google account is already connected.");
      } else {
        setGoogleError(getSettingsErrorMessage(error));
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth || !activeUser?.email) {
      setPasswordError("Email/password account not detected.");
      return;
    }

    setPasswordBusy(true);
    setPasswordError(null);
    setPasswordNotice(null);

    try {
      await sendPasswordResetEmail(auth, activeUser.email);
      setPasswordNotice(`Password reset email sent to ${activeUser.email}.`);
    } catch (error) {
      setPasswordError(getSettingsErrorMessage(error));
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleCopyExtensionToken = async () => {
    if (!activeUser) {
      setTokenError("Please sign in again to generate extension token.");
      return;
    }

    if (!navigator.clipboard) {
      setTokenError("Clipboard access is unavailable in this browser.");
      return;
    }

    setTokenBusy(true);
    setTokenError(null);
    setTokenNotice(null);

    try {
      const apiKey = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "").trim();
      if (!apiKey) {
        throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY. Extension package cannot be generated.");
      }

      const idToken = await activeUser.getIdToken(true);
      const extensionToken = JSON.stringify({
        apiKey,
        apiBaseUrl: window.location.origin,
        idToken,
        refreshToken: activeUser.refreshToken ?? ""
      });
      await navigator.clipboard.writeText(extensionToken);
      setTokenNotice("Extension auth package copied. Paste it once in the Chrome extension.");
    } catch (error) {
      setTokenError(getSettingsErrorMessage(error));
    } finally {
      setTokenBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="settings-layout-grid">
        <article className="career-card settings-panel-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Security</p>
              <h2>Authenticator protection</h2>
              <p>Use any authenticator app for your second login step.</p>
            </div>
            <ShieldCheck size={19} />
          </div>

          <div className="settings-control-list">
            <div className="settings-control-row">
              <div>
                <h3>Authenticator app sign-in</h3>
                <p>
                  {canConfigureAuthenticator
                    ? "When enabled, login requires the code from your authenticator app."
                    : "Google/GitHub sign-in already provides strong account security. Authenticator setup is hidden."}
                </p>
              </div>
              <label className="switch-toggle">
                <input
                  checked={canConfigureAuthenticator ? authenticatorEnabled : false}
                  disabled={securityBusy !== null || !activeUser || !canConfigureAuthenticator}
                  onChange={(event) => {
                    void handleAuthenticatorToggle(event.target.checked);
                  }}
                  type="checkbox"
                />
                <span />
              </label>
            </div>

            <span className={canConfigureAuthenticator && isTwoFactorConfigured ? "pill success" : "pill"}>
              {canConfigureAuthenticator
                ? isTwoFactorConfigured
                  ? "Authenticator enabled"
                  : "Authenticator not configured"
                : "Managed by social sign-in"}
            </span>

            {shouldShowAuthenticatorSetup ? (
              <div className="settings-authenticator-setup">
                <p className="settings-authenticator-copy">
                  Setup is required before this toggle is fully active.
                </p>

                <div className="settings-authenticator-actions">
                  <button
                    className="ghost-button"
                    disabled={securityBusy !== null || !activeUser}
                    onClick={() => {
                      void handleGenerateSetupSecret();
                    }}
                    type="button"
                  >
                    {securityBusy === "generate" ? "Generating..." : "Regenerate setup key"}
                  </button>
                </div>

                {setupQrCode ? (
                  <div className="settings-authenticator-qr-wrap">
                    <Image
                      alt="Authenticator setup QR code"
                      className="settings-authenticator-qr"
                      height={160}
                      src={setupQrCode}
                      unoptimized
                      width={160}
                    />
                  </div>
                ) : null}

                {setupQrCode ? (
                  <p className="settings-authenticator-copy">
                    Logo display depends on your authenticator app. Google Authenticator may show only issuer text.
                  </p>
                ) : null}

                {setupKey ? (
                  <label className="profile-field">
                    Manual setup key
                    <input readOnly type="text" value={setupKey} />
                  </label>
                ) : null}

                {setupUri ? (
                  <label className="profile-field">
                    Authenticator URI
                    <textarea readOnly value={setupUri} />
                  </label>
                ) : null}

                <form className="settings-authenticator-verify" onSubmit={handleVerifySetup}>
                  <label className="profile-field">
                    Verification code
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      minLength={6}
                      onChange={(event) => setSetupOtp(event.target.value.replace(/\s+/g, ""))}
                      placeholder="123456"
                      required
                      type="text"
                      value={setupOtp}
                    />
                  </label>

                  <label className="profile-field">
                    Next verification code
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      minLength={6}
                      onChange={(event) => setSetupNextOtp(event.target.value.replace(/\s+/g, ""))}
                      placeholder="654321"
                      required
                      type="text"
                      value={setupNextOtp}
                    />
                  </label>

                  <button className="primary-button" disabled={securityBusy !== null || !activeUser} type="submit">
                    {securityBusy === "verify" ? "Verifying..." : "Verify and enable"}
                  </button>
                </form>
              </div>
            ) : null}

            {securityNotice ? <p className="settings-feedback success">{securityNotice}</p> : null}
            {securityError ? <p className="settings-feedback error">{securityError}</p> : null}

            <label className="profile-field">
              Session timeout
              <select
                onChange={(event) => setField("sessionTimeout", event.target.value as SessionTimeout)}
                value={settings.sessionTimeout}
              >
                <option value="30m">30 minutes</option>
                <option value="2h">2 hours</option>
                <option value="8h">8 hours</option>
              </select>
            </label>

            <div className="settings-control-row">
              <div>
                <h3>Change password</h3>
                <p>
                  {canChangePassword
                    ? "Send a secure password reset email for your account."
                    : "Password changes are available only for email/password sign-ins."}
                </p>
              </div>
              <button
                className="ghost-button"
                disabled={passwordBusy || !canChangePassword}
                onClick={() => {
                  void handlePasswordReset();
                }}
                type="button"
              >
                {passwordBusy ? "Sending..." : "Send reset email"}
              </button>
            </div>

            {passwordNotice ? <p className="settings-feedback success">{passwordNotice}</p> : null}
            {passwordError ? <p className="settings-feedback error">{passwordError}</p> : null}

            <div className="settings-control-row">
              <div>
                <h3>Chrome extension token</h3>
                <p>Copy once and paste it in the CareerOS extension to save jobs under your account.</p>
              </div>
              <button
                className="ghost-button"
                disabled={tokenBusy || !activeUser}
                onClick={() => {
                  void handleCopyExtensionToken();
                }}
                type="button"
              >
                {tokenBusy ? "Copying..." : "Copy token"}
              </button>
            </div>

            {tokenNotice ? <p className="settings-feedback success">{tokenNotice}</p> : null}
            {tokenError ? <p className="settings-feedback error">{tokenError}</p> : null}
          </div>
        </article>

        <article className="career-card settings-panel-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Appearance</p>
              <h2>Theme and app behavior</h2>
              <p>Set how CareerOS should look by default.</p>
            </div>
            <MoonStar size={19} />
          </div>

          <div className="settings-control-list">
            <div className="settings-control-row">
              <div>
                <h3>Default theme</h3>
                <p>Choose whether light mode or dark mode should be your default.</p>
              </div>
              <div className="segmented-control">
                <button
                  className={settings.themePreference === "dark" ? "segmented-button active" : "segmented-button"}
                  onClick={() => setField("themePreference", "dark")}
                  type="button"
                >
                  Dark
                </button>
                <button
                  className={settings.themePreference === "light" ? "segmented-button active" : "segmented-button"}
                  onClick={() => setField("themePreference", "light")}
                  type="button"
                >
                  Light
                </button>
              </div>
            </div>

            <div className="settings-inline-banner">
              <Smartphone size={15} />
              <p>
                Push notifications are managed here so your dashboard stays focused and uncluttered.
              </p>
            </div>

            <div className="settings-control-row">
              <div>
                <h3>Interview reminders</h3>
                <p>Receive push alerts for upcoming interviews and prep sessions.</p>
              </div>
              <label className="switch-toggle">
                <input
                  checked={settings.pushInterviewReminders}
                  onChange={(event) => setField("pushInterviewReminders", event.target.checked)}
                  type="checkbox"
                />
                <span />
              </label>
            </div>

            <div className="settings-control-row">
              <div>
                <h3>Application updates</h3>
                <p>Get status updates when application stages change.</p>
              </div>
              <label className="switch-toggle">
                <input
                  checked={settings.pushApplicationUpdates}
                  onChange={(event) => setField("pushApplicationUpdates", event.target.checked)}
                  type="checkbox"
                />
                <span />
              </label>
            </div>

            <div className="settings-control-row">
              <div>
                <h3>Deadline alerts</h3>
                <p>Get reminded before important forms or follow-ups are due.</p>
              </div>
              <label className="switch-toggle">
                <input
                  checked={settings.pushDeadlineAlerts}
                  onChange={(event) => setField("pushDeadlineAlerts", event.target.checked)}
                  type="checkbox"
                />
                <span />
              </label>
            </div>
          </div>
        </article>
      </section>

      <section className="settings-layout-grid">
        <article className="career-card settings-panel-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Calendar</p>
              <h2>Calendar sync preferences</h2>
              <p>CareerOS calendar works independently. Google sync remains optional.</p>
            </div>
            <CalendarDays size={19} />
          </div>

          <div className="settings-control-list">
            <div className="settings-control-row">
              <div>
                <h3>Sync CareerOS events to Google Calendar</h3>
                <p>Only enable this if you want CareerOS events copied to your Google calendar.</p>
              </div>
              <label className="switch-toggle">
                <input
                  checked={settings.calendarSyncEnabled}
                  onChange={(event) => setField("calendarSyncEnabled", event.target.checked)}
                  type="checkbox"
                />
                <span />
              </label>
            </div>

            <span className={settings.calendarSyncEnabled ? "pill success" : "pill"}>
              {settings.calendarSyncEnabled ? "Google sync enabled" : "Google sync disabled"}
            </span>

            {settings.calendarSyncEnabled ? (
              googleLinked ? (
                <p className="settings-feedback success">
                  Google account is already connected through your sign-in provider.
                </p>
              ) : (
                <div className="settings-authenticator-setup">
                  <p className="settings-authenticator-copy">
                    Connect Google to allow CareerOS events to be exported to your Google Calendar.
                  </p>
                  <div className="settings-authenticator-actions">
                    <button
                      className="ghost-button"
                      disabled={googleBusy}
                      onClick={() => {
                        void handleConnectGoogle();
                      }}
                      type="button"
                    >
                      {googleBusy ? "Connecting..." : "Connect Google account"}
                    </button>
                  </div>
                </div>
              )
            ) : null}

            {googleNotice ? <p className="settings-feedback success">{googleNotice}</p> : null}
            {googleError ? <p className="settings-feedback error">{googleError}</p> : null}
          </div>
        </article>

        <article className="career-card settings-panel-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Privacy</p>
              <h2>Profile visibility and communication</h2>
              <p>Control who can view your profile and what updates you receive.</p>
            </div>
            <Lock size={19} />
          </div>

          <div className="settings-control-list">
            <label className="profile-field">
              Profile visibility
              <select
                onChange={(event) => setField("profileVisibility", event.target.value as ProfileVisibility)}
                value={settings.profileVisibility}
              >
                <option value="private">Private (only me)</option>
                <option value="link-only">Anyone with my profile link</option>
                <option value="public">Public profile</option>
              </select>
            </label>

            <div className="settings-control-row">
              <div>
                <h3>Product emails</h3>
                <p>Receive occasional updates about new features and release notes.</p>
              </div>
              <label className="switch-toggle">
                <input
                  checked={settings.marketingEmails}
                  onChange={(event) => setField("marketingEmails", event.target.checked)}
                  type="checkbox"
                />
                <span />
              </label>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
