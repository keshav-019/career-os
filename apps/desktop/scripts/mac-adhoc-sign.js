"use strict";

/**
 * electron-builder afterSign hook (macOS only).
 *
 * Without an Apple "Developer ID Application" certificate electron-builder
 * skips signing, which leaves only Electron's linker signature on the main
 * binary and a broken bundle seal. Downloaded copies of such an app are
 * rejected with "CareerOS is damaged and can't be opened". Ad-hoc signing
 * the whole bundle instead gives the normal "unidentified developer"
 * prompt, which users can allow in System Settings > Privacy & Security.
 *
 * When a real certificate is configured (CSC_LINK / CSC_NAME, as in the
 * release workflow), electron-builder signs and notarizes and this does
 * nothing.
 */

const path = require("node:path");
const { execFileSync } = require("node:child_process");

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const entitlements = path.join(__dirname, "..", "build", "entitlements.mac.plist");

  console.log(`  • ad-hoc signing  app=${appPath}`);
  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--options", "runtime", "--entitlements", entitlements, appPath],
    { stdio: "inherit" }
  );
  execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "inherit" });
};
