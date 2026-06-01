const firstText = (selectors) => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();

    if (text) {
      return text.replace(/\s+/g, " ");
    }
  }

  return "";
};

const collectJobPayload = () => {
  const title = firstText([
    "h1",
    "[data-testid='job-title']",
    ".job-title",
    ".posting-headline h2"
  ]);
  const company = firstText([
    "[data-testid='company-name']",
    "[data-company-name]",
    ".company",
    ".posting-company",
    "a[href*='company']"
  ]);
  const location = firstText([
    "[data-testid='job-location']",
    ".job-location",
    ".location",
    ".posting-location"
  ]);
  const description = firstText([
    "[data-testid='job-description']",
    ".job-description",
    ".description",
    "main"
  ]);

  return {
    title: title || document.title,
    company,
    location,
    sourceUrl: window.location.href,
    description,
    source: "chrome-extension"
  };
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "CAREEROS_COLLECT_PAGE") {
    return false;
  }

  sendResponse({ payload: collectJobPayload() });
  return true;
});
