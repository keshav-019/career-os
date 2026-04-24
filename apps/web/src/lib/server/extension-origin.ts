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

/** Same policy as apps/web/src/app/api/jobs/import/route.ts's isAllowedCorsOrigin: unsigned Firefox .xpi builds
 *  get a different extension id per install so moz-extension is always allowed; Chrome ids are stable, so they're
 *  checked against CAREEROS_ALLOWED_EXTENSION_IDS in production (falling back to allow-all only outside prod, for
 *  unpacked dev extensions). Shared here so extension-cors.ts doesn't reflect every chrome-extension:// origin
 *  unconditionally, which was flagged in a security review. */
export function isAllowedExtensionOrigin(origin: string): boolean {
  const extensionId = getBrowserExtensionId(origin);
  if (!extensionId) {
    return false;
  }

  if (extensionId.protocol === "moz-extension") {
    return true;
  }

  if (CONFIGURED_ALLOWED_EXTENSION_IDS.size > 0) {
    return CONFIGURED_ALLOWED_EXTENSION_IDS.has(extensionId.id);
  }

  return !IS_PRODUCTION;
}
