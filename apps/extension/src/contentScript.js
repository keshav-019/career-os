const PAGE_SCAN_DEBOUNCE_MS = 1000;
const PROMPT_ID = "careeros-save-prompt";
const TOAST_ID = "careeros-save-toast";
const MAX_HTML_SNAPSHOT_LENGTH = 120000;

const KNOWN_SKILLS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C++",
  "React",
  "Node.js",
  "SQL",
  "AWS",
  "Docker",
  "Kubernetes",
  "Machine Learning",
  "Deep Learning",
  "NLP",
  "TensorFlow",
  "PyTorch",
  "Golang",
  "Spring Boot",
  "Angular"
];

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const STRONG_JOB_KEYWORDS = [
  "job description",
  "responsibilities",
  "requirements",
  "qualifications",
  "experience",
  "apply",
  "skills",
  "role"
];

let lastPayloadSignature = "";
let scheduledScan = null;

const cleanText = (value) => (value || "").replace(/\s+/g, " ").trim();

const truncateText = (value, maxLength) => {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength);
};

const normalizeMultilineText = (value) => {
  const text = String(value || "").replace(/\r/g, "\n");
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines.join("\n");
};

const isLocalDevelopmentHost = () => {
  const hostname = window.location.hostname.toLowerCase();
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".local");
};

const detectHostKind = () => {
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes("linkedin.")) {
    return "linkedin";
  }

  if (hostname.includes("indeed.")) {
    return "indeed";
  }

  if (hostname.includes("naukri.")) {
    return "naukri";
  }

  return "unsupported";
};

const getHostSource = (hostKind) => {
  if (hostKind === "linkedin") {
    return "linkedin";
  }

  if (hostKind === "indeed") {
    return "indeed";
  }

  if (hostKind === "naukri") {
    return "other";
  }

  return "chrome-extension";
};

const findFirstElement = (scope, selectors) => {
  const root = scope || document;
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return null;
};

const collectTexts = (scope, selectors, maxItems = 20) => {
  const root = scope || document;
  const collected = [];

  for (const selector of selectors) {
    const nodes = root.querySelectorAll(selector);
    if (!nodes || nodes.length === 0) {
      continue;
    }

    nodes.forEach((node) => {
      const value = cleanText(node.textContent || "");
      if (!value) {
        return;
      }

      if (!collected.includes(value)) {
        collected.push(value);
      }
    });

    if (collected.length >= maxItems) {
      break;
    }
  }

  return collected.slice(0, maxItems);
};

const firstText = (scope, selectors) => {
  const element = findFirstElement(scope, selectors);
  return cleanText(element?.textContent || "");
};

const firstImageSrc = (scope, selectors) => {
  const root = scope || document;
  for (const selector of selectors) {
    const image = root.querySelector(selector);
    const src = cleanText(image?.getAttribute("src") || "");
    const dataSrc = cleanText(image?.getAttribute("data-src") || "");
    const lazySrc = cleanText(image?.getAttribute("data-delayed-url") || image?.getAttribute("data-ghost-url") || "");
    const candidate = src || dataSrc || lazySrc;

    if (candidate && !candidate.startsWith("data:")) {
      try {
        return new URL(candidate, window.location.href).toString();
      } catch {
        return candidate;
      }
    }
  }

  return "";
};

const readPrimaryDescription = (scope, selectors) => {
  for (const selector of selectors) {
    const element = (scope || document).querySelector(selector);
    const text = cleanText(element?.innerText || element?.textContent || "");
    if (text.length > 120) {
      return truncateText(text, 20000);
    }
  }

  return "";
};

const readPrimaryDescriptionMultiline = (scope, selectors) => {
  for (const selector of selectors) {
    const element = (scope || document).querySelector(selector);
    const text = normalizeMultilineText(element?.innerText || element?.textContent || "");
    if (text.length > 120) {
      return text.slice(0, 26000);
    }
  }

  return "";
};

const safeOuterHtml = (element) => {
  if (!element || typeof element.outerHTML !== "string") {
    return "";
  }

  return element.outerHTML.slice(0, MAX_HTML_SNAPSHOT_LENGTH);
};

