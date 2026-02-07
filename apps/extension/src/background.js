const STORAGE_KEYS = {
  apiBaseUrl: "careeros_api_base_url",
  authRaw: "careeros_auth_raw",
  authState: "careeros_auth_state",
};

const TOKEN_REFRESH_MARGIN_MS = 30 * 1000;
const TWO_FACTOR_SESSION_HEADER = "x-2fa-session";
const detectionByTab = new Map();
const pendingPasswordAuthById = new Map();
const LOCAL_API_BASE_URLS = ["http://127.0.0.1:3000", "http://localhost:3000"];
// The deployed web app - used as the real default so a fresh install (nothing saved in Settings yet) works out
// of the box, instead of only ever succeeding when a local dev server happens to be running on port 3000.
const PRODUCTION_API_BASE_URL = "https://keshav-019-career-os.vercel.app";
const DEFAULT_API_BASE_URL = PRODUCTION_API_BASE_URL;
const TRUSTED_HTTPS_HOST_PATTERNS = [
  /(^|\.)careeros\.app$/i,
  /^career-os(?:[-.][a-z0-9-]+)*\.vercel\.app$/i,
];
const browserApi =
  typeof globalThis.browser === "object" ? globalThis.browser : null;
const callbackLastError = () => chrome.runtime?.lastError || null;
const callbackApi = (fn, context, args = []) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };
    const fail = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const maybePromise = fn.call(context, ...args, (result) => {
      const error = callbackLastError();
      if (error) {
        fail(new Error(error.message));
        return;
      }

      finish(result);
    });
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.then(finish).catch(fail);
    }
  });
const storageGet = (keys) =>
  browserApi?.storage?.local?.get
    ? browserApi.storage.local.get(keys)
    : callbackApi(chrome.storage.local.get, chrome.storage.local, [keys]);
const storageSet = (values) =>
  browserApi?.storage?.local?.set
    ? browserApi.storage.local.set(values)
    : callbackApi(chrome.storage.local.set, chrome.storage.local, [values]);
const tabsQuery = (queryInfo) =>
  browserApi?.tabs?.query
    ? browserApi.tabs.query(queryInfo)
    : callbackApi(chrome.tabs.query, chrome.tabs, [queryInfo]);
const actionApi =
  browserApi?.action ||
  browserApi?.browserAction ||
  chrome.action ||
  chrome.browserAction;
const actionCall = (methodName, args) => {
  const method = actionApi?.[methodName];
  if (!method) {
    return Promise.resolve();
  }

  if (browserApi?.action || browserApi?.browserAction) {
    return method.call(actionApi, args);
  }

  return callbackApi(method, actionApi, [args]);
};

const isTrustedHttpsHost = (hostname) =>
  TRUSTED_HTTPS_HOST_PATTERNS.some((pattern) => pattern.test(hostname));

const isAllowedApiBaseUrl = (candidate) => {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:") {
      return isTrustedHttpsHost(parsed.hostname);
    }

    if (parsed.protocol !== "http:") {
      return false;
    }

    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const normalizeApiBaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return DEFAULT_API_BASE_URL;
  }

  const normalized = raw.replace(/\/+$/, "");
  return isAllowedApiBaseUrl(normalized) ? normalized : DEFAULT_API_BASE_URL;
};

const readFallbackApiBaseUrls = (primaryUrl) => {
  const values = [normalizeApiBaseUrl(primaryUrl), ...LOCAL_API_BASE_URLS, PRODUCTION_API_BASE_URL];
  return Array.from(new Set(values));
};

const decodeTokenExpiryMs = (idToken) => {
  const token = String(idToken || "");
  const [, payloadRaw] = token.split(".");
  if (!payloadRaw) {
    return null;
  }

  try {
    const normalizedPayload = payloadRaw.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "=",
    );
    const decodedPayload = JSON.parse(atob(paddedPayload));
    if (typeof decodedPayload.exp !== "number") {
      return null;
    }

    return decodedPayload.exp * 1000;
  } catch {
    return null;
  }
};

