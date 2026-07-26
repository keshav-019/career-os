import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "chrome-web-store-assets");
const EXTENSION_ICON_DIR = path.join(ROOT, "apps", "extension", "icons");
const LOGO_SOURCE_FILE = path.join(ROOT, "apps", "web", "public", "careeros-dark-mode.png");
const WEB_LOGO_128_FILE = path.join(ROOT, "apps", "web", "public", "careeros-logo-128.png");
const CAREEROS_LOGO_DATA_URI = `data:image/png;base64,${(await fs.readFile(LOGO_SOURCE_FILE)).toString("base64")}`;

const DESCRIPTION = `CareerOS Capture helps job seekers save job posts into CareerOS while browsing supported job boards.

When you find a role you want to track, CareerOS Capture detects the job details on the page and lets you save the opportunity into your CareerOS job pipeline. It is built for candidates who want a cleaner way to organize applications, compare roles, and keep job-search context in one place.

Key features:

- Detects job details on supported job-board pages.
- Saves role, company, location, source URL, and available job description details into CareerOS.
- Shows a clear save prompt when a job page is detected.
- Keeps your CareerOS pipeline updated without copy-pasting job descriptions by hand.
- Supports CareerOS account connection with Google, GitHub, email/password, 2FA, or token package fallback depending on your deployment setup.
- Works with the CareerOS web app and the CareerOS desktop workflow.

CareerOS Capture is useful when you are:

- Comparing several open roles.
- Tracking jobs discovered across multiple sites.
- Preparing to tailor resumes and cover letters in CareerOS.
- Keeping saved job posts connected to your application pipeline.
- Avoiding manual copying from job pages into spreadsheets or notes.

How it works:

1. Install CareerOS Capture.
2. Connect your CareerOS account from the extension popup.
3. Open a supported job post.
4. Use the CareerOS prompt or popup to save the role.
5. Review and manage the saved role inside CareerOS.

Privacy and security:

CareerOS Capture only sends job information to the CareerOS app endpoint you configure. Account access is used to save jobs under your own CareerOS account. The extension does not sell browsing data or add advertising behavior. It is designed for job capture and application organization.

Supported sites may change their page layouts over time. If a job page is not detected, open the extension popup on the job page and try again after the page has fully loaded.

CareerOS Capture is not affiliated with LinkedIn, Indeed, Naukri, Google, GitHub, or any job board. Site names are used only to describe compatibility.`;

const SUMMARY = "Save detected job posts into your CareerOS application pipeline.";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logoImage(x, y, size) {
  return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${CAREEROS_LOGO_DATA_URI}" preserveAspectRatio="xMidYMid meet"/>`;
}

function defs() {
  return `<defs>
    <linearGradient id="bg" x1="0" x2="1280" y1="0" y2="800" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#071222"/>
      <stop offset="0.48" stop-color="#0D2743"/>
      <stop offset="1" stop-color="#0C4A43"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" x2="0" y1="0" y2="800" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#102846"/>
      <stop offset="1" stop-color="#07182E"/>
    </linearGradient>
    <linearGradient id="green" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#25D39E"/>
      <stop offset="1" stop-color="#129171"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#020812" flood-opacity="0.35"/>
    </filter>
  </defs>`;
}

