const DEFAULT_APP_BASE_URL = "http://127.0.0.1:3000";

const statusEl = document.getElementById("status");
const authBadgeEl = document.getElementById("authBadge");
const detectionBadgeEl = document.getElementById("detectionBadge");
const accountMetaEl = document.getElementById("accountMeta");
const tokenInputEl = document.getElementById("tokenInput");
const saveTokenButton = document.getElementById("saveTokenButton");
const signOutButton = document.getElementById("signOutButton");
const emailSignInFormEl = document.getElementById("emailSignInForm");
const emailInputEl = document.getElementById("emailInput");
const passwordInputEl = document.getElementById("passwordInput");
const togglePasswordButton = document.getElementById("togglePasswordButton");
const emailSignInButton = document.getElementById("emailSignInButton");
const twoFactorFormEl = document.getElementById("twoFactorForm");
const twoFactorInputEl = document.getElementById("twoFactorInput");
const verifyTwoFactorButton = document.getElementById("verifyTwoFactorButton");
const cancelTwoFactorButton = document.getElementById("cancelTwoFactorButton");
const jobTitleEl = document.getElementById("jobTitle");
const jobMetaEl = document.getElementById("jobMeta");
const googleSignInButton = document.getElementById("googleSignInButton");
const githubSignInButton = document.getElementById("githubSignInButton");
const oauthErrorEl = document.getElementById("oauthError");
const setupHelpDetailsEl = document.getElementById("setupHelpDetails");
const redirectUriValueEl = document.getElementById("redirectUriValue");
const copyRedirectUriButton = document.getElementById("copyRedirectUriButton");

let activeTabId = null;
let appBaseUrl = DEFAULT_APP_BASE_URL;
let isAuthenticated = false;
let emailPasswordEnabled = false;
let pendingTwoFactorChallengeId = null;
const browserApi =
  typeof globalThis.browser === "object" ? globalThis.browser : null;
const callbackLastError = () => chrome.runtime?.lastError || null;
const tabsQuery = (queryInfo) =>
  browserApi?.tabs?.query
    ? browserApi.tabs.query(queryInfo)
    : new Promise((resolve, reject) => {
        let settled = false;
        const finish = (tabs) => {
          if (settled) {
            return;
          }

          settled = true;
          resolve(tabs || []);
        };
        const fail = (error) => {
          if (settled) {
            return;
          }

          settled = true;
          reject(error instanceof Error ? error : new Error(String(error)));
        };
        const maybePromise = chrome.tabs.query(queryInfo, (tabs) => {
          const error = callbackLastError();
          if (error) {
            fail(new Error(error.message));
            return;
          }

          finish(tabs);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(finish).catch(fail);
        }
      });

const stripChipStyles = (element) => {
  element.classList.remove("chip-muted", "chip-active", "chip-warning");
};

const setStatus = (value, tone = "muted") => {
  statusEl.textContent = value;
  if (tone === "error") {
    statusEl.style.color = "#ffd5d5";
    return;
  }

  if (tone === "success") {
    statusEl.style.color = "#cbffe8";
    return;
  }

  statusEl.style.color = "#b7c5df";
};

const setAuthBadge = (text, tone) => {
  authBadgeEl.textContent = text;
  stripChipStyles(authBadgeEl);
  authBadgeEl.classList.add(tone);
};

const setDetectionBadge = (text, tone) => {
  detectionBadgeEl.textContent = text;
  stripChipStyles(detectionBadgeEl);
  detectionBadgeEl.classList.add(tone);
};

const setJobPreview = (payload) => {
  if (!payload) {
    jobTitleEl.textContent = "No job detected";
    jobMetaEl.textContent =
      "Open a job details page on LinkedIn, Indeed, or Naukri.";
    setDetectionBadge("No job detected", "chip-muted");
    return;
  }

  jobTitleEl.textContent = payload.title || "Untitled role";
  const meta = [payload.company, payload.location, payload.source]
    .filter(Boolean)
    .join(" / ");
  jobMetaEl.textContent = meta || "Job details detected";
  setDetectionBadge("Job detected", "chip-active");
};

const setTwoFactorMode = (enabled) => {
  pendingTwoFactorChallengeId = enabled ? pendingTwoFactorChallengeId : null;
  twoFactorFormEl.hidden = !enabled;
  emailSignInFormEl.hidden = enabled || isAuthenticated;
  if (enabled) {
    twoFactorInputEl.focus();
  } else {
    twoFactorInputEl.value = "";
  }
};

const sendRuntimeMessage = (message) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response || null);
    });
  });

