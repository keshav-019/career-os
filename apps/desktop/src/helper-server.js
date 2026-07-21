const cors = require("cors");
const express = require("express");
const { createLatexRuntime } = require("./latex-runtime");
const { createCodingArena } = require("./coding");

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") return null;
  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  return scheme === "Bearer" && token ? token : null;
}

function createDesktopHelperServer({ app, host = "127.0.0.1", log, port = 43823 }) {
  let server = null;
  let webBaseUrl = null;
  const latexRuntime = createLatexRuntime({ app, log });
  const codingArena = createCodingArena({ log, getWebBaseUrl: () => webBaseUrl });

  /** Called once main.js knows the bundled web app's local URL, so the coding arena can fetch problem data from it. */
  function setWebBaseUrl(url) {
    webBaseUrl = url;
  }

  function buildHealthPayload() {
    const status = latexRuntime.getStatus();
    const codingRuntime = codingArena.getRuntimeStatus();

    return {
      app: "careeros-desktop",
      codingRuntime,
      latexAvailable: Boolean(status.available),
      latexRuntime: status,
      message: status.available
        ? `${status.name} is ready.`
        : status.installMessage || "Portable compiler is not ready yet.",
      ok: true,
      version: app.getVersion()
    };
  }

  const api = express();
  api.use(express.json({ limit: "5mb" }));
  api.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin.startsWith("http://127.0.0.1") || origin.startsWith("http://localhost")) {
          callback(null, true);
        } else {
          callback(new Error("Origin not allowed"));
        }
      }
    })
  );

  api.get("/health", (_req, res) => {
    res.json(buildHealthPayload());
  });

  api.post("/latex/install", async (_req, res) => {
    try {
      await latexRuntime.installCompiler();
      res.json(buildHealthPayload());
    } catch (err) {
      log.error("Compiler install error", err);
      res.status(500).json({
        ...buildHealthPayload(),
        error: err instanceof Error ? err.message : "Compiler install failed.",
        ok: false
      });
    }
  });

  api.post("/compile-latex", async (req, res) => {
    const source = req.body.source;
    if (typeof source !== "string" || source.trim() === "") {
      return res.status(400).json({ error: "Empty source", ok: false });
    }
    if (source.length > latexRuntime.maxSourceLength) {
      return res.status(413).json({ error: "Source too large", ok: false });
    }

    try {
      const result = await latexRuntime.compile(source);
      res.json({
        engine: result.engine,
        log: result.log,
        ok: true,
        pdfBase64: result.pdfBuffer.toString("base64")
      });
    } catch (err) {
      log.error("Compile error", err);
      res.status(500).json({
        engine: err?.engine || "unknown",
        error: err?.summary || err?.message || "Compilation failed",
        log: err?.log || err?.message || "Compilation failed",
        ok: false
      });
    }
  });

  api.get("/code/runtime", (_req, res) => {
    res.json({ ok: true, runtime: codingArena.getRuntimeStatus() });
  });

  // Problem listing/detail now come directly from the web app's own API (apps/web/src/lib/interview/coding-arena-client.ts
  // calls /api/coding-problems and /api/coding-problems/:id same-origin) - this helper server no longer serves them.
  // Only run/submit go through here, since those need the local judge.

  api.post("/code/run", async (req, res) => {
    const { customTests, customTestsOnly, language, problemId, source } = req.body || {};
    if (typeof problemId !== "string" || typeof language !== "string" || typeof source !== "string") {
      return res.status(400).json({ error: "problemId, language, and source are required.", ok: false });
    }

    try {
      const idToken = extractBearerToken(req.headers.authorization);
      const result = await codingArena.run({
        customTests,
        customTestsOnly: Boolean(customTestsOnly),
        idToken,
        language,
        problemId,
        source
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      log.error("Code run error", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Run failed.", ok: false });
    }
  });

  api.post("/code/submit", async (req, res) => {
    const { language, problemId, source } = req.body || {};
    if (typeof problemId !== "string" || typeof language !== "string" || typeof source !== "string") {
      return res.status(400).json({ error: "problemId, language, and source are required.", ok: false });
    }

    try {
      const idToken = extractBearerToken(req.headers.authorization);
      const result = await codingArena.submit({ idToken, language, problemId, source });
      res.json({ ok: true, ...result });
    } catch (err) {
      log.error("Code submit error", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Submit failed.", ok: false });
    }
  });

  function start() {
    return new Promise((resolve, reject) => {
      server = api.listen(port, host, () => {
        const address = server.address();
        const actualPort = typeof address === "object" && address ? address.port : port;
        const url = `http://${host}:${actualPort}`;
        log.info(`Helper server running at ${url}`);
        resolve({ port: actualPort, url });
      });

      server.on("error", reject);
    });
  }

  function close() {
    if (!server) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      server.close(() => {
        server = null;
        resolve();
      });
    });
  }

  return {
    api,
    buildHealthPayload,
    close,
    codingArena,
    latexRuntime,
    setWebBaseUrl,
    start
  };
}

module.exports = {
  createDesktopHelperServer
};