const inferSalaryText = (sourceText) => {
  const salaryMatch = sourceText.match(
    /(₹|INR|\$|USD|EUR|GBP)\s?[0-9][0-9,.\s]*(?:-|to)\s?(₹|INR|\$|USD|EUR|GBP)?\s?[0-9][0-9,.\s]*(?:a year|per year|a month|per month|a day|per day)?/i
  );

  return cleanText(salaryMatch?.[0] || "");
};

const inferEmploymentType = (sourceText) => {
  const lowerText = sourceText.toLowerCase();
  if (lowerText.includes("intern")) {
    return "Internship";
  }

  if (lowerText.includes("contract")) {
    return "Contract";
  }

  if (lowerText.includes("part-time") || lowerText.includes("part time")) {
    return "Part-time";
  }

  if (lowerText.includes("full-time") || lowerText.includes("full time")) {
    return "Full-time";
  }

  return "";
};

const inferExperienceText = (sourceText) => {
  const match = sourceText.match(/(\d+\+?\s*-\s*\d+\+?\s*years|\d+\+?\s*years)/i);
  return cleanText(match?.[0] || "");
};

const inferPostedAtText = (sourceText) => {
  const match = sourceText.match(
    /(reposted\s+\d+\s+(?:day|days|week|weeks|month|months)\s+ago|posted\s*[:\-]?\s*\d+\s+(?:day|days|week|weeks|month|months)\s+ago|\d+\s+(?:day|days|week|weeks|month|months)\s+ago|few hours ago|today|yesterday)/i
  );
  return cleanText(match?.[0] || "");
};