const normalizeAuthState = (input) => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input;
  const idToken =
    typeof candidate.idToken === "string" ? candidate.idToken.trim() : "";
  const refreshToken =
    typeof candidate.refreshToken === "string"
      ? candidate.refreshToken.trim()
      : "";
  const apiKey =
    typeof candidate.apiKey === "string" ? candidate.apiKey.trim() : "";
  const email =
    typeof candidate.email === "string" ? candidate.email.trim() : "";
  const providerId =
    typeof candidate.providerId === "string" ? candidate.providerId.trim() : "";
  const twoFactorSessionToken =
    typeof candidate.twoFactorSessionToken === "string"
      ? candidate.twoFactorSessionToken.trim()
      : "";
  const twoFactorSessionExpiresAt =
    typeof candidate.twoFactorSessionExpiresAt === "string"
      ? candidate.twoFactorSessionExpiresAt.trim()
      : "";
  const userId =
    typeof candidate.userId === "string" ? candidate.userId.trim() : "";
  const expiresAtMs =
    typeof candidate.expiresAtMs === "number" &&
      Number.isFinite(candidate.expiresAtMs)
      ? candidate.expiresAtMs
      : decodeTokenExpiryMs(idToken);

  if (!idToken && !refreshToken) {
    return null;
  }

  return {
    apiKey,
    email,
    expiresAtMs,
    idToken,
    providerId,
    refreshToken,
    twoFactorSessionExpiresAt,
    twoFactorSessionToken,
    userId,
  };
};

const parseAuthInput = (rawValue) => {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return {
      authRaw: "",
      authState: null,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const authState = normalizeAuthState(parsed);
    if (authState) {
      return {
        authRaw: raw,
        authState,
      };
    }
  } catch {
    // Fall through to plain token mode.
  }

  return {
    authRaw: raw,
    authState: normalizeAuthState({ idToken: raw }),
  };
};

const readSettings = async () => {
  const stored = await storageGet([
    STORAGE_KEYS.apiBaseUrl,
    STORAGE_KEYS.authRaw,
    STORAGE_KEYS.authState,
  ]) || {};

  const legacyRaw = String(stored[STORAGE_KEYS.authRaw] || "").trim();
  const authState =
    normalizeAuthState(stored[STORAGE_KEYS.authState]) ||
    parseAuthInput(legacyRaw).authState;

  return {
    apiBaseUrl: normalizeApiBaseUrl(stored[STORAGE_KEYS.apiBaseUrl]),
    authState,
  };
};

const rememberApiBaseUrl = async (apiBaseUrl) => {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  await storageSet({
    [STORAGE_KEYS.apiBaseUrl]: normalizedApiBaseUrl,
  });

  return normalizedApiBaseUrl;
};

const hasUsableAuthState = (authState) => {
  if (!authState?.idToken) {
    return false;
  }

  if (!authState.expiresAtMs) {
    return true;
  }

  if (authState.expiresAtMs - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return true;
  }

  return Boolean(authState.refreshToken && authState.apiKey);
};

const normalizeProviderId = (providerId) => {
  const value = String(providerId || "").trim();
  if (value) {
    return value;
  }

  return "token";
};

const mapProviderLabel = (providerId) => {
  const normalized = normalizeProviderId(providerId);
  if (normalized === "google.com") {
    return "Google";
  }

  if (normalized === "github.com") {
    return "GitHub";
  }

  if (normalized === "password") {
    return "Email + Password";
  }

  if (normalized === "token") {
    return "Token package";
  }

  return "CareerOS";
};

const toAuthSummary = (authState, authenticated) => ({
  authenticated: Boolean(authenticated),
  email: authState?.email || "",
  expiresAtMs:
    typeof authState?.expiresAtMs === "number" ? authState.expiresAtMs : null,
  providerId: normalizeProviderId(authState?.providerId),
  providerLabel: mapProviderLabel(authState?.providerId),
  twoFactorVerified: Boolean(authState?.twoFactorSessionToken),
  userId: authState?.userId || "",
});

const writeSettings = async (nextSettings) => {
  await storageSet(nextSettings);
  if (
    Object.prototype.hasOwnProperty.call(nextSettings, STORAGE_KEYS.authState)
  ) {
    // Clear legacy/raw token payloads once parsed to reduce secret duplication in extension storage.
    await storageSet({
      [STORAGE_KEYS.authRaw]: "",
    });
  }

  return readSettings();
};