const withActiveTab = async () => {
  const [tab] = await tabsQuery({ active: true, currentWindow: true });
  if (!tab?.id) {
    return null;
  }

  return tab;
};

const normalizeApiBaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return DEFAULT_APP_BASE_URL;
  }

  return raw.replace(/\/+$/, "");
};

const parseApiBaseUrlFromToken = (rawToken) => {
  try {
    const parsed = JSON.parse(String(rawToken || ""));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const nextUrl =
      typeof parsed.apiBaseUrl === "string"
        ? parsed.apiBaseUrl
        : typeof parsed.baseUrl === "string"
          ? parsed.baseUrl
          : "";
    if (!nextUrl.trim()) {
      return null;
    }

    return normalizeApiBaseUrl(nextUrl);
  } catch {
    return null;
  }
};

const setActionButtonsDisabled = (disabled) => {
  saveTokenButton.disabled = disabled;
  signOutButton.disabled = disabled;
  googleSignInButton.disabled =
    disabled || googleSignInButton.dataset.unavailable === "true";
  githubSignInButton.disabled =
    disabled || githubSignInButton.dataset.unavailable === "true";
  emailSignInButton.disabled = disabled || !emailPasswordEnabled;
  verifyTwoFactorButton.disabled = disabled;
  cancelTwoFactorButton.disabled = disabled;
};

const setAuthUi = (authSummary) => {
  const authenticated = Boolean(authSummary?.authenticated);
  isAuthenticated = authenticated;
  signOutButton.hidden = !authenticated;
  emailSignInFormEl.hidden =
    authenticated || Boolean(pendingTwoFactorChallengeId);
  twoFactorFormEl.hidden = authenticated || !pendingTwoFactorChallengeId;

  if (authenticated) {
    const provider = authSummary?.providerLabel || "CareerOS";
    const email = authSummary?.email
      ? `${authSummary.email} via ${provider}`
      : `Connected via ${provider}`;
    accountMetaEl.textContent = email;
    setAuthBadge("Connected", "chip-active");
  } else {
    accountMetaEl.textContent =
      "Not connected. Continue with Google/GitHub, sign in with email, or paste a token package below.";
    setAuthBadge("Sign in required", "chip-muted");
  }
};

const setOauthError = (message) => {
  if (!message) {
    oauthErrorEl.hidden = true;
    oauthErrorEl.textContent = "";
    return;
  }

  oauthErrorEl.hidden = false;
  oauthErrorEl.textContent = message;
};

const setPasswordVisible = (visible) => {
  passwordInputEl.type = visible ? "text" : "password";
  togglePasswordButton.setAttribute(
    "aria-label",
    visible ? "Hide password" : "Show password",
  );
  togglePasswordButton.setAttribute("aria-pressed", visible ? "true" : "false");
  togglePasswordButton.title = visible ? "Hide password" : "Show password";
  togglePasswordButton.querySelector(".password-toggle-icon-show").hidden =
    visible;
  togglePasswordButton.querySelector(".password-toggle-icon-hide").hidden =
    !visible;
};

const configureProviderButton = (button, providerConfig, label) => {
  const enabled = Boolean(providerConfig?.enabled && providerConfig?.clientId);
  button.dataset.unavailable = enabled ? "false" : "true";
  button.disabled = !enabled;
  button.title = enabled
    ? `Continue with ${label}`
    : `${label} sign-in needs client ID and client secret env vars on this CareerOS deployment. See Setup help below.`;
};