const inferWorkplaceTypeText = (sourceText) => {
  const match = sourceText.match(/\b(remote|hybrid|on-site|onsite|on site|work from home|wfh)\b/i);
  if (!match?.[0]) {
    return "";
  }

  const value = match[0].toLowerCase();
  if (value === "wfh" || value === "work from home") {
    return "Remote";
  }

  if (value === "on-site" || value === "onsite" || value === "on site") {
    return "On-site";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};

const inferJobTypeText = (sourceText) => {
  const match = sourceText.match(
    /\b(full[-\s]?time|part[-\s]?time|contract(?:ual)?|internship|temporary|freelance|permanent)\b/i
  );
  if (!match?.[0]) {
    return "";
  }

  const value = match[0].replace(/\s+/g, " ").toLowerCase();
  if (value === "full time") {
    return "Full-time";
  }

  if (value === "part time") {
    return "Part-time";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
};

const inferLocationOptions = (primaryLocation, sourceText) => {
  const seed = cleanText(primaryLocation || "");
  const values = [];
  if (seed) {
    values.push(seed);
  }

  const matches = sourceText.match(/[A-Z][A-Za-z\s.&-]+,\s*[A-Z][A-Za-z\s.&-]+(?:,\s*[A-Z][A-Za-z\s.&-]+)?/g) || [];
  matches.forEach((entry) => {
    const normalized = cleanText(entry);
    if (!normalized) {
      return;
    }

    if (!values.includes(normalized)) {
      values.push(normalized);
    }
  });

  return values.slice(0, 8);
};

const extractSectionText = (sourceText, headingPatterns, stopPatterns, maxLength = 1800) => {
  const text = String(sourceText || "");
  if (!text) {
    return "";
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return "";
  }

  const findHeadingIndex = (patterns) =>
    lines.findIndex((line) => patterns.some((pattern) => new RegExp(pattern, "i").test(line)));

  const startIndex = findHeadingIndex(headingPatterns);
  if (startIndex === -1) {
    return "";
  }

  const collected = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (stopPatterns.some((pattern) => new RegExp(pattern, "i").test(line))) {
      break;
    }

    collected.push(line);
    if (collected.join(" ").length >= maxLength) {
      break;
    }
  }

  return cleanText(collected.join(" ").slice(0, maxLength));
};

const inferSkills = (sourceText) => {
  const lowerText = sourceText.toLowerCase();
  const detected = KNOWN_SKILLS.filter((skill) => lowerText.includes(skill.toLowerCase()));
  return Array.from(new Set(detected)).slice(0, 20);
};

const inferTags = (payload) => {
  const tags = new Set(["new", payload.source || "chrome-extension"]);
  const locationText = `${payload.location || ""} ${(payload.locationOptions || []).join(" ")} ${payload.description || ""} ${
    payload.workplaceTypeText || ""
  }`.toLowerCase();

  if (locationText.includes("remote") || locationText.includes("work from home")) {
    tags.add("remote");
    payload.remotePolicyHint = "remote";
  } else if (locationText.includes("hybrid")) {
    tags.add("hybrid");
    payload.remotePolicyHint = "hybrid";
  } else if (locationText.includes("on-site") || locationText.includes("onsite") || locationText.includes("on site")) {
    tags.add("onsite");
    payload.remotePolicyHint = "onsite";
  }

  payload.skills?.forEach((skill) => tags.add(skill.toLowerCase().replace(/\s+/g, "-")));
  if (payload.jobTypeText) {
    tags.add(payload.jobTypeText.toLowerCase().replace(/\s+/g, "-"));
  }
  return Array.from(tags);
};

const parseIndeedPayload = () => {
  const detailsRoot = findFirstElement(document, [
    "#jobsearch-ViewjobPaneWrapper",
    "[data-testid='jobsearch-JobComponent']",
    "#viewJobSSRRoot"
  ]);

  const selectedListItem = findFirstElement(document, [
    "[data-jk][aria-current='true']",
    "[data-jk][aria-selected='true']",
    ".job_seen_beacon[aria-current='true']"
  ]);

  const title = firstText(detailsRoot, [
    "h1[data-testid='jobsearch-JobInfoHeader-title']",
    "h1.jobsearch-JobInfoHeader-title",
    "h1"
  ]);
  const company = firstText(detailsRoot, [
    "[data-testid='inlineHeader-companyName']",
    "[data-company-name='true']",
    ".jobsearch-InlineCompanyRating div:first-child"
  ]);
  const location = firstText(detailsRoot, [
    "[data-testid='job-location']",
    "#jobLocationText",
    ".jobsearch-JobInfoHeader-subtitle div:last-child"
  ]);

  const descriptionElement = findFirstElement(detailsRoot || document, [
    "#jobDescriptionText",
    "[data-testid='jobsearch-JobComponent-description']",
    "[id^='jobDescriptionText']"
  ]);

  const description = readPrimaryDescription(detailsRoot || document, [
    "#jobDescriptionText",
    "[data-testid='jobsearch-JobComponent-description']",
    "[id^='jobDescriptionText']",
    "main"
  ]);
  const descriptionMultiline = readPrimaryDescriptionMultiline(detailsRoot || document, [
    "#jobDescriptionText",
    "[data-testid='jobsearch-JobComponent-description']",
    "[id^='jobDescriptionText']",
    "main"
  ]);

  const detailPills = collectTexts(detailsRoot || document, [
    "#jobDetailsSection [data-testid='jobDetailText']",
    "#jobDetailsSection li",
    "[data-testid='jobsearch-JobDescriptionSection-sectionItem']"
  ]);
  const locationOptions = collectTexts(detailsRoot || document, [
    "[data-testid='job-location']",
    "#jobLocationText",
    ".jobsearch-JobInfoHeader-subtitle div",
    "[data-testid='inlineHeader-companyLocation']"
  ]);
  const postedHints = collectTexts(detailsRoot || document, [
    "[data-testid='jobsearch-JobMetadataFooter']",
    ".jobsearch-JobMetadataFooter",
    ".jobsearch-JobDescriptionSection-sectionItem"
  ]).join("\n");

  const companyLogoUrl = firstImageSrc(detailsRoot || selectedListItem || document, [
    "img[data-testid='inlineHeader-companyLogo']",
    ".jobsearch-JobInfoHeader-logo img",
    "img[src*='companylogo']",
    "img[alt*='logo' i]"
  ]);

  return {
    aboutText: extractSectionText(descriptionMultiline, ["about\\s+the\\s+job", "^role"], [
      "responsibilities",
      "qualifications",
      "requirements",
      "benefits",
      "job\\s+type"
    ]),
    company,
    companyLogoUrl,
    contextHtml: safeOuterHtml(selectedListItem),
    description,
    descriptionMultiline,
    descriptionHtml: safeOuterHtml(descriptionElement),
    detailsHtml: safeOuterHtml(detailsRoot || descriptionElement),
    eligibilityText: extractSectionText(descriptionMultiline, ["qualifications", "requirements"], [
      "benefits",
      "responsibilities",
      "about\\s+the\\s+job",
      "location"
    ]),
    jobTypeText: inferJobTypeText(`${detailPills.join(" ")}\n${descriptionMultiline}`),
    location,
    locationOptions,
    postedAtText: inferPostedAtText(postedHints || descriptionMultiline),
    responsibilitiesText: extractSectionText(descriptionMultiline, ["responsibilities"], [
      "qualifications",
      "benefits",
      "requirements"
    ]),
    title
  };
};

const parseLinkedInPayload = () => {
  const detailsRoot = findFirstElement(document, [
    ".jobs-search__job-details--container",
    ".jobs-details",
    ".job-view-layout"
  ]);

  const selectedListItem =
    findFirstElement(document, [
      ".jobs-search-results__list-item--active",
      ".job-card-container--clickable[aria-current='true']",
      "[data-job-id][aria-current='true']"
    ]) || null;

  const title = firstText(detailsRoot, [
    ".jobs-unified-top-card__job-title",
    ".job-details-jobs-unified-top-card__job-title",
    "h1"
  ]);
  const company = firstText(detailsRoot, [
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__company-name",
    ".topcard__flavor-row a"
  ]);
  const location = firstText(detailsRoot, [
    ".jobs-unified-top-card__bullet",
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".topcard__flavor--bullet"
  ]);

  const descriptionElement = findFirstElement(detailsRoot || document, [
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".jobs-description__content",
    ".jobs-search__job-details--container"
  ]);

  const description = readPrimaryDescription(detailsRoot || document, [
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".jobs-description__content",
    ".jobs-search__job-details--container",
    "main"
  ]);
  const descriptionMultiline = readPrimaryDescriptionMultiline(detailsRoot || document, [
    ".jobs-description-content__text",
    ".jobs-box__html-content",
    ".jobs-description__content",
    ".jobs-search__job-details--container",
    "main"
  ]);

  const primaryMeta = firstText(detailsRoot, [
    ".jobs-unified-top-card__primary-description-container",
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".topcard__flavor-row"
  ]);

  const detailPills = collectTexts(detailsRoot || document, [
    ".jobs-unified-top-card__job-insight",
    ".jobs-unified-top-card__workplace-type",
    ".description__job-criteria-list li",
    ".job-details-jobs-unified-top-card__job-insight"
  ]);
  const locationOptions = collectTexts(detailsRoot || document, [
    ".jobs-unified-top-card__bullet",
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".topcard__flavor--bullet"
  ]);

  const companyLogoUrl = firstImageSrc(detailsRoot || selectedListItem || document, [
    ".jobs-unified-top-card__company-logo img",
    ".job-details-jobs-unified-top-card__company-logo img",
    ".jobs-company__box img",
    "img[alt*='logo' i]"
  ]);

  return {
    aboutText: extractSectionText(descriptionMultiline, ["about\\s+the\\s+job", "about\\s+the\\s+role"], [
      "responsibilities",
      "what\\s+you\\s+will\\s+be\\s+doing",
      "qualifications",
      "what\\s+we\\s+need\\s+to\\s+see",
      "you\\s+might\\s+be\\s+a\\s+good\\s+fit"
    ]),
    company,
    companyLogoUrl,
    contextHtml: safeOuterHtml(selectedListItem),
    description,
    descriptionMultiline,
    descriptionHtml: safeOuterHtml(descriptionElement),
    detailsHtml: safeOuterHtml(detailsRoot || descriptionElement || selectedListItem),
    eligibilityText: extractSectionText(
      descriptionMultiline,
      ["what\\s+we\\s+need\\s+to\\s+see", "qualifications", "you\\s+might\\s+be\\s+a\\s+good\\s+fit"],
      ["how\\s+we\\s+are\\s+different", "benefits", "about\\s+the\\s+company", "come\\s+work\\s+with\\s+us"]
    ),
    jobTypeText: inferJobTypeText(`${detailPills.join(" ")}\n${descriptionMultiline}`),
    location,
    locationOptions,
    postedAtText: inferPostedAtText(`${primaryMeta}\n${detailPills.join("\n")}`),
    responsibilitiesText: extractSectionText(
      descriptionMultiline,
      ["responsibilities", "what\\s+you\\s+will\\s+be\\s+doing"],
      ["what\\s+we\\s+need\\s+to\\s+see", "qualifications", "you\\s+might\\s+be\\s+a\\s+good\\s+fit"]
    ),
    title
  };
};

const parseNaukriPayload = () => {
  const detailsRoot = findFirstElement(document, [
    ".styles_jd-container__Aupxw",
    ".styles_jd-main-layout__Yc0nA",
    ".job-desc-container",
    "main"
  ]);

  const title = firstText(detailsRoot, [
    ".styles_jd-header-title__rZwM1",
    ".jd-header-title",
    "h1"
  ]);
  const company = firstText(detailsRoot, [
    ".styles_jd-header-comp-name__MvqAI",
    ".comp-name",
    ".jd-header-comp-name"
  ]);
  const location = firstText(detailsRoot, [
    ".styles_jhc__location__W_pVs",
    ".locWdth",
    ".styles_jhc__location__W_pVs a"
  ]);

  const descriptionElement = findFirstElement(detailsRoot || document, [
    ".styles_JDC__dang-inner-html__h0K4t",
    ".dang-inner-html",
    "#jobDescriptionContainer"
  ]);

  const description = readPrimaryDescription(detailsRoot || document, [
    ".styles_JDC__dang-inner-html__h0K4t",
    ".dang-inner-html",
    "#jobDescriptionContainer",
    ".job-desc"
  ]);
  const descriptionMultiline = readPrimaryDescriptionMultiline(detailsRoot || document, [
    ".styles_JDC__dang-inner-html__h0K4t",
    ".dang-inner-html",
    "#jobDescriptionContainer",
    ".job-desc",
    "main"
  ]);

  const companyLogoUrl = firstImageSrc(detailsRoot || document, [
    ".styles_jd-header-comp-name__MvqAI img",
    ".styles_jd-header-comp-logo img",
    ".comp-name img",
    "img[alt*='logo' i]"
  ]);

  const detailFacts = collectTexts(detailsRoot || document, [
    ".styles_jhc__bottom__drBLS span",
    ".styles_jhc__jd-top-info__Hf5qN span",
    ".job-details-jobs-unified-top-card__job-insight",
    ".styles_job-desc-container__txpYf li",
    ".styles_key-skill-wrapper__-Q4oK li"
  ]);
  const locationOptions = collectTexts(detailsRoot || document, [
    ".styles_jhc__location__W_pVs",
    ".locWdth",
    ".styles_jhc__location__W_pVs a",
    ".styles_jd-header-desc__wOp6E"
  ]);
  const wholeText = `${descriptionMultiline}\n${detailFacts.join("\n")}`;

  return {
    aboutText: extractSectionText(descriptionMultiline, ["job\\s+description"], [
      "key\\s+skills",
      "role\\s*:",
      "industry\\s+type",
      "education"
    ]),
    company,
    companyLogoUrl,
    contextHtml: "",
    description,
    descriptionMultiline,
    descriptionHtml: safeOuterHtml(descriptionElement),
    detailsHtml: safeOuterHtml(detailsRoot || descriptionElement),
    eligibilityText: extractSectionText(descriptionMultiline, ["qualification", "education", "experience"], [
      "key\\s+skills",
      "role\\s*:",
      "industry\\s+type"
    ]),
    jobTypeText: inferJobTypeText(wholeText),
    location,
    locationOptions,
    postedAtText: inferPostedAtText(wholeText),
    responsibilitiesText: extractSectionText(descriptionMultiline, ["key\\s+responsibilities", "responsibilities"], [
      "qualification",
      "education",
      "key\\s+skills"
    ]),
    title
  };
};

const hasJobSignals = (payload, hostKind) => {
  const titleWords = payload.title.split(/\s+/).filter(Boolean).length;
  if (titleWords < 2) {
    return false;
  }

  const combinedText = `${payload.title} ${payload.company} ${payload.location} ${payload.description}`.toLowerCase();
  const hasKeyword = STRONG_JOB_KEYWORDS.some((keyword) => combinedText.includes(keyword));
  const hasPrimaryMeta = Boolean(payload.company || payload.location || payload.jobTypeText || payload.postedAtText);
  const hasLongDescription = payload.description.length >= 120;
  const hasMediumDescription = payload.description.length >= 70;

  if (!hasKeyword && !hasPrimaryMeta) {
    return false;
  }

  const sourceUrl = payload.sourceUrl.toLowerCase();
  if (hostKind === "linkedin" && !sourceUrl.includes("/jobs/")) {
    return false;
  }

  const hasLinkedInDetails = Boolean(
    document.querySelector(".jobs-search__job-details--container, .jobs-description-content__text, .jobs-unified-top-card__job-title")
  );
  const hasIndeedDetails = Boolean(
    document.querySelector("#jobDescriptionText, [data-testid='jobsearch-JobComponent-description'], [data-testid='jobsearch-JobInfoHeader-title']")
  );
  const hasNaukriDetails = Boolean(
    document.querySelector("#jobDescriptionContainer, .styles_JDC__dang-inner-html__h0K4t, .styles_jd-header-title__rZwM1")
  );

  if (!hasLongDescription && !(hasMediumDescription && hasPrimaryMeta)) {
    if (hostKind === "linkedin" && !(hasLinkedInDetails && hasPrimaryMeta)) {
      return false;
    }

    if (hostKind === "indeed" && !(hasIndeedDetails && hasPrimaryMeta)) {
      return false;
    }

    if (hostKind === "naukri" && !(hasNaukriDetails && hasPrimaryMeta)) {
      return false;
    }
  }

  if (hostKind === "linkedin" && !hasLinkedInDetails) {
    return false;
  }

  if (hostKind === "indeed") {
    const isIndeedJobUrl = sourceUrl.includes("/viewjob") || sourceUrl.includes("/jobs");
    if (!isIndeedJobUrl && !hasIndeedDetails) {
      return false;
    }
  }

  if (hostKind === "naukri") {
    const isLikelyNaukriJobUrl = sourceUrl.includes("/job-listings") || sourceUrl.includes("/job-listing");
    if (!isLikelyNaukriJobUrl && !hasNaukriDetails) {
      return false;
    }

    if (!combinedText.includes("job")) {
      return false;
    }
  }

  if (hostKind === "indeed" && !hasIndeedDetails) {
    return false;
  }

  return true;
};

const collectJobPayload = () => {
  if (isLocalDevelopmentHost()) {
    return null;
  }

  const hostKind = detectHostKind();
  if (hostKind === "unsupported") {
    return null;
  }

  let parsed;
  if (hostKind === "indeed") {
    parsed = parseIndeedPayload();
  } else if (hostKind === "linkedin") {
    parsed = parseLinkedInPayload();
  } else {
    parsed = parseNaukriPayload();
  }

  const description = truncateText(parsed.description || "", 20000);
  const descriptionMultiline = normalizeMultilineText(parsed.descriptionMultiline || parsed.description || "");
  const title = cleanText(parsed.title || "");
  const company = cleanText(parsed.company || "");
  const location = cleanText(parsed.location || "");

  if (!title && description.length < 120) {
    return null;
  }

  const analysisText = `${title}\n${company}\n${location}\n${descriptionMultiline || description}`;
  const locationOptions = Array.from(
    new Set([
      ...((Array.isArray(parsed.locationOptions) ? parsed.locationOptions : []).map((entry) => cleanText(entry))),
      ...inferLocationOptions(location, analysisText)
    ])
  ).filter(Boolean);

  const postedAtText = cleanText(parsed.postedAtText || inferPostedAtText(analysisText));
  const workplaceTypeText = cleanText(parsed.workplaceTypeText || inferWorkplaceTypeText(analysisText));
  const jobTypeText = cleanText(parsed.jobTypeText || inferJobTypeText(analysisText));
  const responsibilitiesText = cleanText(
    parsed.responsibilitiesText
      || extractSectionText(descriptionMultiline, ["responsibilities", "what\\s+you\\s+will\\s+be\\s+doing"], [
        "qualifications",
        "requirements",
        "education",
        "benefits"
      ])
  );
  const eligibilityText = cleanText(
    parsed.eligibilityText || extractSectionText(descriptionMultiline, ["qualifications", "requirements", "education"], ["benefits", "about"])
  );
  const aboutText = cleanText(
    parsed.aboutText
      || extractSectionText(descriptionMultiline, ["about\\s+the\\s+job", "about\\s+the\\s+role", "^role"], [
        "responsibilities",
        "requirements",
        "qualifications",
        "education"
      ])
  );

  const payload = {
    title,
    company,
    companyLogoUrl: cleanText(parsed.companyLogoUrl || ""),
    location,
    locationOptions,
    source: getHostSource(hostKind),
    sourceUrl: window.location.href,
    description,
    descriptionHtml: parsed.descriptionHtml || "",
    selectedJobHtml: parsed.detailsHtml || parsed.contextHtml || "",
    aboutText,
    eligibilityText,
    postedAtText,
    responsibilitiesText,
    workplaceTypeText,
    jobTypeText,
    employmentType: inferEmploymentType(analysisText),
    experienceText: inferExperienceText(analysisText),
    salaryText: inferSalaryText(analysisText),
    skills: inferSkills(analysisText),
    tags: []
  };
  payload.tags = inferTags(payload);

  if (!hasJobSignals(payload, hostKind)) {
    return null;
  }

  return payload;
};

const ensurePrompt = () => {
  let prompt = document.getElementById(PROMPT_ID);
  if (prompt) {
    return prompt;
  }

  prompt = document.createElement("div");
  prompt.id = PROMPT_ID;

  const promptContent = document.createElement("div");
  promptContent.className = "careeros-prompt-content";

  const promptCopy = document.createElement("div");
  promptCopy.className = "careeros-prompt-copy";

  const promptTitle = document.createElement("strong");
  promptTitle.textContent = "CareerOS detected this job.";

  const promptDescription = document.createElement("p");
  promptDescription.textContent = "Click Save to save this job with CareerOS.";

  const saveButton = document.createElement("button");
  saveButton.id = "careeros-prompt-save";
  saveButton.type = "button";
  saveButton.textContent = "Save";

  promptCopy.appendChild(promptTitle);
  promptCopy.appendChild(promptDescription);
  promptContent.appendChild(promptCopy);
  promptContent.appendChild(saveButton);
  prompt.appendChild(promptContent);
  document.documentElement.appendChild(prompt);

  const style = document.createElement("style");
  style.textContent = `
    #${PROMPT_ID} {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      max-width: 340px;
      border-radius: 12px;
      background: #112a46;
      color: #f3f7ff;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.32);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      padding: 12px;
      display: none;
    }
    #${PROMPT_ID} .careeros-prompt-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    #${PROMPT_ID} .careeros-prompt-copy {
      min-width: 0;
    }
    #${PROMPT_ID} strong {
      font-size: 13px;
      line-height: 1.3;
      display: block;
      margin: 0 0 2px;
      font-weight: 700;
      color: #f3f7ff !important;
    }
    #${PROMPT_ID} p {
      margin: 0;
      color: rgba(243, 247, 255, 0.92) !important;
      font-size: 12px;
      line-height: 1.3;
    }
    #${PROMPT_ID} button {
      border: none;
      border-radius: 8px;
      background: #19a57f;
      color: #fff;
      font-weight: 700;
      font-size: 12px;
      line-height: 1;
      padding: 10px 12px;
      cursor: pointer;
      flex-shrink: 0;
    }
    #${TOAST_ID} {
      position: fixed;
      right: 16px;
      bottom: 88px;
      z-index: 2147483647;
      background: #061525;
      color: #f8fbff;
      border-radius: 10px;
      font: 600 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      padding: 10px 12px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
      display: none;
    }
  `;
  document.documentElement.appendChild(style);

  const saveFromPrompt = () => {
    const payload = collectJobPayload();
    if (!payload) {
      showToast("No active job details found on this page.");
      return;
    }

    chrome.runtime.sendMessage({ type: "CAREEROS_SAVE_JOB", payload }, (response) => {
      if (chrome.runtime.lastError) {
        showToast("CareerOS extension could not reach background worker.");
        return;
      }

      if (response?.ok) {
        showToast("Saved to CareerOS.");
        return;
      }

      if (response?.code === "AUTH_REQUIRED") {
        showToast("Paste your extension token package in the popup to save jobs.");
        return;
      }

      showToast(response?.error || "Failed to save job.");
    });
  };

  saveButton?.addEventListener("click", saveFromPrompt);

  return prompt;
};

const showPrompt = () => {
  const prompt = ensurePrompt();
  prompt.style.display = "block";
};

const hidePrompt = () => {
  const prompt = document.getElementById(PROMPT_ID);
  if (prompt) {
    prompt.style.display = "none";
  }
};

const showToast = (text) => {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    document.documentElement.appendChild(toast);
  }

  toast.textContent = text;
  toast.style.display = "block";
  window.setTimeout(() => {
    if (toast) {
      toast.style.display = "none";
    }
  }, 2800);
};

