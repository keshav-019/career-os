"use client";

import { GitBranch, Mail, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";
import { auth, isFirebaseClientConfigured } from "@/lib/firebase/client";

type AuthMethod = "email" | "google" | "github" | null;

function getAuthErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    switch (error.code) {
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
      default:
        return "Authentication failed. Please try again.";
    }
  }

  return "Authentication failed. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busyMethod, setBusyMethod] = useState<AuthMethod>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submitLabel = useMemo(
    () => (mode === "signin" ? "Sign in with email" : "Create account"),
    [mode]
  );

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/");
      }
    });

    return unsubscribe;
  }, [router]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!auth) {
      setErrorMessage("Firebase auth is not configured.");
      return;
    }

    setBusyMethod("email");
    setErrorMessage(null);

    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace("/");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
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

    try {
      if (providerName === "google") {
        await signInWithPopup(auth, new GoogleAuthProvider());
      } else {
        const githubProvider = new GithubAuthProvider();
        githubProvider.addScope("read:user");
        githubProvider.addScope("user:email");
        await signInWithPopup(auth, githubProvider);
      }
      router.replace("/");
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setBusyMethod(null);
    }
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

        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        <div className="auth-oauth-grid">
          <button
            className="ghost-button auth-provider-button"
            disabled={busyMethod !== null}
            onClick={() => void handleProviderSignIn("google")}
            type="button"
          >
            <Mail size={15} />
            {busyMethod === "google" ? "Connecting..." : "Google"}
          </button>

          <button
            className="ghost-button auth-provider-button"
            disabled={busyMethod !== null}
            onClick={() => void handleProviderSignIn("github")}
            type="button"
          >
            <GitBranch size={15} />
            {busyMethod === "github" ? "Connecting..." : "GitHub"}
          </button>
        </div>

        <button
          className="auth-toggle"
          disabled={busyMethod !== null}
          onClick={() => {
            setMode((current) => (current === "signin" ? "signup" : "signin"));
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