const refreshOauthProviders = async () => {
  try {
    const response = await sendRuntimeMessage({
      type: "CAREEROS_GET_OAUTH_CONFIG",
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not check sign-in options.");
    }

    configureProviderButton(
      googleSignInButton,
      response.providers?.google,
      "Google",
    );
    configureProviderButton(
      githubSignInButton,
      response.providers?.github,
      "GitHub",
    );
    emailPasswordEnabled = Boolean(response.auth?.emailPasswordEnabled);
    emailSignInButton.disabled = !emailPasswordEnabled;
    emailSignInButton.title = emailPasswordEnabled
      ? "Sign in with your CareerOS email and password"
      : "Email/password sign-in needs NEXT_PUBLIC_FIREBASE_API_KEY on the CareerOS deployment.";

    const bothConfigured =
      response.providers?.google?.enabled &&
      response.providers?.github?.enabled;
    if (!bothConfigured && response.redirectUri) {
      redirectUriValueEl.textContent = response.redirectUri;
      setupHelpDetailsEl.hidden = false;
    } else {
      setupHelpDetailsEl.hidden = true;
    }
  } catch (error) {
    // Provider buttons just stay disabled with a generic tooltip - the paste-token fallback still works.
    configureProviderButton(googleSignInButton, null, "Google");
    configureProviderButton(githubSignInButton, null, "GitHub");
    emailPasswordEnabled = false;
    emailSignInButton.disabled = true;
    setOauthError(
      error instanceof Error
        ? error.message
        : "Could not check Google/GitHub sign-in availability.",
    );
  }
};

const handleProviderSignIn = async (provider) => {
  setOauthError(null);
  setActionButtonsDisabled(true);
  setStatus(
    `Opening ${provider === "google" ? "Google" : "GitHub"} sign-in...`,
  );

  try {
    const response = await sendRuntimeMessage({
      type: "CAREEROS_OAUTH_START",
      provider,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Sign-in did not complete.");
    }

    setAuthUi(response.auth);
    setStatus("Signed in. Job capture is ready.", "success");
    await refreshDetection();
    showPromptOnActiveTab();
  } catch (error) {
    setOauthError(
      error instanceof Error ? error.message : "Sign-in did not complete.",
    );
    setStatus("Sign-in did not complete.", "error");
  } finally {
    setActionButtonsDisabled(false);
  }
};

const collectPayloadForTab = (tabId) =>
  new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: "CAREEROS_COLLECT_PAGE" },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response?.payload || null);
      },
    );
  });

const showPromptOnActiveTab = () => {
  if (!activeTabId) {
    return;
  }

  chrome.tabs.sendMessage(activeTabId, { type: "CAREEROS_SHOW_PROMPT" }, () => {
    // No-op.
  });
};

const refreshDetection = async () => {
  const tab = await withActiveTab();
  if (!tab?.id) {
    activeTabId = null;
    setJobPreview(null);
    setStatus("No active browser tab found.");
    return;
  }

  activeTabId = tab.id;

  if (!isAuthenticated) {
    setJobPreview(null);
    setDetectionBadge("Sign in required", "chip-warning");
    setStatus("Sign in to enable job detection.");
    return;
  }

  try {
    const cached = await sendRuntimeMessage({
      type: "CAREEROS_GET_ACTIVE_JOB",
      tabId: tab.id,
    });
    if (cached?.ok && cached?.payload) {
      setJobPreview(cached.payload);
      setStatus("Job detection is active.", "success");
      return;
    }
  } catch {
    // Continue with direct page read.
  }

  const payload = await collectPayloadForTab(tab.id);
  if (!payload) {
    setJobPreview(null);
    setStatus("No job detected on this tab.");
    return;
  }

  setJobPreview(payload);
  setStatus("Job detected on this tab.", "success");
};

