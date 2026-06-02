const STORAGE_KEYS = {
  apiBaseUrl: "careeros_api_base_url",
  authRaw: "careeros_auth_raw",
  authState: "careeros_auth_state"
};

const TOKEN_REFRESH_MARGIN_MS = 30 * 1000;
const detectionByTab = new Map();
const DEFAULT_API_BASE_URL = "http://localhost:3000";
const TRUSTED_HTTPS_HOST_PATTERNS = [
  /(^|\.)careeros\.app$/i,
  /^career-os(?:[-.][a-z0-9-]+)*\.vercel\.app$/i
];

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
      "="
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
  const idToken = typeof candidate.idToken === "string" ? candidate.idToken.trim() : "";
  const refreshToken = typeof candidate.refreshToken === "string" ? candidate.refreshToken.trim() : "";
  const apiKey = typeof candidate.apiKey === "string" ? candidate.apiKey.trim() : "";
  const email = typeof candidate.email === "string" ? candidate.email.trim() : "";
  const providerId = typeof candidate.providerId === "string" ? candidate.providerId.trim() : "";
  const userId = typeof candidate.userId === "string" ? candidate.userId.trim() : "";
  const expiresAtMs =
    typeof candidate.expiresAtMs === "number" && Number.isFinite(candidate.expiresAtMs)
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
    userId
  };
};

const parseAuthInput = (rawValue) => {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return {
      authRaw: "",
      authState: null
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const authState = normalizeAuthState(parsed);
    if (authState) {
      return {
        authRaw: raw,
        authState
      };
    }
  } catch {
    // Fall through to plain token mode.
  }

  return {
    authRaw: raw,
    authState: normalizeAuthState({ idToken: raw })
  };
};

const readSettings = async () => {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.apiBaseUrl,
    STORAGE_KEYS.authRaw,
    STORAGE_KEYS.authState
  ]);

  const legacyRaw = String(stored[STORAGE_KEYS.authRaw] || "").trim();
  const authState = normalizeAuthState(stored[STORAGE_KEYS.authState]) || parseAuthInput(legacyRaw).authState;

  return {
    apiBaseUrl: normalizeApiBaseUrl(stored[STORAGE_KEYS.apiBaseUrl]),
    authState
  };
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
  expiresAtMs: typeof authState?.expiresAtMs === "number" ? authState.expiresAtMs : null,
  providerId: normalizeProviderId(authState?.providerId),
  providerLabel: mapProviderLabel(authState?.providerId),
  userId: authState?.userId || ""
});

const writeSettings = async (nextSettings) => {
  await chrome.storage.local.set(nextSettings);
  if (Object.prototype.hasOwnProperty.call(nextSettings, STORAGE_KEYS.authState)) {
    // Clear legacy/raw token payloads once parsed to reduce secret duplication in extension storage.
    await chrome.storage.local.set({
      [STORAGE_KEYS.authRaw]: ""
    });
  }

  return readSettings();
};

const setBadgeForTab = async (tabId, detected) => {
  if (!tabId) {
    return;
  }

  await chrome.action.setBadgeBackgroundColor({
    color: detected ? "#14916f" : "#4e5b70",
    tabId
  });
  await chrome.action.setBadgeText({
    text: detected ? "JOB" : "",
    tabId
  });
  await chrome.action.setTitle({
    title: detected ? "CareerOS job detected. Click to save." : "CareerOS Capture",
    tabId
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
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: authState.refreshToken
      }).toString()
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const nextState = normalizeAuthState({
    apiKey: authState.apiKey,
    email: payload.email || authState.email,
    expiresAtMs:
      typeof payload.expires_in === "string" && Number.isFinite(Number(payload.expires_in))
        ? Date.now() + Number(payload.expires_in) * 1000
        : undefined,
    idToken: payload.id_token,
    providerId: authState.providerId,
    refreshToken: payload.refresh_token || authState.refreshToken,
    userId: payload.user_id || authState.userId
  });

  if (!nextState) {
    return null;
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.authState]: nextState
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
  if (authState.expiresAtMs && authState.expiresAtMs - TOKEN_REFRESH_MARGIN_MS > nowMs) {
    return authState.idToken;
  }

  const refreshedToken = await refreshIdToken(authState);
  return refreshedToken || authState.idToken;
};