const setBadgeForTab = async (tabId, detected) => {
  if (!tabId) {
    return;
  }

  await actionCall("setBadgeBackgroundColor", {
    color: detected ? "#14916f" : "#4e5b70",
    tabId,
  });
  await actionCall("setBadgeText", {
    text: detected ? "JOB" : "",
    tabId,
  });
  await actionCall("setTitle", {
    title: detected
      ? "CareerOS job detected. Click to save."
      : "CareerOS Capture",
    tabId,
  });
};

const refreshIdToken = async (authState) => {
  if (!authState?.refreshToken || !authState?.apiKey) {
    return null;
  }

  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(authState.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: authState.refreshToken,
      }).toString(),
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const nextState = normalizeAuthState({
    apiKey: authState.apiKey,
    email: payload.email || authState.email,
    expiresAtMs:
      typeof payload.expires_in === "string" &&
        Number.isFinite(Number(payload.expires_in))
        ? Date.now() + Number(payload.expires_in) * 1000
        : undefined,
    idToken: payload.id_token,
    providerId: authState.providerId,
    refreshToken: payload.refresh_token || authState.refreshToken,
    twoFactorSessionExpiresAt: authState.twoFactorSessionExpiresAt,
    twoFactorSessionToken: authState.twoFactorSessionToken,
    userId: payload.user_id || authState.userId,
  });

  if (!nextState) {
    return null;
  }

  await storageSet({
    [STORAGE_KEYS.authState]: nextState,
  });

  return nextState.idToken;
};

const getValidAuthToken = async () => {
  const settings = await readSettings();
  const authState = settings.authState;
  if (!authState?.idToken) {
    return null;
  }

  const nowMs = Date.now();
  if (
    authState.expiresAtMs &&
    authState.expiresAtMs - TOKEN_REFRESH_MARGIN_MS > nowMs
  ) {
    return authState.idToken;
  }

  const refreshedToken = await refreshIdToken(authState);
  return refreshedToken || authState.idToken;
};

const validateAuthState = async (apiBaseUrl, authState) => {
  if (!authState?.idToken) {
    return {
      apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
      valid: false,
    };
  }

  const idToken =
    authState.expiresAtMs &&
    authState.expiresAtMs - TOKEN_REFRESH_MARGIN_MS <= Date.now()
      ? await refreshIdToken(authState)
      : authState.idToken;

  let lastError = null;
  for (const baseUrl of readFallbackApiBaseUrls(apiBaseUrl)) {
    try {
      const response = await fetch(`${baseUrl}/api/2fa/session`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken || authState.idToken}`,
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          apiBaseUrl: baseUrl,
          valid: true,
        };
      }

      if (response.status === 401 && Boolean(payload?.required)) {
        return {
          apiBaseUrl: baseUrl,
          valid: true,
        };
      }

      return {
        apiBaseUrl: baseUrl,
        valid: false,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("That token package could not be verified with CareerOS.");
};

const signOut = async () => {
  await storageSet({
    [STORAGE_KEYS.authRaw]: "",
    [STORAGE_KEYS.authState]: null,
  });

  detectionByTab.clear();
  pendingPasswordAuthById.clear();
  const tabs = await tabsQuery({});
  await Promise.all(
    tabs
      .map((tab) => tab.id)
      .filter(Boolean)
      .map((tabId) => setBadgeForTab(tabId, false)),
  );

  return {
    ok: true,
  };
};

const getAuthStatus = async () => {
  const token = await getValidAuthToken();
  const settings = await readSettings();
  return {
    auth: toAuthSummary(settings.authState, Boolean(token)),
    ok: true,
  };
};

const saveJob = async (payload) => {
  const idToken = await getValidAuthToken();
  const settings = await readSettings();
  if (!idToken) {
    return {
      code: "AUTH_REQUIRED",
      error:
        "Paste your extension token package in the popup before saving jobs.",
      ok: false,
    };
  }

  const headers = {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };
  if (settings.authState?.twoFactorSessionToken) {
    headers[TWO_FACTOR_SESSION_HEADER] = settings.authState.twoFactorSessionToken;
  }

  const response = await fetch(`${settings.apiBaseUrl}/api/jobs/import`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      code: body?.code || (response.status === 401 ? "AUTH_REQUIRED" : "IMPORT_FAILED"),
      error: body?.error || "Failed to save job.",
      ok: false,
    };
  }

  return {
    body,
    ok: true,
  };
};

/**
 * "Continue with Google/GitHub" - see apps/web/src/app/api/extension/oauth/[provider]/route.ts for the server
 * half of this flow. The extension never holds a client secret: chrome.identity.launchWebAuthFlow only ever
 * hands us back a short-lived authorization CODE, which we immediately forward to our own backend to exchange
 * for a real Firebase session.
 */

const buildAuthorizeUrl = (provider, clientId, redirectUri) => {
  if (provider === "google") {
    const params = new URLSearchParams({
      access_type: "online",
      client_id: clientId,
      prompt: "select_account",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  const params = new URLSearchParams({
    allow_signup: "true",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

const getExtensionRedirectUri = () => {
  const redirectUri = chrome.identity.getRedirectURL();
  try {
    const parsed = new URL(redirectUri);
    if (
      parsed.protocol === "https:" &&
      parsed.hostname &&
      !parsed.hostname.endsWith(".chromiumapp.org")
    ) {
      const [subdomain] = parsed.hostname.split(".");
      if (subdomain) {
        return `http://127.0.0.1/mozoauth2/${subdomain}`;
      }
    }
  } catch {
    // Fall back to the browser-provided redirect URI.
  }

  return redirectUri;
};

