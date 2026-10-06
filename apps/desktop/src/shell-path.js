"use strict";

/**
 * macOS apps launched from Finder, the Dock or Spotlight start with a minimal
 * PATH (/usr/bin:/bin:/usr/sbin:/sbin) instead of the user's shell PATH, so
 * toolchains from Homebrew, rustup, pyenv, nvm etc. look "not installed" to
 * the coding arena even though they work in Terminal. This copies the login
 * shell's PATH into process.env once at startup (child processes inherit
 * it), and always adds the standard Homebrew and rustup locations in case
 * the shell can't be read.
 */

const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SHELL_TIMEOUT_MS = 3_000;
const MARKER = "__CAREEROS_PATH__";

function readLoginShellPath() {
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    const result = spawnSync(shell, ["-ilc", `printf '${MARKER}%s${MARKER}' "$PATH"`], {
      encoding: "utf8",
      timeout: SHELL_TIMEOUT_MS,
      env: { ...process.env, DISABLE_AUTO_UPDATE: "true" }
    });
    if (result.error || result.status !== 0) return "";
    const match = (result.stdout || "").match(new RegExp(`${MARKER}(.*)${MARKER}`));
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

function applyShellPath({ log } = {}) {
  if (process.platform !== "darwin") return;

  const current = (process.env.PATH || "").split(path.delimiter);
  const fromShell = readLoginShellPath().split(path.delimiter);
  const wellKnown = ["/opt/homebrew/bin", "/opt/homebrew/sbin", "/usr/local/bin", path.join(os.homedir(), ".cargo", "bin")];

  const merged = [...new Set([...fromShell, ...current, ...wellKnown].filter(Boolean))];
  process.env.PATH = merged.join(path.delimiter);
  log?.info?.(`PATH for toolchains: ${process.env.PATH}`);
}

module.exports = { applyShellPath };