const refreshSettings = async () => {
  try {
    const settingsResponse = await sendRuntimeMessage({
      type: "CAREEROS_GET_SETTINGS",
    });
    if (settingsResponse?.ok) {
      if (settingsResponse.settings?.apiBaseUrl) {
        appBaseUrl = normalizeApiBaseUrl(settingsResponse.settings.apiBaseUrl);
      }
    }
  } catch {
    appBaseUrl = DEFAULT_APP_BASE_URL;
  }

  try {
    const authResponse = await sendRuntimeMessage({
      type: "CAREEROS_AUTH_STATUS",
    });
    if (!authResponse?.ok) {
      setAuthUi({ authenticated: false });
      setStatus(
        authResponse?.error || "Could not read extension auth state.",
        "error",
      );
      return;
    }

    setAuthUi(authResponse.auth);
  } catch (error) {
    setAuthUi({ authenticated: false });
    setStatus(
      error instanceof Error
        ? error.message
        : "Could not read extension auth state.",
      "error",
    );
  }
};

const saveTokenPackage = async () => {
  const authToken = tokenInputEl.value.trim();
  if (!authToken) {
    setStatus("Paste token package from CareerOS Settings first.", "error");
    return;
  }

  setActionButtonsDisabled(true);
  setStatus("Saving token package...");

  try {
    const tokenApiBaseUrl = parseApiBaseUrlFromToken(authToken);
    const response = await sendRuntimeMessage({
      type: "CAREEROS_UPDATE_SETTINGS",
      apiBaseUrl: tokenApiBaseUrl || appBaseUrl,
      authToken,
    });

    if (!response?.ok) {
      setStatus(response?.error || "Could not save token package.", "error");
      return;
    }

    if (response.settings?.apiBaseUrl) {
      appBaseUrl = normalizeApiBaseUrl(response.settings.apiBaseUrl);
    }

    tokenInputEl.value = "";

    setAuthUi(response.auth);
    setStatus("Token package saved. Job capture is ready.", "success");
    await refreshDetection();
    showPromptOnActiveTab();
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not save token package.",
      "error",
    );
  } finally {
    setActionButtonsDisabled(false);
  }
};

const signInWithEmailPassword = async (event) => {
  event.preventDefault();
  const email = emailInputEl.value.trim();
  const password = passwordInputEl.value;
  if (!email || !password) {
    setStatus("Enter your email and password.", "error");
    return;
  }

  setOauthError(null);
  setActionButtonsDisabled(true);
  setStatus("Signing in...");

  try {
    const response = await sendRuntimeMessage({
      email,
      password,
      type: "CAREEROS_PASSWORD_SIGN_IN",
    });

    if (response?.code === "TWO_FACTOR_REQUIRED") {
      pendingTwoFactorChallengeId = response.challengeId || null;
      setAuthBadge("2FA required", "chip-warning");
      accountMetaEl.textContent =
        "Enter the 6-digit code from your authenticator app to finish signing in.";
      setPasswordVisible(false);
      setTwoFactorMode(true);
      setStatus("Authenticator code required.", "muted");
      return;
    }

    if (!response?.ok) {
      throw new Error(response?.error || "Could not sign in.");
    }

    passwordInputEl.value = "";
    setPasswordVisible(false);
    setTwoFactorMode(false);
    setAuthUi(response.auth);
    setStatus("Signed in. Job capture is ready.", "success");
    await refreshDetection();
    showPromptOnActiveTab();
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not sign in.",
      "error",
    );
  } finally {
    setActionButtonsDisabled(false);
  }
};

