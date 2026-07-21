const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const TECTONIC_VERSION = "0.16.9";
const COMPILE_TIMEOUT_MS = 300_000;
const MAX_SOURCE_LENGTH = 2_000_000;
const MAX_LOG_CHARS = 22_000;

const TECTONIC_TARGETS = {
  "darwin-arm64": {
    archiveName: `tectonic-${TECTONIC_VERSION}-aarch64-apple-darwin.tar.gz`,
    executableName: "tectonic"
  },
  "darwin-x64": {
    archiveName: `tectonic-${TECTONIC_VERSION}-x86_64-apple-darwin.tar.gz`,
    executableName: "tectonic"
  },
  "linux-x64": {
    archiveName: `tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-gnu.tar.gz`,
    executableName: "tectonic"
  },
  "win32-x64": {
    archiveName: `tectonic-${TECTONIC_VERSION}-x86_64-pc-windows-msvc.zip`,
    executableName: "tectonic.exe"
  }
};

class LatexCompileError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "LatexCompileError";
    this.engine = details.engine || "unknown";
    this.log = trimLog(details.log || message);
    this.summary = message;
  }
}

function getTectonicTarget(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  const target = TECTONIC_TARGETS[key];

  if (!target) {
    return null;
  }

  return {
    ...target,
    key,
    url: `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/${target.archiveName}`
  };
}

function pathExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function trimLog(logText) {
  const text = String(logText || "").replace(/\r\n/g, "\n").trim();
  if (text.length <= MAX_LOG_CHARS) {
    return text;
  }

  return `${text.slice(0, 7_000)}\n\n... log truncated ...\n\n${text.slice(-12_000)}`;
}

function summarizeLatexLog(logText) {
  const log = trimLog(logText);
  const lines = log.split("\n").map((line) => line.trim()).filter(Boolean);
  const exitLine = lines.find((line) => /exited with code/i.test(line));
  const errorLine = lines.find((line) => line.startsWith("!"));
  const missingFileLine = lines.find((line) => /not found|cannot find|LaTeX Error: File .+ not found/i.test(line));
  const fatalLine = lines.find((line) => /fatal error|emergency stop|no output pdf/i.test(line));

  return errorLine || missingFileLine || fatalLine || exitLine || lines.slice(-1)[0] || "LaTeX compilation failed.";
}

function removeLatexComments(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|[^\\])%.*/, "$1"))
    .join("\n");
}

function injectBeforeBeginDocument(source, insertion) {
  const beginDocumentMatch = source.match(/\\begin\{document\}/);
  if (!beginDocumentMatch || beginDocumentMatch.index === undefined) {
    return `${insertion}\n${source}`;
  }

  return `${source.slice(0, beginDocumentMatch.index)}${insertion}\n${source.slice(beginDocumentMatch.index)}`;
}

function createFontAwesomeFallbacks(sourceWithoutComments) {
  const commandNames = new Set();
  for (const match of sourceWithoutComments.matchAll(/\\(fa[A-Z][A-Za-z]*)\b/g)) {
    commandNames.add(match[1]);
  }

  commandNames.delete("faIcon");

  const definitions = [
    "% CareerOS portable compiler fallback: omit FontAwesome icons when the bundled Windows engine cannot load the icon font.",
    "\\providecommand{\\faIcon}[2][]{}"
  ];

  for (const commandName of [...commandNames].sort()) {
    definitions.push(`\\providecommand{\\${commandName}}{}`);
  }

  return definitions.join("\n");
}

function findUnsupportedLocalCompileFeature(source) {
  const sourceWithoutComments = removeLatexComments(source);
  const shellEscapePackages = new Set(["asymptote", "gnuplottex", "minted", "pythontex", "sage", "svg"]);
  const packageMatches = sourceWithoutComments.matchAll(/\\usepackage(?:\[[^\]]*])?\{([^}]+)\}/g);

  for (const match of packageMatches) {
    const packages = match[1].split(",").map((entry) => entry.trim()).filter(Boolean);
    const unsupportedPackage = packages.find((packageName) => shellEscapePackages.has(packageName));
    if (unsupportedPackage) {
      return {
        feature: unsupportedPackage,
        reason: `${unsupportedPackage} requires shell-escape or an external executable, which CareerOS disables for local desktop compiles.`
      };
    }
  }

  if (/\\(?:immediate\s*)?write18\b/.test(sourceWithoutComments)) {
    return {
      feature: "\\write18",
      reason: "\\write18 shell commands are disabled for local desktop compiles."
    };
  }

  if (/\\inputminted\b|\\begin\{minted\}/.test(sourceWithoutComments)) {
    return {
      feature: "minted",
      reason: "minted requires shell-escape and Python Pygments, which CareerOS disables for local desktop compiles."
    };
  }

  return null;
}

