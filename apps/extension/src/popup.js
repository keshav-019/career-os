const statusEl = document.getElementById("status");
const saveButton = document.getElementById("saveJob");

const setStatus = (value) => {
  statusEl.textContent = value;
};

saveButton.addEventListener("click", async () => {
  setStatus("Capturing page");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    setStatus("No active tab");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "CAREEROS_COLLECT_PAGE" }, (response) => {
    if (chrome.runtime.lastError || !response?.payload) {
      setStatus("Could not read page");
      return;
    }

    chrome.runtime.sendMessage(
      { type: "CAREEROS_SAVE_JOB", payload: response.payload },
      (saveResponse) => {
        if (saveResponse?.ok) {
          setStatus("Saved draft");
          return;
        }

        setStatus("Web app offline");
      }
    );
  });
});