const fetchExtensionConfig = async (apiBaseUrl) => {
  let lastError = null;
  const normalizedPrimaryUrl = normalizeApiBaseUrl(apiBaseUrl);
  for (const baseUrl of readFallbackApiBaseUrls(apiBaseUrl)) {
    try {
      const response = await fetch(`${baseUrl}/api/extension/oauth-config`);
      if (!response.ok) {
        throw new Error("Could not reach CareerOS to check sign-in options.");
      }

      const payload = await response.json().catch(() => ({}));
      if (!payload?.ok) {
        throw new Error("Could not read CareerOS sign-in configuration.");
      }

      if (baseUrl !== normalizedPrimaryUrl) {
        await rememberApiBaseUrl(baseUrl);
      }

      return {
        ...payload,
        apiBaseUrl: baseUrl,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not reach CareerOS to check sign-in options.");
};

const mapPasswordSignInError = (errorMessage) => {
  const message = String(errorMessage || "");
  if (
    message.includes("EMAIL_NOT_FOUND") ||
    message.includes("INVALID_PASSWORD") ||
    message.includes("INVALID_LOGIN_CREDENTIALS")
  ) {
    return "Incorrect email or password.";
  }

  if (message.includes("USER_DISABLED")) {
    return "This account is disabled.";
  }

  if (message.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
    return "Too many sign-in attempts. Please wait and try again.";
  }

  if (message.includes("OPERATION_NOT_ALLOWED")) {
    return "Email/password sign-in is not enabled in Firebase Authentication.";
  }

  if (message.includes("INVALID_EMAIL")) {
    return "Enter a valid email address.";
  }

  return "Could not sign in with that email and password.";
};

const createPendingChallengeId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const buildFirebaseAuthState = (payload, apiKey, providerId) =>
  normalizeAuthState({
    apiKey,
    email: payload.email || "",
    expiresAtMs:
      typeof payload.expiresIn === "string" &&
        Number.isFinite(Number(payload.expiresIn))
        ? Date.now() + Number(payload.expiresIn) * 1000
        : undefined,
    idToken: payload.idToken,
    providerId,
    refreshToken: payload.refreshToken || "",
    userId: payload.localId || "",
  });

const signInWithPassword = async (apiKey, email, password) => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.idToken) {
    throw new Error(mapPasswordSignInError(payload?.error?.message));
  }

  return payload;
};

const readTwoFactorSession = async (apiBaseUrl, authState) => {
  const headers = {
    Authorization: `Bearer ${authState.idToken}`,
  };
  if (authState.twoFactorSessionToken) {
    headers[TWO_FACTOR_SESSION_HEADER] = authState.twoFactorSessionToken;
  }

  const response = await fetch(`${apiBaseUrl}/api/2fa/session`, {
    headers,
    method: "GET",
  });
  const payload = await response.json().catch(() => ({}));

  if (response.ok) {
    return {
      expiresAtMs: payload.expiresAtMs || null,
      required: Boolean(payload.required),
      valid: Boolean(payload.valid),
    };
  }

  if (response.status === 401 && payload?.required) {
    return {
      reason: payload.reason || "missing",
      required: true,
      valid: false,
    };
  }

  throw new Error(payload?.error || "Could not validate two-factor session.");
};

const storeAuthenticatedState = async (authState) => {
  await storageSet({
    [STORAGE_KEYS.authState]: authState,
    [STORAGE_KEYS.authRaw]: "",
  });

  return {
    auth: toAuthSummary(authState, hasUsableAuthState(authState)),
    ok: true,
  };
};

const startPasswordSignIn = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  if (!normalizedEmail || !rawPassword) {
    return {
      code: "INVALID_PASSWORD_INPUT",
      error: "Enter your email and password.",
      ok: false,
    };
  }

  const settings = await readSettings();
  const config = await fetchExtensionConfig(settings.apiBaseUrl);
  const apiBaseUrl = normalizeApiBaseUrl(config.apiBaseUrl || settings.apiBaseUrl);
  await rememberApiBaseUrl(apiBaseUrl);
  const firebaseApiKey = String(config?.auth?.firebaseApiKey || "").trim();
  if (!firebaseApiKey) {
    return {
      code: "FIREBASE_AUTH_NOT_CONFIGURED",
      error:
        "Email/password sign-in is not configured on this CareerOS deployment.",
      ok: false,
    };
  }

  const payload = await signInWithPassword(
    firebaseApiKey,
    normalizedEmail,
    rawPassword,
  );
  const authState = buildFirebaseAuthState(payload, firebaseApiKey, "password");
  if (!authState) {
    throw new Error("CareerOS did not return a usable password session.");
  }

  const twoFactorStatus = await readTwoFactorSession(
    apiBaseUrl,
    authState,
  );
  if (twoFactorStatus.required && !twoFactorStatus.valid) {
    const challengeId = createPendingChallengeId();
    pendingPasswordAuthById.set(challengeId, {
      apiBaseUrl,
      authState,
      createdAtMs: Date.now(),
    });

    return {
      auth: toAuthSummary(authState, false),
      challengeId,
      code: "TWO_FACTOR_REQUIRED",
      error: "Enter the 6-digit authenticator code for this account.",
      ok: false,
    };
  }

  return storeAuthenticatedState(authState);
};