function prepareSourceForTectonic(source) {
  const sourceWithoutComments = removeLatexComments(source);
  const hasFontAwesomePackage = /\\usepackage(?:\[[^\]]*])?\{fontawesome5\}/.test(sourceWithoutComments);

  if (!hasFontAwesomePackage || process.platform !== "win32") {
    return source;
  }

  const withoutFontAwesome = source.replace(/^[ \t]*\\usepackage(?:\[[^\]]*])?\{fontawesome5\}[ \t]*(?:\r?\n)?/gm, "");
  return injectBeforeBeginDocument(withoutFontAwesome, createFontAwesomeFallbacks(sourceWithoutComments));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function createTectonicEnvironment(workDirectory) {
  if (process.platform !== "win32") {
    return process.env;
  }

  const fontConfigDirectory = path.join(workDirectory, "fontconfig");
  const fontCacheDirectory = path.join(workDirectory, "font-cache");
  const windowsDirectory = process.env.WINDIR || "C:\\Windows";
  const windowsFontDirectory = path.join(windowsDirectory, "Fonts").replace(/\\/g, "/");
  const fontConfigPath = path.join(fontConfigDirectory, "fonts.conf");

  await fsp.mkdir(fontConfigDirectory, { recursive: true });
  await fsp.mkdir(fontCacheDirectory, { recursive: true });
  await fsp.writeFile(
    fontConfigPath,
    `<?xml version="1.0"?>
<fontconfig>
  <dir>${escapeXml(windowsFontDirectory)}</dir>
  <cachedir>${escapeXml(fontCacheDirectory.replace(/\\/g, "/"))}</cachedir>
</fontconfig>
`,
    "utf8"
  );

  return {
    ...process.env,
    FONTCONFIG_FILE: fontConfigPath,
    FONTCONFIG_PATH: fontConfigDirectory
  };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new LatexCompileError("Compile timed out.", { engine: options.engine, log: stdout || stderr }));
    }, options.timeoutMs ?? COMPILE_TIMEOUT_MS);

    child.stdout?.on("data", (chunk) => {
      stdout = trimLog(stdout + chunk.toString());
    });

    child.stderr?.on("data", (chunk) => {
      stderr = trimLog(stderr + chunk.toString());
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      resolve({
        code,
        stderr,
        stdout
      });
    });
  });
}

function getVersion(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    return "";
  }

  return (result.stdout || result.stderr || "").trim().split(/\r?\n/)[0] || "";
}