const reportDetection = (payload) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CAREEROS_JOB_DETECTED", payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ authenticated: false, ok: false });
        return;
      }

      resolve(response || { authenticated: false, ok: false });
    });
  });

const notifyDetection = () => {
  const payload = collectJobPayload();
  if (!payload) {
    lastPayloadSignature = "";
    hidePrompt();
    void reportDetection(null);
    return;
  }

  const signature = JSON.stringify([
    payload.title,
    payload.company,
    payload.location,
    payload.sourceUrl,
    payload.description?.slice(0, 300)
  ]);

  lastPayloadSignature = signature;
  void reportDetection(payload).then((response) => {
    if (response?.authenticated) {
      showPrompt();
      return;
    }

    hidePrompt();
  });
};

const schedulePageScan = () => {
  if (scheduledScan !== null) {
    window.clearTimeout(scheduledScan);
  }

  scheduledScan = window.setTimeout(() => {
    scheduledScan = null;
    notifyDetection();
  }, PAGE_SCAN_DEBOUNCE_MS);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CAREEROS_COLLECT_PAGE") {
    const payload = collectJobPayload();
    sendResponse({ detected: Boolean(payload), payload });
    return true;
  }

  if (message.type === "CAREEROS_SHOW_PROMPT") {
    const payload = collectJobPayload();
    if (payload) {
      void reportDetection(payload).then((response) => {
        if (response?.authenticated) {
          showPrompt();
          sendResponse({ ok: true });
          return;
        }

        hidePrompt();
        sendResponse({ ok: false, reason: "AUTH_REQUIRED" });
      });
      return true;
    }

    sendResponse({ ok: false });
    return true;
  }

  return false;
});

if (detectHostKind() === "unsupported" || isLocalDevelopmentHost()) {
  hidePrompt();
  chrome.runtime.sendMessage({ type: "CAREEROS_JOB_DETECTED", payload: null });
} else {
  const observer = new MutationObserver(() => {
    schedulePageScan();
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => notifyDetection(), { once: true });
  } else {
    notifyDetection();
  }

  window.addEventListener("popstate", schedulePageScan);
  window.addEventListener("hashchange", schedulePageScan);
}
