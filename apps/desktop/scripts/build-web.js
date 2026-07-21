const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "../../..");
const webRoot = path.join(repoRoot, "apps", "web");
const standaloneRoot = path.join(webRoot, ".next", "standalone");
const standaloneWebRoot = path.join(standaloneRoot, "apps", "web");

function existingFile(candidate) {
  return candidate && fs.existsSync(candidate) ? candidate : null;
}

function resolveNodeForNpm(npmCliPath) {
  const npmNodeExecPath = existingFile(process.env.npm_node_execpath);
  if (npmNodeExecPath) {
    return npmNodeExecPath;
  }

  if (process.platform === "win32" && npmCliPath) {
    const nodeNearNpm = path.resolve(path.dirname(npmCliPath), "../../..", "node.exe");
    if (fs.existsSync(nodeNearNpm)) {
      return nodeNearNpm;
    }
  }

  return process.platform === "win32" ? "node.exe" : "node";
}

function parseVersionFromDirName(name) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(name);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareVersions(a, b) {
  return b.major - a.major || b.minor - a.minor || b.patch - a.patch;
}

function findNpmCliInNvm() {
  if (process.platform !== "win32") {
    return null;
  }

  const roots = [
    process.env.NVM_HOME,
    process.env.NVM_SYMLINK,
    path.join(os.homedir(), "AppData", "Local", "nvm"),
    path.join(os.homedir(), "AppData", "Roaming", "nvm")
  ].filter(Boolean);

  const candidates = [];
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const version = parseVersionFromDirName(entry.name);
      if (!version) continue;

      const npmCliPath = path.join(root, entry.name, "node_modules", "npm", "bin", "npm-cli.js");
      if (fs.existsSync(npmCliPath)) {
        candidates.push({ npmCliPath, version });
      }
    }
  }

  candidates.sort((a, b) => {
    const aSupported = a.version.major <= 24 ? 1 : 0;
    const bSupported = b.version.major <= 24 ? 1 : 0;
    return bSupported - aSupported || compareVersions(a.version, b.version);
  });

  return candidates[0]?.npmCliPath || null;
}

function resolveNpmCommand(args) {
  const npmCliPath = existingFile(process.env.npm_execpath) || findNpmCliInNvm();
  if (npmCliPath) {
    const command = resolveNodeForNpm(npmCliPath);
    return {
      args: [npmCliPath, ...args],
      command,
      pathEntries: path.isAbsolute(command) ? [path.dirname(command)] : []
    };
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  if (process.platform === "win32") {
    return {
      args: ["/d", "/s", "/c", npmCommand, ...args],
      command: "cmd.exe",
      pathEntries: []
    };
  }

  return {
    args,
    command: npmCommand,
    pathEntries: []
  };
}

function mergePathEntries(extraEntries) {
  return [...extraEntries, process.env.PATH || process.env.Path || ""].filter(Boolean).join(path.delimiter);
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.rmSync(destination, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

const npmBuildCommand = resolveNpmCommand(["run", "build", "--workspace", "@careeros/web"]);
const result = spawnSync(npmBuildCommand.command, npmBuildCommand.args, {
  cwd: repoRoot,
  env: {
    ...process.env,
    CAREEROS_DESKTOP_APP: "1",
    CAREEROS_DESKTOP_BUILD: "1",
    NEXT_PUBLIC_CAREEROS_DESKTOP_APP: "1",
    NEXT_PUBLIC_DESKTOP_HELPER_URL: "http://127.0.0.1:43823",
    NEXT_TELEMETRY_DISABLED: "1",
    PATH: mergePathEntries(npmBuildCommand.pathEntries || [])
  },
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

if (!fs.existsSync(standaloneWebRoot)) {
  throw new Error(`Standalone Next.js output was not found at ${standaloneWebRoot}.`);
}

copyDirectory(path.join(webRoot, "public"), path.join(standaloneWebRoot, "public"));
copyDirectory(path.join(webRoot, ".next", "static"), path.join(standaloneWebRoot, ".next", "static"));

console.log("Desktop web bundle prepared.");
