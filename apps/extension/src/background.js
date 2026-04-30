chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "CAREEROS_SAVE_JOB") {
    return false;
  }

  fetch("http://localhost:3000/api/jobs/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message.payload)
  })
    .then(async (response) => {
      const body = await response.json();
      sendResponse({ ok: response.ok, body });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
