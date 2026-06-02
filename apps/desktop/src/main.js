const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { app, BrowserWindow } = require("electron");
const express = require("express");
const cors = require("cors");
const latex = require("node-latex");
const log = require("electron-log");

const HELPER_HOST = "127.0.0.1";
const HELPER_PORT = 43823;
const MAX_SOURCE_LENGTH = 2_000_000;
const COMPILE_TIMEOUT_MS = 90_000;
const APP_VERSION = app.getVersion();

let mainWindow = null;
let helperServer = null;

function checkLatexBinary() {
  const result = spawnSync("pdflatex", ["--version"], {
    encoding: "utf8",
    timeout: 4_000
  });

  if (result.error) {
    return {
      available: false,
      details: result.error.message
    };
  }

  if (result.status !== 0) {
    return {
      available: false,
      details: (result.stderr || result.stdout || "").trim() || "pdflatex returned a non-zero status."
    };
  }

  return {
    available: true,
    details: (result.stdout || "").trim().split("\n")[0] || "pdflatex detected."
  };
}

function buildHealthPayload() {
  const latexCheck = checkLatexBinary();
  return {
    app: "careeros-desktop",
    latexAvailable: latexCheck.available,
    message: latexCheck.available
      ? "Desktop helper is ready for local LaTeX compile."
      : "LaTeX runtime not found. Install TeX Live / MacTeX / MiKTeX on this machine.",
    ok: true,
    version: APP_VERSION
  };
}

function compileLatexToBuffer(sourceCode) {
  return new Promise((resolve, reject) => {
    const compileStream = latex(sourceCode, {
      args: ["-interaction=nonstopmode", "-halt-on-error"],
      errorLogs: "console"
    });

    const chunks = [];
    const timeoutId = setTimeout(() => {
      compileStream.destroy(new Error(`Compilation timed out after ${Math.round(COMPILE_TIMEOUT_MS / 1000)}s.`));
    }, COMPILE_TIMEOUT_MS);

    compileStream.on("data", (chunk) => {
      chunks.push(chunk);
    });

    compileStream.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    compileStream.on("end", () => {
      clearTimeout(timeoutId);
      resolve(Buffer.concat(chunks));
    });
  });
}

function createHelperServer() {
  const api = express();
  api.use(express.json({ limit: "5mb" }));
  api.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
        callback(isLocalOrigin ? null : new Error("Origin not allowed."), isLocalOrigin);
      }
    })
  );

  api.get("/health", (_req, res) => {
    res.json(buildHealthPayload());
  });

  api.post("/compile-latex", async (req, res) => {
    const source = typeof req.body?.source === "string" ? req.body.source : "";
    if (!source.trim()) {
      res.status(400).json({
        error: "LaTeX source is empty.",
        ok: false
      });
      return;
    }

    if (source.length > MAX_SOURCE_LENGTH) {
      res.status(413).json({
        error: `Source is too large. Limit is ${MAX_SOURCE_LENGTH} characters.`,
        ok: false
      });
      return;
    }

    const latexCheck = checkLatexBinary();
    if (!latexCheck.available) {
      res.status(503).json({
        error: "Local TeX runtime is missing. Install TeX Live / MacTeX / MiKTeX first.",
        ok: false
      });
      return;
    }

    try {
      const pdfBuffer = await compileLatexToBuffer(source);
      if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
        res.status(500).json({
          error: "LaTeX compile completed but PDF output was empty.",
          ok: false
        });
        return;
      }

      res.json({
        ok: true,
        pdfBase64: pdfBuffer.toString("base64")
      });
    } catch (error) {
      log.error("LaTeX compile failed", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown compile failure.",
        ok: false
      });
    }
  });

  helperServer = api.listen(HELPER_PORT, HELPER_HOST, () => {
    log.info(`CareerOS Desktop helper running at http://${HELPER_HOST}:${HELPER_PORT}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    height: 760,
    minHeight: 680,
    minWidth: 980,
    title: "CareerOS Desktop",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    width: 1100
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html")).catch((error) => {
    log.error("Failed to load desktop window", error);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function shutdownHelperServer() {
  if (!helperServer) {
    return;
  }

  helperServer.close();
  helperServer = null;
}

app.whenReady().then(() => {
  createHelperServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  shutdownHelperServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