const verifyPasswordTwoFactor = async ({ challengeId, token }) => {
  const normalizedToken = String(token || "").trim();
  if (!/^\d{6}$/.test(normalizedToken)) {
    return {
      code: "INVALID_2FA_INPUT",
      error: "Enter a valid 6-digit authenticator code.",
      ok: false,
    };
  }

  const pendingAuth = pendingPasswordAuthById.get(String(challengeId || ""));
  if (!pendingAuth) {
    return {
      code: "TWO_FACTOR_CHALLENGE_EXPIRED",
      error: "This sign-in attempt expired. Please enter your password again.",
      ok: false,
    };
  }

  const response = await fetch(`${pendingAuth.apiBaseUrl}/api/2fa/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pendingAuth.authState.idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: normalizedToken }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      code: payload?.code || "TWO_FACTOR_FAILED",
      error: payload?.error || "Failed to verify authenticator code.",
      ok: false,
    };
  }

  if (!payload?.verified || !payload?.twoFactorSessionToken) {
    return {
      code: "TWO_FACTOR_FAILED",
      error: "Invalid authenticator code. Please try again.",
      ok: false,
    };
  }

  const authState = normalizeAuthState({
    ...pendingAuth.authState,
    twoFactorSessionExpiresAt: payload.twoFactorSessionExpiresAt || "",
    twoFactorSessionToken: payload.twoFactorSessionToken,
  });
  if (!authState) {
    throw new Error("Authenticator verification succeeded, but session setup failed.");
  }

  pendingPasswordAuthById.delete(String(challengeId || ""));
  return storeAuthenticatedState(authState);
};

const cancelPasswordTwoFactor = (challengeId) => {
  pendingPasswordAuthById.delete(String(challengeId || ""));
  return {
    ok: true,
  };
};

const extractCodeFromRedirect = (redirectUrl) => {
  const url = new URL(redirectUrl);
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    throw new Error(url.searchParams.get("error_description") || errorParam);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error("Sign-in did not return an authorization code.");
  }

  return code;
};

const launchProviderAuthFlow = (authorizeUrl, redirectUri) =>
  new Promise((resolve, reject) => {
    const details = { interactive: true, url: authorizeUrl };
    if (redirectUri.startsWith("http://127.0.0.1/mozoauth2/")) {
      details.redirect_uri = redirectUri;
    }

    chrome.identity.launchWebAuthFlow(
      details,
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(
            new Error(
              chrome.runtime.lastError?.message ||
                "Sign-in was cancelled or the popup was blocked.",
            ),
          );
          return;
        }

        resolve(responseUrl);
      },
    );
  });

/**
 * Chrome-only native flow for Google, using chrome.identity.getAuthToken() instead of launchWebAuthFlow.
 * Chrome validates this directly against the extension's own published Chrome Web Store ID (see manifest.json's
 * "oauth2" key) - no redirect_uri, no authorization code, no client secret anywhere in this flow, which sidesteps
 * the ID-mismatch problem launchWebAuthFlow has: its redirect_uri is derived from the extension's *runtime* ID
 * (chrome.identity.getRedirectURL()), which differs between an unpacked dev install (fixed dev-key ID) and the
 * published Store version (Store-assigned ID) - whichever OAuth client you register a redirect URI against, the
 * other install method breaks. getAuthToken() has no such split: Chrome verifies the calling extension's real
 * identity itself, so it works correctly from the Store-installed copy regardless of how it's tested locally.
 *
 * Firefox has no equivalent API (falls through to the launchWebAuthFlow path below), and GitHub has no
 * extension-aware OAuth client type at all, so both keep using launchWebAuthFlow regardless of browser.
 */
const startGoogleSignInChromeNative = async (apiBaseUrl) => {
  const result = await callbackApi(chrome.identity.getAuthToken, chrome.identity, [{ interactive: true }]);
  const accessToken = typeof result === "string" ? result : result?.token;
  if (!accessToken) {
    throw new Error("Google sign-in did not return an access token.");
  }

  const exchangeResponse = await fetch(`${apiBaseUrl}/api/extension/oauth/google-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

  const exchangePayload = await exchangeResponse.json().catch(() => ({}));
  if (!exchangeResponse.ok || !exchangePayload?.ok) {
    // Drop a stale/invalid cached token so the next attempt gets a fresh one instead of repeating the same
    // failure indefinitely.
    chrome.identity.removeCachedAuthToken({ token: accessToken }, () => {});
    throw new Error(exchangePayload?.error || "Could not complete sign-in.");
  }

  const authState = normalizeAuthState(exchangePayload.auth);
  if (!authState) {
    throw new Error("CareerOS did not return a usable session.");
  }

  await storageSet({
    [STORAGE_KEYS.authState]: authState,
    [STORAGE_KEYS.authRaw]: "",
  });

  return {
    auth: toAuthSummary(authState, hasUsableAuthState(authState)),
    ok: true,
  };
};

const IS_CHROME_NATIVE_IDENTITY =
  !browserApi && typeof chrome !== "undefined" && typeof chrome.identity?.getAuthToken === "function";

const startOauthSignIn = async (provider) => {
  if (provider !== "google" && provider !== "github") {
    throw new Error(`Unsupported provider "${provider}".`);
  }

  const settings = await readSettings();
  const config = await fetchExtensionConfig(settings.apiBaseUrl);
  const apiBaseUrl = normalizeApiBaseUrl(config.apiBaseUrl || settings.apiBaseUrl);
  await rememberApiBaseUrl(apiBaseUrl);

  if (provider === "google" && IS_CHROME_NATIVE_IDENTITY) {
    return startGoogleSignInChromeNative(apiBaseUrl);
  }

  const providers = config.providers;
  const providerConfig = providers?.[provider];
  if (!providerConfig?.enabled || !providerConfig.clientId) {
    const label = provider === "google" ? "Google" : "GitHub";
    throw new Error(
      `${label} sign-in isn't configured yet on this CareerOS deployment. Paste a token package instead, or ask whoever manages CareerOS to finish setup.`,
    );
  }

  const redirectUri = getExtensionRedirectUri();
  const authorizeUrl = buildAuthorizeUrl(
    provider,
    providerConfig.clientId,
    redirectUri,
  );
  const redirectResult = await launchProviderAuthFlow(authorizeUrl, redirectUri);
  const code = extractCodeFromRedirect(redirectResult);

  const exchangeResponse = await fetch(
    `${apiBaseUrl}/api/extension/oauth/${provider}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirectUri }),
    },
  );

  const exchangePayload = await exchangeResponse.json().catch(() => ({}));
  if (!exchangeResponse.ok || !exchangePayload?.ok) {
    throw new Error(exchangePayload?.error || "Could not complete sign-in.");
  }

  const authState = normalizeAuthState(exchangePayload.auth);
  if (!authState) {
    throw new Error("CareerOS did not return a usable session.");
  }

  await storageSet({
    [STORAGE_KEYS.authState]: authState,
    [STORAGE_KEYS.authRaw]: "",
  });

  return {
    auth: toAuthSummary(authState, hasUsableAuthState(authState)),
    ok: true,
  };
};

chrome.tabs.onRemoved.addListener((tabId) => {
  detectionByTab.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAREEROS_JOB_DETECTED") {
    const tabId = sender.tab?.id;
    readSettings()
      .then((settings) => {
        const authenticated = hasUsableAuthState(settings.authState);
        if (tabId) {
          if (message.payload && authenticated) {
            detectionByTab.set(tabId, message.payload);
            void setBadgeForTab(tabId, true);
          } else {
            detectionByTab.delete(tabId);
            void setBadgeForTab(tabId, false);
          }
        }

        sendResponse({
          authenticated,
          ok: true,
        });
      })
      .catch((error) =>
        sendResponse({
          authenticated: false,
          error: error.message,
          ok: false,
        }),
      );
    return true;
  }

  if (message.type === "CAREEROS_GET_ACTIVE_JOB") {
    const tabId = message.tabId;
    sendResponse({
      ok: true,
      payload: tabId ? detectionByTab.get(tabId) || null : null,
    });
    return true;
  }

  if (message.type === "CAREEROS_IS_AUTHENTICATED") {
    readSettings()
      .then((settings) =>
        sendResponse({
          authenticated: hasUsableAuthState(settings.authState),
          ok: true,
        }),
      )
      .catch((error) =>
        sendResponse({ authenticated: false, error: error.message, ok: false }),
      );
    return true;
  }

  if (message.type === "CAREEROS_AUTH_STATUS") {
    getAuthStatus()
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          auth: toAuthSummary(null, false),
          error: error.message,
          ok: false,
        }),
      );
    return true;
  }

  if (message.type === "CAREEROS_AUTH_SIGN_OUT") {
    signOut()
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          error: error.message,
          ok: false,
        }),
      );
    return true;
  }

  if (message.type === "CAREEROS_GET_SETTINGS") {
    readSettings()
      .then((settings) =>
        sendResponse({
          ok: true,
          settings: {
            apiBaseUrl: settings.apiBaseUrl,
          },
          auth: toAuthSummary(
            settings.authState,
            hasUsableAuthState(settings.authState),
          ),
        }),
      )
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CAREEROS_UPDATE_SETTINGS") {
    const nextApiBaseUrl = normalizeApiBaseUrl(message.apiBaseUrl);
    const nextSettings = {
      [STORAGE_KEYS.apiBaseUrl]: nextApiBaseUrl,
    };

  if (Object.prototype.hasOwnProperty.call(message, "authToken")) {
    const parsed = parseAuthInput(message.authToken);
    if (!parsed.authState) {
      sendResponse({
        error: "Paste a valid CareerOS extension token package.",
        ok: false,
      });
      return true;
    }

    validateAuthState(nextApiBaseUrl, parsed.authState)
      .then((validation) => {
        if (!validation.valid) {
          sendResponse({
            error: "That token package could not be verified with CareerOS.",
            ok: false,
          });
          return;
        }

        nextSettings[STORAGE_KEYS.apiBaseUrl] = normalizeApiBaseUrl(
          validation.apiBaseUrl || nextApiBaseUrl,
        );
        nextSettings[STORAGE_KEYS.authRaw] = "";
        nextSettings[STORAGE_KEYS.authState] = parsed.authState;
        writeSettings(nextSettings)
          .then((settings) =>
            sendResponse({
              ok: true,
              settings: {
                apiBaseUrl: settings.apiBaseUrl,
              },
              auth: toAuthSummary(
                settings.authState,
                hasUsableAuthState(settings.authState),
              ),
            }),
          )
          .catch((error) => sendResponse({ ok: false, error: error.message }));
      })
      .catch((error) =>
        sendResponse({
          error:
            error instanceof Error
              ? error.message
              : "That token package could not be verified with CareerOS.",
          ok: false,
        }),
      );
    return true;
  }

  writeSettings(nextSettings)
    .then((settings) =>
      sendResponse({
        ok: true,
        settings: {
          apiBaseUrl: settings.apiBaseUrl,
        },
        auth: toAuthSummary(
          settings.authState,
          hasUsableAuthState(settings.authState),
        ),
      }),
    )
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
  }

  if (message.type === "CAREEROS_OAUTH_START") {
    startOauthSignIn(message.provider)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          error: error.message,
          ok: false,
        }),
      );
    return true;
  }

  if (message.type === "CAREEROS_PASSWORD_SIGN_IN") {
    startPasswordSignIn({
      email: message.email,
      password: message.password,
    })
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          code: "PASSWORD_SIGN_IN_FAILED",
          error: error.message,
          ok: false,
        }),
      );
    return true;
  }

  if (message.type === "CAREEROS_PASSWORD_2FA_VERIFY") {
    verifyPasswordTwoFactor({
      challengeId: message.challengeId,
      token: message.token,
    })
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          code: "TWO_FACTOR_FAILED",
          error: error.message,
          ok: false,
        }),
      );
    return true;
  }

  if (message.type === "CAREEROS_PASSWORD_2FA_CANCEL") {
    sendResponse(cancelPasswordTwoFactor(message.challengeId));
    return true;
  }

  if (message.type === "CAREEROS_GET_OAUTH_CONFIG") {
    readSettings()
      .then((settings) => fetchExtensionConfig(settings.apiBaseUrl))
      .then(async (config) => {
        if (config.apiBaseUrl) {
          await rememberApiBaseUrl(config.apiBaseUrl);
        }

        sendResponse({
          auth: config.auth || {
            emailPasswordEnabled: false,
            firebaseApiKey: "",
          },
          ok: true,
          // On Chrome, Google sign-in uses chrome.identity.getAuthToken() (manifest-embedded client_id, no
          // server config needed at all - see startGoogleSignInChromeNative()), so it's always available there
          // regardless of what the server reports. Firefox has no such API and still needs the server-configured
          // relay, same as GitHub everywhere.
          providers: {
            ...config.providers,
            google: IS_CHROME_NATIVE_IDENTITY
              ? { clientId: null, enabled: true }
              : config.providers?.google,
          },
          redirectUri: getExtensionRedirectUri(),
        });
      })
      .catch((error) => sendResponse({ error: error.message, ok: false }));
    return true;
  }

  if (message.type === "CAREEROS_SAVE_JOB") {
    saveJob(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          code: "IMPORT_FAILED",
          error: error.message,
          ok: false,
        }),
      );
    return true;
  }

  return false;
});
