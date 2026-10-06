"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Executable to run Node scripts with (together with ELECTRON_RUN_AS_NODE=1):
 * the bundled Next.js server and JavaScript solutions in the coding arena.
 *
 * On macOS, running the main app binary as Node registers each child as a
 * second foreground app with CareerOS's bundle id: an extra Dock icon, and
 * AppleScript/LaunchServices "quit" can target the wrong process. Electron's
 * "<App> Helper" binary is marked LSUIElement, so children started from it
 * stay out of the Dock. Elsewhere the main executable is fine.
 */
function nodeRuntimePath() {
  if (process.platform !== "darwin") return process.execPath;

  const name = path.basename(process.execPath);
  const helper = path.join(
    path.dirname(process.execPath),
    "..",
    "Frameworks",
    `${name} Helper.app`,
    "Contents",
    "MacOS",
    `${name} Helper`
  );
  return fs.existsSync(helper) ? path.normalize(helper) : process.execPath;
}

module.exports = { nodeRuntimePath };