function text(x, y, content, size, fill = "#F3F7FF", weight = 700, anchor = "start") {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

function pill(x, y, width, label, fill = "#12314F", color = "#B9D7F4") {
  return `<rect x="${x}" y="${y}" width="${width}" height="30" rx="15" fill="${fill}" stroke="rgba(255,255,255,0.12)"/>${text(x + width / 2, y + 20, label, 13, color, 800, "middle")}`;
}

function button(x, y, width, label, variant = "primary") {
  const fill = variant === "primary" ? "url(#green)" : "#132D4A";
  const stroke = variant === "primary" ? "none" : "rgba(255,255,255,0.18)";
  return `<rect x="${x}" y="${y}" width="${width}" height="44" rx="12" fill="${fill}" stroke="${stroke}"/>${text(x + width / 2, y + 28, label, 15, "#F7FFFC", 800, "middle")}`;
}

function popupCard(x, y, connected = true) {
  return `<g filter="url(#softShadow)">
    <rect x="${x}" y="${y}" width="376" height="560" rx="24" fill="#081A34" stroke="rgba(191,214,247,0.25)"/>
    <rect x="${x + 18}" y="${y + 18}" width="340" height="72" rx="18" fill="#102A49"/>
    ${logoImage(x + 32, y + 28, 50)}
    ${text(x + 88, y + 50, "CareerOS Capture", 17)}
    ${text(x + 88, y + 72, connected ? "Signed in. Job capture is ready." : "Connect your CareerOS account.", 12, "#B8CAE3", 600)}
    <rect x="${x + 18}" y="${y + 110}" width="340" height="160" rx="18" fill="#0D223D" stroke="rgba(191,214,247,0.18)"/>
    ${text(x + 36, y + 140, "EXTENSION ACCESS", 12, "#AFC4DF", 900)}
    ${pill(x + 232, y + 121, 96, connected ? "Connected" : "Sign in", connected ? "#0E765D" : "#3A506F", "#ECFFF8")}
    ${text(x + 36, y + 174, connected ? "keshav@example.com via CareerOS" : "Choose a sign-in method to continue.", 13, "#DCEBFF", 650)}
    ${button(x + 36, y + 198, 304, connected ? "Account Connected" : "Continue with Google")}
    <rect x="${x + 18}" y="${y + 290}" width="340" height="190" rx="18" fill="#0D223D" stroke="rgba(191,214,247,0.18)"/>
    ${text(x + 36, y + 320, "JOB DETECTION", 12, "#AFC4DF", 900)}
    ${pill(x + 224, y + 301, 104, "Job detected", "#0E765D", "#ECFFF8")}
    ${text(x + 36, y + 356, "Senior Frontend Engineer", 18)}
    ${text(x + 36, y + 382, "Acme Labs / Remote / Chrome", 13, "#B8CAE3", 650)}
    <rect x="${x + 36}" y="${y + 410}" width="304" height="1" fill="rgba(255,255,255,0.12)"/>
    ${button(x + 36, y + 432, 304, "Save to CareerOS")}
  </g>`;
}

function browserFrame(content) {
  return `<rect x="70" y="68" width="1140" height="664" rx="28" fill="#09182D" filter="url(#softShadow)"/>
  <rect x="70" y="68" width="1140" height="58" rx="28" fill="#132740"/>
  <circle cx="103" cy="98" r="7" fill="#F06D6D"/><circle cx="127" cy="98" r="7" fill="#F4C260"/><circle cx="151" cy="98" r="7" fill="#31C48D"/>
  <rect x="190" y="84" width="500" height="28" rx="14" fill="#071526" stroke="rgba(255,255,255,0.1)"/>
  ${text(210, 103, "supported-job-board.example/role/frontend-engineer", 12, "#93A8C3", 600)}
  ${content}`;
}

function screenshotOne() {
  const content = `<rect x="96" y="150" width="620" height="540" rx="22" fill="#F6F8FB"/>
    ${text(126, 197, "Senior Frontend Engineer", 30, "#10213B", 900)}
    ${text(126, 230, "Acme Labs - Remote - Full time", 17, "#49627F", 700)}
    <rect x="126" y="260" width="122" height="34" rx="17" fill="#EAF3FF"/>${text(187, 282, "React", 14, "#1D4E7A", 800, "middle")}
    <rect x="260" y="260" width="138" height="34" rx="17" fill="#E9FAF4"/>${text(329, 282, "TypeScript", 14, "#176E58", 800, "middle")}
    <rect x="126" y="326" width="520" height="14" rx="7" fill="#DDE6F1"/>
    <rect x="126" y="356" width="470" height="14" rx="7" fill="#DDE6F1"/>
    <rect x="126" y="386" width="530" height="14" rx="7" fill="#DDE6F1"/>
    <rect x="126" y="450" width="560" height="14" rx="7" fill="#DDE6F1"/>
    <rect x="126" y="480" width="510" height="14" rx="7" fill="#DDE6F1"/>
    <g filter="url(#softShadow)">
      <rect x="788" y="476" width="360" height="116" rx="20" fill="#112A46"/>
      ${text(814, 516, "CareerOS detected this job.", 18)}
      ${text(814, 544, "Save role, company, and URL.", 13, "#C6D8EF", 650)}
      ${button(1010, 512, 96, "Save")}
    </g>`;
  return screenshotShell("Detected on job pages", "CareerOS prompts you when a supported job post is ready to save.", browserFrame(content));
}

function screenshotTwo() {
  const content = `<rect x="96" y="150" width="590" height="540" rx="22" fill="#F5F7FB"/>
    ${text(128, 200, "Job details page", 28, "#10213B", 900)}
    <rect x="128" y="242" width="430" height="14" rx="7" fill="#D8E2EF"/>
    <rect x="128" y="274" width="500" height="14" rx="7" fill="#D8E2EF"/>
    <rect x="128" y="326" width="470" height="14" rx="7" fill="#D8E2EF"/>
    <rect x="128" y="358" width="390" height="14" rx="7" fill="#D8E2EF"/>
    ${popupCard(754, 144, true)}`;
  return screenshotShell("Save from the popup", "The extension popup confirms the active job and saves it to CareerOS.", browserFrame(content));
}

function screenshotThree() {
  const content = `${popupCard(140, 154, false)}
    <g filter="url(#softShadow)">
      <rect x="610" y="170" width="500" height="405" rx="26" fill="#0E2340" stroke="rgba(191,214,247,0.2)"/>
      ${text(650, 222, "Secure account connection", 30)}
      ${text(650, 262, "OAuth, email/password, 2FA, and token package flows.", 18, "#B8CAE3", 650)}
      ${button(650, 315, 360, "Continue with Google")}
      ${button(650, 375, 360, "Continue with GitHub", "secondary")}
      <rect x="650" y="450" width="360" height="58" rx="15" fill="#081A32" stroke="rgba(255,255,255,0.14)"/>
      ${text(675, 485, "Authenticator code supported", 16, "#DDEBFF", 800)}
    </g>`;
  return screenshotShell("Connect once", "CareerOS Capture keeps job saves tied to your own account.", browserFrame(content));
}

function screenshotFour() {
  const columns = ["Saved", "Applied", "Interview"];
  const cards = columns.map((col, index) => {
    const x = 110 + index * 355;
    return `<rect x="${x}" y="218" width="318" height="430" rx="22" fill="#0C203A" stroke="rgba(191,214,247,0.16)"/>
      ${text(x + 24, 254, col, 20)}
      ${pill(x + 230, 232, 70, index === 0 ? "New" : "Live", index === 0 ? "#0E765D" : "#263D5B", "#ECFFF8")}
      <rect x="${x + 24}" y="292" width="270" height="118" rx="18" fill="${index === 0 ? "#123D55" : "#102947"}"/>
      ${text(x + 44, 326, index === 0 ? "Senior Frontend Engineer" : index === 1 ? "Cloud Engineer" : "Product Analyst", 16)}
      ${text(x + 44, 354, index === 0 ? "Saved from Chrome" : "CareerOS pipeline", 12, "#B8CAE3", 650)}
      <rect x="${x + 44}" y="376" width="100" height="24" rx="12" fill="#0E765D"/>${text(x + 94, 393, index === 0 ? "Captured" : "Tracked", 11, "#EEFFF9", 800, "middle")}`;
  }).join("");
  return screenshotShell("Lands in your pipeline", "Saved roles appear inside CareerOS for review, tracking, and follow-up.", `${text(96, 176, "CareerOS Applications", 34)}${cards}`);
}

function screenshotFive() {
  const content = `<g filter="url(#softShadow)">
    <rect x="100" y="166" width="1080" height="460" rx="28" fill="#0C2039" stroke="rgba(191,214,247,0.16)"/>
    ${text(142, 224, "Structured job capture", 34)}
    ${text(142, 266, "CareerOS turns the open job page into a clean record you can work with later.", 18, "#B8CAE3", 650)}
    ${["Role title", "Company", "Location", "Source URL", "Job description", "Skills"].map((item, index) => {
      const x = 142 + (index % 3) * 315;
      const y = 324 + Math.floor(index / 3) * 104;
      return `<rect x="${x}" y="${y}" width="270" height="68" rx="18" fill="#112C4B"/>
        <circle cx="${x + 34}" cy="${y + 34}" r="12" fill="#24C895"/>
        ${text(x + 58, y + 40, item, 17, "#EAF4FF", 800)}`;
    }).join("")}
  </g>`;
  return screenshotShell("Ready for resume work", "Use captured job context inside CareerOS when tailoring applications.", content);
}

function screenshotShell(title, subtitle, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
  ${defs()}
  <rect width="1280" height="800" fill="url(#bg)"/>
  <circle cx="1120" cy="120" r="140" fill="#25D39E" opacity="0.12"/>
  <circle cx="120" cy="720" r="120" fill="#F8C95F" opacity="0.10"/>
  ${logoImage(70, 22, 40)}
  ${text(120, 52, "CareerOS Capture", 20, "#BEEAD9", 900)}
  ${text(640, 52, title, 28, "#FFFFFF", 900, "middle")}
  ${text(640, 84, subtitle, 16, "#B8CAE3", 650, "middle")}
  ${body}
</svg>`;
}

function promoSmall() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs><linearGradient id="p" x1="0" x2="440" y1="0" y2="280"><stop offset="0" stop-color="#071222"/><stop offset="1" stop-color="#116552"/></linearGradient></defs>
  <rect width="440" height="280" fill="url(#p)"/>
  ${logoImage(24, 28, 94)}
  ${text(28, 154, "CareerOS Capture", 28)}
  ${text(28, 188, "Save job posts into your pipeline.", 16, "#C9DBF0", 650)}
  <rect x="282" y="56" width="120" height="168" rx="20" fill="#081A34" stroke="rgba(255,255,255,0.18)"/>
  <rect x="302" y="86" width="80" height="18" rx="9" fill="#24C895"/>
  <rect x="302" y="126" width="72" height="10" rx="5" fill="#C9DBF0" opacity="0.8"/>
  <rect x="302" y="150" width="56" height="10" rx="5" fill="#C9DBF0" opacity="0.55"/>
  <rect x="302" y="180" width="80" height="28" rx="10" fill="#24C895"/>
</svg>`;
}

function promoMarquee() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
  ${defs()}
  <rect width="1400" height="560" fill="url(#bg)"/>
  <g filter="url(#softShadow)">
    ${logoImage(90, 96, 360)}
  </g>
  ${text(530, 210, "CareerOS Capture", 64)}
  ${text(530, 272, "Save job posts while you browse.", 30, "#C9DBF0", 700)}
  ${text(530, 326, "One click from supported job boards to your CareerOS pipeline.", 24, "#B8CAE3", 650)}
  <rect x="530" y="370" width="210" height="54" rx="16" fill="url(#green)"/>
  ${text(635, 405, "Chrome ready", 20, "#FFFFFF", 900, "middle")}
</svg>`;
}

async function writePng(filePath, svg, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).png({ compressionLevel: 9 }).toFile(filePath);
}

async function writeLogoPng(filePath, size) {
  await sharp(LOGO_SOURCE_FILE)
    .resize(size, size, {
      background: "#061124",
      fit: "contain"
    })
    .png({ compressionLevel: 9 })
    .toFile(filePath);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(EXTENSION_ICON_DIR, { recursive: true });

  await writeLogoPng(path.join(OUT_DIR, "careeros-capture-icon-128.png"), 128);
  await writeLogoPng(WEB_LOGO_128_FILE, 128);
  for (const size of [16, 32, 48, 128]) {
    await writeLogoPng(path.join(EXTENSION_ICON_DIR, `icon${size}.png`), size);
  }

  const screenshots = [
    ["screenshot-01-job-detected.png", screenshotOne()],
    ["screenshot-02-popup-save.png", screenshotTwo()],
    ["screenshot-03-secure-sign-in.png", screenshotThree()],
    ["screenshot-04-careeros-pipeline.png", screenshotFour()],
    ["screenshot-05-structured-capture.png", screenshotFive()]
  ];

  for (const [fileName, svg] of screenshots) {
    await writePng(path.join(OUT_DIR, fileName), svg, 1280, 800);
  }

  await writePng(path.join(OUT_DIR, "promo-small-440x280.png"), promoSmall(), 440, 280);
  await writePng(path.join(OUT_DIR, "promo-marquee-1400x560.png"), promoMarquee(), 1400, 560);

  const copy = `# CareerOS Capture - Chrome Web Store Listing Copy

## Suggested item title

CareerOS Capture

## Suggested summary

${SUMMARY}

## Detailed description

${DESCRIPTION}

---

Description character count: ${DESCRIPTION.length}
Summary character count: ${SUMMARY.length}
`;
  await fs.writeFile(path.join(OUT_DIR, "listing-copy.md"), copy, "utf8");
}

await main();
