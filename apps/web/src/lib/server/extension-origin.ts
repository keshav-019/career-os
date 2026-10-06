/** The Chrome Web Store listing of CareerOS Capture. Always allowed, so a production deploy without
 *  CAREEROS_ALLOWED_EXTENSION_IDS still accepts the published extension (when it didn't, every
 *  "Save to CareerOS" from the store build failed with 403 "Origin is not allowed"). */
export const PUBLISHED_CHROME_EXTENSION_IDS = ["llendblljmalpjakenfmllaajhblkcim"];

const CONFIGURED_ALLOWED_EXTENSION_IDS = new Set(
  (process.env.CAREEROS_ALLOWED_EXTENSION_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function getBrowserExtensionId(origin: string): { id: string; protocol: "chrome-extension" | "moz-extension" } | null {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "chrome-extension:" && parsed.protocol !== "moz-extension:") {
      return null;
    }

    return {
      id: parsed.hostname,
      protocol: parsed.protocol === "moz-extension:" ? "moz-extension" : "chrome-extension"
    };
  } catch {
    return null;
  }
}

/** Shared by every route the extension calls (extension-cors.ts and /api/jobs/import). Unsigned Firefox .xpi builds
 *  get a different extension id per install so moz-extension is always allowed; Chrome ids are stable, so they're
 *  checked against the published store id plus CAREEROS_ALLOWED_EXTENSION_IDS in production (falling back to
 *  allow-all only outside prod, for unpacked dev extensions). Never reflect every chrome-extension:// origin
 *  unconditionally, which was flagged in a security review. */
export function isAllowedExtensionOrigin(origin: string): boolean {
  const extensionId = getBrowserExtensionId(origin);
  if (!extensionId) {
    return false;
  }

  if (extensionId.protocol === "moz-extension") {
    return true;
  }

  if (PUBLISHED_CHROME_EXTENSION_IDS.includes(extensionId.id)) {
    return true;
  }

  if (CONFIGURED_ALLOWED_EXTENSION_IDS.size > 0) {
    return CONFIGURED_ALLOWED_EXTENSION_IDS.has(extensionId.id);
  }

  return !IS_PRODUCTION;
}