async function downloadFile(url, destination, redirectCount = 0) {
  if (redirectCount > 6) {
    throw new Error("Too many redirects while downloading the compiler.");
  }

  await fsp.mkdir(path.dirname(destination), { recursive: true });

  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(
      url,
      {
        headers: {
          "user-agent": "CareerOS Desktop"
        }
      },
      (response) => {
        const location = response.headers.location;
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location) {
          response.resume();
          downloadFile(new URL(location, url).toString(), destination, redirectCount + 1).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Compiler download failed with HTTP ${response.statusCode}.`));
          return;
        }

        const file = fs.createWriteStream(destination);
        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
        file.on("error", reject);
      }
    );

    request.on("error", reject);
  });
}

async function findFileByName(directory, fileName) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }

    if (entry.isDirectory()) {
      const found = await findFileByName(entryPath, fileName);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

async function extractArchive(archivePath, destination) {
  await fsp.mkdir(destination, { recursive: true });

  if (archivePath.endsWith(".zip")) {
    const extractZip = require("extract-zip");
    await extractZip(archivePath, { dir: destination });
    return;
  }

  const tar = require("tar");
  await tar.x({
    cwd: destination,
    file: archivePath
  });
}

async function installTectonicRuntime(baseDirectory, options = {}) {
  const targetPlatform = options.platform || process.platform;
  const targetArch = options.arch || process.arch;
  const target = getTectonicTarget(targetPlatform, targetArch);
  if (!target) {
    throw new Error(`No bundled compiler is configured for ${targetPlatform}-${targetArch}.`);
  }

  const targetDirectory = path.join(baseDirectory, target.key);
  const executablePath = path.join(targetDirectory, target.executableName);
  if (pathExists(executablePath)) {
    return executablePath;
  }

  const stagingDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), "careeros-tectonic-"));
  const archivePath = path.join(stagingDirectory, target.archiveName);
  const extractedDirectory = path.join(stagingDirectory, "extract");

  try {
    options.log?.info?.(`Downloading Tectonic ${TECTONIC_VERSION} from ${target.url}`);
    await downloadFile(target.url, archivePath);
    await extractArchive(archivePath, extractedDirectory);

    const extractedExecutable = await findFileByName(extractedDirectory, target.executableName);
    if (!extractedExecutable) {
      throw new Error(`Downloaded archive did not contain ${target.executableName}.`);
    }

    await fsp.mkdir(targetDirectory, { recursive: true });
    await fsp.copyFile(extractedExecutable, executablePath);

    if (targetPlatform !== "win32") {
      await fsp.chmod(executablePath, 0o755);
    }

    return executablePath;
  } finally {
    await fsp.rm(stagingDirectory, { force: true, recursive: true }).catch(() => {});
  }
}

function createLatexRuntime({ app, log }) {
  let installPromise = null;
  let installState = {
    message: "Portable compiler has not been installed yet.",
    state: "idle"
  };

  const target = getTectonicTarget();

  function getTectonicCandidates() {
    if (!target) {
      return [];
    }

    const candidates = [];
    if (app.isPackaged) {
      candidates.push({
        message: "Bundled with CareerOS Desktop.",
        path: path.join(process.resourcesPath, "latex", target.key, target.executableName)
      });
    }

    candidates.push(
      {
        message: "Bundled with CareerOS Desktop.",
        path: path.resolve(__dirname, "..", "vendor", "latex", target.key, target.executableName)
      },
      {
        message: "Installed inside CareerOS app data.",
        path: path.join(app.getPath("userData"), "latex", target.key, target.executableName)
      }
    );

    return candidates;
  }

  function getTectonicRuntime() {
    const found = getTectonicCandidates().find((candidate) => pathExists(candidate.path));
    if (!found) {
      return null;
    }

    return {
      available: true,
      executablePath: found.path,
      installMessage: found.message,
      installState: "installed",
      kind: "tectonic",
      name: "Tectonic LaTeX",
      version: getVersion(found.path, ["--version"])
    };
  }

  function getPdflatexRuntime() {
    const candidates =
      process.platform === "win32"
        ? [
            "pdflatex",
            "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
            "C:\\Program Files\\MiKTeX\\miktex\\bin\\pdflatex.exe",
            "C:\\texlive\\2026\\bin\\windows\\pdflatex.exe",
            "C:\\texlive\\2025\\bin\\windows\\pdflatex.exe",
            "C:\\texlive\\2024\\bin\\windows\\pdflatex.exe"
          ]
        : ["pdflatex", "/usr/bin/pdflatex", "/usr/local/bin/pdflatex"];

    for (const candidate of candidates) {
      const version = getVersion(candidate, ["--version"]);
      if (version) {
        return {
          available: true,
          executablePath: candidate,
          installMessage: "Detected on this computer.",
          installState: "installed",
          kind: "pdflatex",
          name: "pdfLaTeX",
          version
        };
      }
    }

    return null;
  }

  function getStatus() {
    const tectonicRuntime = getTectonicRuntime();
    if (tectonicRuntime) {
      return tectonicRuntime;
    }

    const pdflatexRuntime = getPdflatexRuntime();
    if (pdflatexRuntime) {
      return pdflatexRuntime;
    }

    return {
      available: false,
      installMessage: installState.message,
      installState: installState.state,
      kind: "missing",
      name: "Portable LaTeX compiler"
    };
  }

  async function installCompiler() {
    const existing = getTectonicRuntime();
    if (existing) {
      installState = {
        message: "Portable compiler is already installed.",
        state: "installed"
      };
      return existing;
    }

    if (installPromise) {
      return installPromise;
    }

    installState = {
      message: "Installing portable LaTeX compiler...",
      state: "installing"
    };

    installPromise = installTectonicRuntime(path.join(app.getPath("userData"), "latex"), { log })
      .then(() => {
        installState = {
          message: "Portable compiler installed.",
          state: "installed"
        };
        return getStatus();
      })
      .catch((error) => {
        installState = {
          message: error instanceof Error ? error.message : "Portable compiler install failed.",
          state: "failed"
        };
        throw error;
      })
      .finally(() => {
        installPromise = null;
      });

    return installPromise;
  }

  async function compileWithTectonic(runtime, source) {
    const workDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), "careeros-latex-"));
    const outputDirectory = path.join(workDirectory, "out");
    const inputPath = path.join(workDirectory, "resume.tex");
    const pdfPath = path.join(outputDirectory, "resume.pdf");

    try {
      await fsp.mkdir(outputDirectory, { recursive: true });
      await fsp.writeFile(inputPath, prepareSourceForTectonic(source), "utf8");

      const result = await runProcess(
        runtime.executablePath,
        ["--keep-logs", "--keep-intermediates", "--outdir", outputDirectory, inputPath],
        {
          cwd: workDirectory,
          engine: runtime.name,
          env: await createTectonicEnvironment(workDirectory),
          timeoutMs: COMPILE_TIMEOUT_MS
        }
      );

      if (result.code !== 0) {
        const logText = await fsp.readFile(path.join(outputDirectory, "resume.log"), "utf8").catch(() => "");
        const exitSummary = `${runtime.name} exited with code ${result.code}.`;
        const fullLog = trimLog([logText, result.stderr, result.stdout, exitSummary].filter(Boolean).join("\n"));
        throw new LatexCompileError(summarizeLatexLog(fullLog), {
          engine: runtime.name,
          log: fullLog
        });
      }

      return {
        engine: runtime.name,
        log: trimLog(result.stdout || result.stderr),
        pdfBuffer: await fsp.readFile(pdfPath)
      };
    } finally {
      await fsp.rm(workDirectory, { force: true, recursive: true }).catch(() => {});
    }
  }

  async function compileWithPdflatex(runtime, source) {
    const workDirectory = await fsp.mkdtemp(path.join(os.tmpdir(), "careeros-latex-"));
    const outputDirectory = path.join(workDirectory, "out");
    const inputPath = path.join(workDirectory, "resume.tex");
    const pdfPath = path.join(outputDirectory, "resume.pdf");

    try {
      await fsp.mkdir(outputDirectory, { recursive: true });
      await fsp.writeFile(inputPath, source, "utf8");

      let lastResult = null;
      for (let run = 0; run < 2; run += 1) {
        const args = [
          "-interaction=nonstopmode",
          "-halt-on-error",
          "-file-line-error",
          "-output-directory",
          outputDirectory,
          inputPath
        ];

        if (/miktex/i.test(`${runtime.executablePath} ${runtime.version || ""}`)) {
          args.unshift("--enable-installer");
        }

        lastResult = await runProcess(
          runtime.executablePath,
          args,
          {
            cwd: workDirectory,
            engine: runtime.name,
            env: process.env,
            timeoutMs: COMPILE_TIMEOUT_MS
          }
        );

        if (lastResult.code !== 0) {
          const logText = await fsp.readFile(path.join(outputDirectory, "resume.log"), "utf8").catch(() => "");
          const fullLog = logText || lastResult.stderr || lastResult.stdout;
          throw new LatexCompileError(summarizeLatexLog(fullLog), {
            engine: runtime.name,
            log: fullLog
          });
        }
      }

      return {
        engine: runtime.name,
        log: trimLog(lastResult?.stdout || lastResult?.stderr),
        pdfBuffer: await fsp.readFile(pdfPath)
      };
    } finally {
      await fsp.rm(workDirectory, { force: true, recursive: true }).catch(() => {});
    }
  }

  async function compile(sourceCode) {
    const source = typeof sourceCode === "string" ? sourceCode.trim() : "";
    if (!source) {
      throw new LatexCompileError("LaTeX source is empty.", { engine: "CareerOS" });
    }

    const unsupportedFeature = findUnsupportedLocalCompileFeature(source);
    if (unsupportedFeature) {
      throw new LatexCompileError(unsupportedFeature.reason, {
        engine: "CareerOS Desktop",
        log: [
          `Unsupported local compile feature: ${unsupportedFeature.feature}`,
          unsupportedFeature.reason,
          "Use listings/verbatim for code blocks, or remove the shell-escape dependency before compiling locally."
        ].join("\n")
      });
    }

    let runtime = getTectonicRuntime();

    if (!runtime && target) {
      try {
        runtime = await installCompiler();
      } catch (error) {
        log?.warn?.("Portable LaTeX install failed; falling back to system pdfLaTeX if available.", error);
      }
    }

    runtime = runtime || getPdflatexRuntime() || getStatus();
    if (!runtime.available) {
      throw new LatexCompileError(runtime.installMessage || "No local LaTeX compiler is available.", {
        engine: runtime.name
      });
    }

    if (runtime.kind === "tectonic") {
      try {
        return await compileWithTectonic(runtime, source);
      } catch (error) {
        const pdflatexRuntime = getPdflatexRuntime();
        if (!pdflatexRuntime) {
          throw error;
        }

        log?.warn?.("Tectonic compile failed; trying pdfLaTeX fallback.", error);
        try {
          return await compileWithPdflatex(pdflatexRuntime, source);
        } catch (fallbackError) {
          if (fallbackError instanceof LatexCompileError && error instanceof LatexCompileError) {
            fallbackError.log = trimLog(
              [
                `${error.engine} failed first:`,
                error.log,
                "",
                `${fallbackError.engine} fallback failed:`,
                fallbackError.log
              ].join("\n")
            );
          }
          throw fallbackError;
        }
      }
    }

    return compileWithPdflatex(runtime, source);
  }

  return {
    compile,
    getStatus,
    installCompiler,
    maxSourceLength: MAX_SOURCE_LENGTH
  };
}

module.exports = {
  LatexCompileError,
  TECTONIC_VERSION,
  createLatexRuntime,
  getTectonicTarget,
  installTectonicRuntime
};