const signOut = async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.authRaw]: "",
    [STORAGE_KEYS.authState]: null
  });

  detectionByTab.clear();
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .map((tab) => tab.id)
      .filter(Boolean)
      .map((tabId) => setBadgeForTab(tabId, false))
  );

  return {
    ok: true
  };
};

const getAuthStatus = async () => {
  const token = await getValidAuthToken();
  const settings = await readSettings();
  return {
    auth: toAuthSummary(settings.authState, Boolean(token)),
    ok: true
  };
};

const saveJob = async (payload) => {
  const settings = await readSettings();
  const idToken = await getValidAuthToken();
  if (!idToken) {
    return {
      code: "AUTH_REQUIRED",
      error: "Paste your extension token package in the popup before saving jobs.",
      ok: false
    };
  }

  const response = await fetch(`${settings.apiBaseUrl}/api/jobs/import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      code: response.status === 401 ? "AUTH_REQUIRED" : "IMPORT_FAILED",
      error: body?.error || "Failed to save job.",
      ok: false
    };
  }

  return {
    body,
    ok: true
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
          ok: true
        });
      })
      .catch((error) =>
        sendResponse({
          authenticated: false,
          error: error.message,
          ok: false
        })
      );
    return true;
  }

  if (message.type === "CAREEROS_GET_ACTIVE_JOB") {
    const tabId = message.tabId;
    sendResponse({
      ok: true,
      payload: tabId ? detectionByTab.get(tabId) || null : null
    });
    return true;
  }

  if (message.type === "CAREEROS_IS_AUTHENTICATED") {
    readSettings()
      .then((settings) =>
        sendResponse({
          authenticated: hasUsableAuthState(settings.authState),
          ok: true
        })
      )
      .catch((error) => sendResponse({ authenticated: false, error: error.message, ok: false }));
    return true;
  }

  if (message.type === "CAREEROS_AUTH_STATUS") {
    getAuthStatus()
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          auth: toAuthSummary(null, false),
          error: error.message,
          ok: false
        })
      );
    return true;
  }

  if (message.type === "CAREEROS_AUTH_SIGN_OUT") {
    signOut()
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          error: error.message,
          ok: false
        })
      );
    return true;
  }

  if (message.type === "CAREEROS_GET_SETTINGS") {
    readSettings()
      .then((settings) =>
        sendResponse({
          ok: true,
          settings: {
            apiBaseUrl: settings.apiBaseUrl
          },
          auth: toAuthSummary(settings.authState, hasUsableAuthState(settings.authState))
        })
      )
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CAREEROS_UPDATE_SETTINGS") {
    const nextApiBaseUrl = normalizeApiBaseUrl(message.apiBaseUrl);
    const nextSettings = {
      [STORAGE_KEYS.apiBaseUrl]: nextApiBaseUrl
    };

    if (Object.prototype.hasOwnProperty.call(message, "authToken")) {
      const parsed = parseAuthInput(message.authToken);
      nextSettings[STORAGE_KEYS.authRaw] = "";
      nextSettings[STORAGE_KEYS.authState] = parsed.authState;
    }

    writeSettings(nextSettings)
      .then((settings) =>
        sendResponse({
          ok: true,
          settings: {
            apiBaseUrl: settings.apiBaseUrl
          },
          auth: toAuthSummary(settings.authState, hasUsableAuthState(settings.authState))
        })
      )
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "CAREEROS_SAVE_JOB") {
    saveJob(message.payload)
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          code: "IMPORT_FAILED",
          error: error.message,
          ok: false
        })
      );
    return true;
  }

  return false;
});
