"use client";

import { GitBranch, Mail, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User
} from "firebase/auth";
import { auth, isFirebaseClientConfigured } from "@/lib/firebase/client";
import {
  clearStoredTwoFactorSessionToken,
  setStoredTwoFactorSessionToken
} from "@/lib/two-factor-session";

type AuthMethod = "email" | "google" | "github" | "mfa" | null;

type VerifyPayload = {
  twoFactorSessionToken?: string;
  verified?: boolean;
};

const TWO_FACTOR_PENDING_USER_STORAGE_KEY = "careeros-2fa-pending-user";

function clearPendingTwoFactorUserId(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(TWO_FACTOR_PENDING_USER_STORAGE_KEY);
}

function extractErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

function getAuthErrorMessage(error: unknown) {
  const code = extractErrorCode(error);
  const rawMessage = error instanceof Error ? error.message : "";
  if (code) {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Incorrect email or password.";
      case "auth/popup-closed-by-user":
        return "Sign-in popup was closed before authentication completed.";
      case "auth/popup-blocked":
        return "The popup was blocked by your browser. Please allow popups and retry.";
      case "auth/account-exists-with-different-credential":
        return "An account already exists with a different sign-in provider for this email.";
      case "auth/operation-not-allowed":
        return "This sign-in method is not enabled in Firebase Authentication yet.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized in Firebase Authentication settings.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait for a minute and try again.";
      case "auth/configuration-not-found":
        return "Google/GitHub sign-in is not enabled in Firebase Authentication.";
      case "auth/app-not-authorized":
        return "This app is not authorized with the configured Firebase project.";
      case "auth/invalid-api-key":
        return "Firebase API key is invalid. Check NEXT_PUBLIC_FIREBASE_API_KEY.";
      case "auth/network-request-failed":
        return "Network request failed while contacting Firebase. Check your internet and retry.";
      case "auth/internal-error":
        return rawMessage && rawMessage !== code
          ? `Authentication failed (${code}): ${rawMessage}`
          : `Authentication failed (${code}). Please try again.`;
      default:
        return `Authentication failed (${code}). Please try again.`;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Authentication failed. Please try again.";
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

async function getAuthHeaders(user: User): Promise<HeadersInit> {
  const idToken = await user.getIdToken(true);
  return {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json"
  };
}

function getPreferredOAuthProvider(
  signInMethods: string[]
): "google" | "github" | null {
  if (signInMethods.includes(GoogleAuthProvider.PROVIDER_ID)) {
    return "google";
  }

  if (signInMethods.includes(GithubAuthProvider.PROVIDER_ID)) {
    return "github";
  }

  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const authFlowInProgressRef = useRef(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busyMethod, setBusyMethod] = useState<AuthMethod>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const submitLabel = useMemo(
    () => (mode === "signin" ? "Sign in with email" : "Create account"),
    [mode]
  );

  const handlePostSignInRouting = useCallback(async () => {
    clearStoredTwoFactorSessionToken();
    clearPendingTwoFactorUserId();
    setRequiresTwoFactor(false);
    setTwoFactorCode("");
    router.replace("/dashboard");
  }, [router]);

  useEffect(() => {
    const firebaseAuth = auth;
    if (!firebaseAuth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        clearPendingTwoFactorUserId();
        setRequiresTwoFactor(false);
        setTwoFactorCode("");
        return;
      }

      if (authFlowInProgressRef.current) {
        return;
      }

      void handlePostSignInRouting().catch(() => {
        if (firebaseAuth.currentUser) {
          void signOut(firebaseAuth).catch(() => {
            // Ignore forced sign-out failures while recovering.
          });
        }
        clearStoredTwoFactorSessionToken();
        clearPendingTwoFactorUserId();
        setRequiresTwoFactor(false);
        setErrorMessage("Could not validate your session. Please sign in again.");
      });
    });

    return unsubscribe;
  }, [handlePostSignInRouting]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth) {
      setErrorMessage("Firebase auth is not configured.");
      return;
    }

    setBusyMethod("email");
    setErrorMessage(null);
    setRequiresTwoFactor(false);
    setTwoFactorCode("");
    authFlowInProgressRef.current = true;

    try {
      if (mode === "signin") {
        const normalizedEmail = email.trim().toLowerCase();
        clearPendingTwoFactorUserId();

        // Reset any stale signed-in session before starting this first-factor attempt.
        try {
          await signOut(auth);
        } catch {
          // Ignore sign-out errors for non-authenticated states.
        }

        const signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
        const hasPasswordMethod = signInMethods.includes("password");
        const preferredOAuthProvider = getPreferredOAuthProvider(signInMethods);

        if (!hasPasswordMethod && preferredOAuthProvider) {
          const providerLabel = preferredOAuthProvider === "google" ? "Google" : "GitHub";
          setErrorMessage(`This account uses ${providerLabel} sign-in. Continue with ${providerLabel}.`);
          return;
        }

        await signInWithEmailAndPassword(auth, normalizedEmail, password);
        await handlePostSignInRouting();
      } else {
        if (fullName.trim().length < 2) {
          setErrorMessage("Please enter your full name.");
          return;
        }
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: fullName.trim() });
        clearStoredTwoFactorSessionToken();
        clearPendingTwoFactorUserId();
        router.replace("/dashboard");
      }
    } catch (error) {
      setRequiresTwoFactor(false);
      setTwoFactorCode("");
      clearStoredTwoFactorSessionToken();
      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch {
          // Ignore sign-out failures while surfacing the original sign-in error.
        }
      }
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      authFlowInProgressRef.current = false;
      setBusyMethod(null);
    }
  };

  const handleProviderSignIn = async (providerName: "google" | "github") => {
    if (!auth) {
      setErrorMessage("Firebase auth is not configured.");
      return;
    }

    setBusyMethod(providerName);
    setErrorMessage(null);
    setRequiresTwoFactor(false);
    setTwoFactorCode("");
    authFlowInProgressRef.current = true;

    try {
      if (providerName === "google") {
        await signInWithPopup(auth, new GoogleAuthProvider());
        await handlePostSignInRouting();
      } else {
        const githubProvider = new GithubAuthProvider();
        githubProvider.addScope("read:user");
        githubProvider.addScope("user:email");
        await signInWithPopup(auth, githubProvider);
        await handlePostSignInRouting();
      }
    } catch (error) {
      const errorCode = extractErrorCode(error);
      if (errorCode === "auth/internal-error" || errorCode === "auth/popup-blocked") {
        try {
          setErrorMessage("Popup sign-in failed. Redirecting to complete authentication...");

          if (providerName === "google") {
            await signInWithRedirect(auth, new GoogleAuthProvider());
          } else {
            const githubProvider = new GithubAuthProvider();
            githubProvider.addScope("read:user");
            githubProvider.addScope("user:email");
            await signInWithRedirect(auth, githubProvider);
          }

          return;
        } catch (redirectError) {
          setErrorMessage(getAuthErrorMessage(redirectError));
          return;
        }
      }

      setRequiresTwoFactor(false);
      setTwoFactorCode("");
      if (auth.currentUser) {
        try {
          await signOut(auth);
        } catch {
          // Ignore sign-out failures while surfacing the original sign-in error.
        }
      }
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      authFlowInProgressRef.current = false;
      setBusyMethod(null);
    }
  };

  const handleTwoFactorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth?.currentUser) {
      setErrorMessage("Session expired. Please sign in again.");
      return;
    }

    const otp = twoFactorCode.trim();
    if (!/^\d{6}$/.test(otp)) {
      setErrorMessage("Enter a valid 6-digit code from your authenticator app.");
      return;
    }

    setBusyMethod("mfa");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/2fa/verify", {
        method: "POST",
        headers: await getAuthHeaders(auth.currentUser),
        body: JSON.stringify({ token: otp })
      });

      if (!response.ok) {
        const message = await parseApiError(response, "Failed to verify authenticator code.");
        throw new Error(message);
      }

      const payload = (await response.json()) as VerifyPayload;
      if (!payload.verified) {
        setErrorMessage("Invalid authenticator code. Please try again.");
        return;
      }

      if (typeof payload.twoFactorSessionToken !== "string" || payload.twoFactorSessionToken.length === 0) {
        throw new Error("Authenticator verification succeeded, but secure session setup failed.");
      }

      setStoredTwoFactorSessionToken(payload.twoFactorSessionToken);
      clearPendingTwoFactorUserId();
      setRequiresTwoFactor(false);
      router.replace("/dashboard");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setBusyMethod(null);
    }
  };

  const handleUseDifferentAccount = async () => {
    if (auth?.currentUser) {
      await signOut(auth);
    }

    clearStoredTwoFactorSessionToken();
    clearPendingTwoFactorUserId();
    setRequiresTwoFactor(false);
    setTwoFactorCode("");
    setErrorMessage(null);
    setPassword("");
  };

  if (!isFirebaseClientConfigured || !auth) {
    return (
      <main className="auth-screen">
        <section className="auth-card" aria-labelledby="login-heading">
          <div className="auth-brand">
            <span className="career-brand-mark">
              <Sparkles size={18} />
            </span>
            <div>
              <p className="eyebrow">CareerOS</p>
              <h1 id="login-heading">Firebase config missing</h1>
            </div>
          </div>
          <p className="auth-muted">
            Add Firebase keys in `apps/web/.env.local` or export them as `NEXT_PUBLIC_FIREBASE_*` variables in
            Vercel.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="login-heading">
        <div className="auth-brand">
          <span className="career-brand-mark">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="eyebrow">CareerOS</p>
            <h1 id="login-heading">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleEmailSubmit}>
          {mode === "signup" ? (
            <>
              <label htmlFor="auth-full-name">Full name</label>
              <input
                autoComplete="name"
                id="auth-full-name"
                minLength={2}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                required
                type="text"
                value={fullName}
              />
            </>
          ) : null}

          <label htmlFor="auth-email">Email</label>
          <input
            autoComplete="email"
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />

          <label htmlFor="auth-password">Password</label>
          <input
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            id="auth-password"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            required
            type="password"
            value={password}
          />

          {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

          <button className="primary-button auth-submit" disabled={busyMethod !== null} type="submit">
            {busyMethod === "email" ? "Please wait..." : submitLabel}
          </button>
        </form>

        {mode === "signin" && requiresTwoFactor ? (
          <form className="auth-form auth-mfa-form" onSubmit={handleTwoFactorSubmit}>
            <p className="auth-muted">Enter the 6-digit code from your authenticator app.</p>

            <label htmlFor="auth-mfa-code">Authenticator code</label>
            <input
              autoComplete="one-time-code"
              id="auth-mfa-code"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              onChange={(event) => setTwoFactorCode(event.target.value.replace(/\s+/g, ""))}
              placeholder="123456"
              required
              type="text"
              value={twoFactorCode}
            />

            <button className="primary-button auth-submit" disabled={busyMethod !== null} type="submit">
              {busyMethod === "mfa" ? "Verifying..." : "Verify authenticator code"}
            </button>

            <button className="ghost-button auth-provider-button" onClick={() => void handleUseDifferentAccount()} type="button">
              Use a different account
            </button>
          </form>
        ) : null}

        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        <div className="auth-oauth-grid">
          <button
            className="ghost-button auth-provider-button"
            disabled={busyMethod !== null || requiresTwoFactor}
            onClick={() => void handleProviderSignIn("google")}
            type="button"
          >
            <Mail size={15} />
            {busyMethod === "google" ? "Connecting..." : "Google"}
          </button>

          <button
            className="ghost-button auth-provider-button"
            disabled={busyMethod !== null || requiresTwoFactor}
            onClick={() => void handleProviderSignIn("github")}
            type="button"
          >
            <GitBranch size={15} />
            {busyMethod === "github" ? "Connecting..." : "GitHub"}
          </button>
        </div>

        <button
          className="auth-toggle"
          disabled={busyMethod !== null || requiresTwoFactor}
          onClick={() => {
            setMode((current) => (current === "signin" ? "signup" : "signin"));
            clearPendingTwoFactorUserId();
            setRequiresTwoFactor(false);
            setTwoFactorCode("");
            setErrorMessage(null);
          }}
          type="button"
        >
          {mode === "signin" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
