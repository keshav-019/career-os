const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const WEB_HOST = "127.0.0.1";
const WEB_PORT = 43824;
const WEB_READY_TIMEOUT_MS = 45_000;
const WEB_READY_POLL_TIMEOUT_MS = 8_000;

function waitForWebApp(url, timeoutMs, getProcess) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      callback(value);
    };

    const retry = () => {
      if (settled) {
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        finish(reject, new Error("Timed out waiting for the local web app."));
        return;
      }

      setTimeout(check, 600);
    };

    const check = () => {
      if (settled) {
        return;
      }

      const child = getProcess();
      if (child?.exitCode !== null && child?.exitCode !== undefined) {
        finish(reject, new Error(`Web app process exited early with code ${child.exitCode}.`));
        return;
      }

      let requestDone = false;
      const request = http.get(url, (response) => {
        if (requestDone || settled) {
          response.resume();
          return;
        }

        requestDone = true;
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          finish(resolve);
          return;
        }

        retry();
      });

      const retryOnce = () => {
        if (requestDone || settled) {
          return;
        }

        requestDone = true;
        request.destroy();
        retry();
      };

      request.on("error", retryOnce);
      request.setTimeout(WEB_READY_POLL_TIMEOUT_MS, retryOnce);
    };

    check();
  });
}

function attachLogs(child, log, label) {
  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      log.info(`[${label}] ${text}`);
    }
  });

  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      log.warn(`[${label}] ${text}`);
    }
  });

  child.once("error", (error) => {
    log.error(`[${label}] failed`, error);
  });

  child.once("exit", (code, signal) => {
    log.info(`[${label}] exited with code ${code ?? "null"} and signal ${signal ?? "null"}`);
  });
}

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

function resolveNpmDevCommand(args) {
  const npmCliPath = existingFile(process.env.npm_execpath);
  if (npmCliPath) {
    return {
      args: [npmCliPath, ...args],
      command: resolveNodeForNpm(npmCliPath)
    };
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  if (process.platform === "win32") {
    return {
      args: ["/d", "/s", "/c", npmCommand, ...args],
      command: "cmd.exe"
    };
  }

  return {
    args,
    command: npmCommand
  };
}

function stopProcessTree(child, log, label) {
  if (!child || child.killed || child.exitCode !== null || !child.pid) {
    return false;
  }

  const pid = child.pid;

  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      timeout: 8_000,
      windowsHide: true
    });

    if (result.error || result.status !== 0) {
      log.warn(`[${label}] taskkill failed; falling back to child.kill().`, result.error || result.status);
      child.kill();
    }
    return true;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch (error) {
    log.warn(`[${label}] process-group kill failed; falling back to child.kill().`, error);
    child.kill("SIGTERM");
  }

  return true;
}

function findWindowsListenerPids(port) {
  const result = spawnSync("netstat", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });

  if (result.error || !result.stdout) {
    return [];
  }

  const portSuffix = `:${port}`;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => columns.length >= 5)
    .filter((columns) => columns[1]?.endsWith(portSuffix) && columns[3] === "LISTENING")
    .map((columns) => Number(columns[4]))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
}

function stopWindowsListenerOnPort(port, log, label) {
  if (process.platform !== "win32") {
    return;
  }

  const listenerPids = [...new Set(findWindowsListenerPids(port))];
  for (const pid of listenerPids) {
    log.warn(`[${label}] stopping orphaned listener ${pid} on port ${port}.`);
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore",
      timeout: 8_000,
      windowsHide: true
    });
  }
}

function createWebAppRuntime({ app, helperUrl, log }) {
  let webProcess = null;
  const repoRoot = path.resolve(__dirname, "../../..");
  const webAppRoot = path.resolve(__dirname, "../../web");
  const webDevLockPath = path.join(webAppRoot, ".next", "dev", "lock");
  const webUrl = `http://${WEB_HOST}:${WEB_PORT}`;

  function getDesktopWebEnv() {
    return {
      ...process.env,
      BROWSER: "none",
      CAREEROS_DESKTOP_APP: "1",
      HOSTNAME: WEB_HOST,
      NEXT_PUBLIC_CAREEROS_DESKTOP_APP: "1",
      NEXT_PUBLIC_DESKTOP_HELPER_URL: helperUrl,
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(WEB_PORT)
    };
  }

  function startDevServer() {
    const npmArgs = [
        "run",
        "dev",
        "--workspace",
        "@careeros/web",
        "--",
        "--hostname",
        WEB_HOST,
        "--port",
        String(WEB_PORT)
      ];
    const npmDevCommand = resolveNpmDevCommand(npmArgs);
    log.info(`Starting web dev server with ${npmDevCommand.command}`);

    webProcess = spawn(
      npmDevCommand.command,
      npmDevCommand.args,
      {
        cwd: repoRoot,
        detached: process.platform !== "win32",
        env: getDesktopWebEnv(),
        windowsHide: true
      }
    );

    attachLogs(webProcess, log, "next-dev");
  }

  function resolvePackagedServerPath() {
    const candidates = [
      path.join(process.resourcesPath, "web", "apps", "web", "server.js"),
      path.join(process.resourcesPath, "web", "server.js"),
      path.join(webAppRoot, ".next", "standalone", "apps", "web", "server.js"),
      path.join(webAppRoot, ".next", "standalone", "server.js")
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
  }

  function startPackagedServer() {
    const serverPath = resolvePackagedServerPath();
    if (!fs.existsSync(serverPath)) {
      throw new Error(`Standalone web server was not found at ${serverPath}. Run the desktop web build before packaging.`);
    }

    webProcess = spawn(process.execPath, [serverPath], {
      cwd: path.dirname(serverPath),
      detached: process.platform !== "win32",
      env: {
        ...getDesktopWebEnv(),
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production"
      },
      windowsHide: true
    });

    attachLogs(webProcess, log, "next-standalone");
  }

  async function start() {
    if (process.env.CAREEROS_DESKTOP_WEB_URL) {
      return process.env.CAREEROS_DESKTOP_WEB_URL;
    }

    stopWindowsListenerOnPort(WEB_PORT, log, "web-app");

    if (app.isPackaged) {
      startPackagedServer();
    } else {
      startDevServer();
    }

    try {
      await waitForWebApp(`${webUrl}/api/desktop/ping`, WEB_READY_TIMEOUT_MS, () => webProcess);
    } catch (error) {
      stop();
      throw error;
    }

    return webUrl;
  }

  function removeDesktopDevLock() {
    if (app.isPackaged) {
      return;
    }

    fs.rmSync(webDevLockPath, { force: true });
  }

  function stop() {
    if (!webProcess || webProcess.killed) {
      return;
    }

    const stoppedLiveProcess = stopProcessTree(webProcess, log, "web-app");
    if (stoppedLiveProcess) {
      removeDesktopDevLock();
    }
    stopWindowsListenerOnPort(WEB_PORT, log, "web-app");
    webProcess = null;
  }

  return {
    start,
    stop,
    url: webUrl
  };
}

module.exports = {
  WEB_HOST,
  WEB_PORT,
  createWebAppRuntime
};
