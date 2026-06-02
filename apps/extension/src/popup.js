const DEFAULT_APP_BASE_URL = "http://localhost:3000";

const statusEl = document.getElementById("status");
const authBadgeEl = document.getElementById("authBadge");
const detectionBadgeEl = document.getElementById("detectionBadge");
const accountMetaEl = document.getElementById("accountMeta");
const tokenInputEl = document.getElementById("tokenInput");
const saveTokenButton = document.getElementById("saveTokenButton");
const clearTokenButton = document.getElementById("clearTokenButton");
const jobTitleEl = document.getElementById("jobTitle");
const jobMetaEl = document.getElementById("jobMeta");

let activeTabId = null;
let appBaseUrl = DEFAULT_APP_BASE_URL;
let isAuthenticated = false;

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
    jobMetaEl.textContent = "Open a job details page on LinkedIn, Indeed, or Naukri.";
    setDetectionBadge("No job detected", "chip-muted");
    return;
  }

  jobTitleEl.textContent = payload.title || "Untitled role";
  const meta = [payload.company, payload.location, payload.source].filter(Boolean).join(" / ");
  jobMetaEl.textContent = meta || "Job details detected";
  setDetectionBadge("Job detected", "chip-active");
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

    const nextUrl = typeof parsed.apiBaseUrl === "string"
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
  clearTokenButton.disabled = disabled;
};

const setAuthUi = (authSummary) => {
  const authenticated = Boolean(authSummary?.authenticated);
  isAuthenticated = authenticated;

  if (authenticated) {
    const provider = authSummary?.providerLabel || "CareerOS";
    const email = authSummary?.email ? `${authSummary.email} via ${provider}` : `Connected via ${provider}`;
    accountMetaEl.textContent = email;
    setAuthBadge("Connected", "chip-active");
  } else {
    accountMetaEl.textContent = "Not connected. Paste token package to enable save.";
    setAuthBadge("Token required", "chip-muted");
  }
};

const collectPayloadForTab = (tabId) =>
  new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "CAREEROS_COLLECT_PAGE" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      resolve(response?.payload || null);
    });
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
    setDetectionBadge("Token required", "chip-warning");
    setStatus("Paste token package to enable capture.");
    return;
  }

  try {
    const cached = await sendRuntimeMessage({ type: "CAREEROS_GET_ACTIVE_JOB", tabId: tab.id });
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
    const settingsResponse = await sendRuntimeMessage({ type: "CAREEROS_GET_SETTINGS" });
    if (settingsResponse?.ok) {
      if (settingsResponse.settings?.apiBaseUrl) {
        appBaseUrl = normalizeApiBaseUrl(settingsResponse.settings.apiBaseUrl);
      }
    }
  } catch {
    appBaseUrl = DEFAULT_APP_BASE_URL;
  }

  try {
    const authResponse = await sendRuntimeMessage({ type: "CAREEROS_AUTH_STATUS" });
    if (!authResponse?.ok) {
      setAuthUi({ authenticated: false });
      setStatus(authResponse?.error || "Could not read extension auth state.", "error");
      return;
    }

    setAuthUi(authResponse.auth);
  } catch (error) {
    setAuthUi({ authenticated: false });
    setStatus(error instanceof Error ? error.message : "Could not read extension auth state.", "error");
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
      authToken
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
    setStatus(error instanceof Error ? error.message : "Could not save token package.", "error");
  } finally {
    setActionButtonsDisabled(false);
  }
};

const clearTokenPackage = async () => {
  setActionButtonsDisabled(true);
  setStatus("Clearing token package...");
  try {
    const response = await sendRuntimeMessage({ type: "CAREEROS_AUTH_SIGN_OUT" });
    if (!response?.ok) {
      setStatus(response?.error || "Could not clear token package.", "error");
      return;
    }

    tokenInputEl.value = "";
    setAuthUi({ authenticated: false });
    setJobPreview(null);
    setStatus("Token package cleared.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not clear token package.", "error");
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
  await refreshDetection();
};

saveTokenButton.addEventListener("click", () => {
  void saveTokenPackage();
});

clearTokenButton.addEventListener("click", () => {
  void clearTokenPackage();
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
  setStatus(error instanceof Error ? error.message : "Could not initialize extension popup.", "error");
});