const verifyTwoFactorCode = async (event) => {
  event.preventDefault();
  const token = twoFactorInputEl.value.trim();
  if (!pendingTwoFactorChallengeId) {
    setStatus("Sign-in attempt expired. Enter your password again.", "error");
    setTwoFactorMode(false);
    return;
  }

  if (!/^\d{6}$/.test(token)) {
    setStatus("Enter a valid 6-digit authenticator code.", "error");
    return;
  }

  setActionButtonsDisabled(true);
  setStatus("Verifying authenticator code...");

  try {
    const response = await sendRuntimeMessage({
      challengeId: pendingTwoFactorChallengeId,
      token,
      type: "CAREEROS_PASSWORD_2FA_VERIFY",
    });

    if (!response?.ok) {
      throw new Error(
        response?.error || "Could not verify authenticator code.",
      );
    }

    passwordInputEl.value = "";
    setPasswordVisible(false);
    twoFactorInputEl.value = "";
    setTwoFactorMode(false);
    setAuthUi(response.auth);
    setStatus("Signed in. Job capture is ready.", "success");
    await refreshDetection();
    showPromptOnActiveTab();
  } catch (error) {
    setStatus(
      error instanceof Error
        ? error.message
        : "Could not verify authenticator code.",
      "error",
    );
  } finally {
    setActionButtonsDisabled(false);
  }
};

const cancelTwoFactor = async () => {
  if (pendingTwoFactorChallengeId) {
    await sendRuntimeMessage({
      challengeId: pendingTwoFactorChallengeId,
      type: "CAREEROS_PASSWORD_2FA_CANCEL",
    }).catch(() => null);
  }

  setTwoFactorMode(false);
  setAuthUi({ authenticated: false });
  setStatus("Two-factor sign-in cancelled.");
};

const clearTokenPackage = async () => {
  setActionButtonsDisabled(true);
  setStatus("Signing out...");
  try {
    const response = await sendRuntimeMessage({
      type: "CAREEROS_AUTH_SIGN_OUT",
    });
    if (!response?.ok) {
      setStatus(response?.error || "Could not sign out.", "error");
      return;
    }

    tokenInputEl.value = "";
    passwordInputEl.value = "";
    setPasswordVisible(false);
    twoFactorInputEl.value = "";
    setTwoFactorMode(false);
    setAuthUi({ authenticated: false });
    setOauthError("");
    setJobPreview(null);
    setStatus("Signed out.");
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not sign out.",
      "error",
    );
  } finally {
    setActionButtonsDisabled(false);
    await refreshDetection();
  }
};

const handleTabActivated = () => {
  void refreshDetection();
};

const handleTabUpdated = (_tabId, changeInfo, tab) => {
  if (!tab?.active) {
    return;
  }

  if (changeInfo.status === "complete" || typeof changeInfo.url === "string") {
    void refreshDetection();
  }
};

const bootstrap = async () => {
  setStatus("Checking extension status...");
  await refreshSettings();
  await refreshOauthProviders();
  await refreshDetection();
};

saveTokenButton.addEventListener("click", () => {
  void saveTokenPackage();
});

emailSignInFormEl.addEventListener("submit", (event) => {
  void signInWithEmailPassword(event);
});

togglePasswordButton.addEventListener("click", () => {
  setPasswordVisible(passwordInputEl.type === "password");
});

twoFactorFormEl.addEventListener("submit", (event) => {
  void verifyTwoFactorCode(event);
});

cancelTwoFactorButton.addEventListener("click", () => {
  void cancelTwoFactor();
});

signOutButton.addEventListener("click", () => {
  void clearTokenPackage();
});

googleSignInButton.addEventListener("click", () => {
  void handleProviderSignIn("google");
});

githubSignInButton.addEventListener("click", () => {
  void handleProviderSignIn("github");
});

copyRedirectUriButton.addEventListener("click", () => {
  void (async () => {
    try {
      await navigator.clipboard.writeText(redirectUriValueEl.textContent || "");
      setStatus("Redirect URI copied.", "success");
    } catch {
      setStatus("Could not copy redirect URI.", "error");
    }
  })();
});

tokenInputEl.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    void saveTokenPackage();
  }
});

chrome.tabs.onActivated.addListener(handleTabActivated);
chrome.tabs.onUpdated.addListener(handleTabUpdated);
window.addEventListener("unload", () => {
  chrome.tabs.onActivated.removeListener(handleTabActivated);
  chrome.tabs.onUpdated.removeListener(handleTabUpdated);
});

void bootstrap().catch((error) => {
  setStatus(
    error instanceof Error
      ? error.message
      : "Could not initialize extension popup.",
    "error",
  );
});
