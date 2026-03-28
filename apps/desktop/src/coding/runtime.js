"use strict";

/**
 * Local multi-language judge engine for the CareerOS Desktop Coding arena.
 *
 * This mirrors the shape of latex-runtime.js: it detects toolchains already
 * installed on the user's machine (we do not attempt to bundle full
 * compilers for six languages), compiles user source when needed, and runs
 * it against a set of stdin/stdout test cases with a timeout and output cap.
 *
 * Supported languages: c, cpp, java, javascript, python, rust.
 */

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const DEFAULT_RUN_TIMEOUT_MS = 6_000;
const DEFAULT_COMPILE_TIMEOUT_MS = 25_000;
const MAX_OUTPUT_BYTES = 400_000;
const VERSION_PROBE_TIMEOUT_MS = 4_000;

function pathExists(candidate) {
  try {
    fs.accessSync(candidate, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isWindows() {
  return process.platform === "win32";
}

function exeName(base) {
  return isWindows() ? `${base}.exe` : base;
}

/**
 * Runs `command --version`-style probes and returns the first non-empty
 * output line, or "" if the command could not be run at all. Never throws.
 */
function probeVersion(command, args) {
  try {
    const result = spawnSync(command, args, {
      encoding: "utf8",
      timeout: VERSION_PROBE_TIMEOUT_MS,
      windowsHide: true
    });
    if (result.error) return "";
    const text = (result.stdout || result.stderr || "").trim();
    return text.split(/\r?\n/)[0] || "";
  } catch {
    return "";
  }
}

function uniq(list) {
  return [...new Set(list.filter(Boolean))];
}

/* ------------------------------------------------------------------ */
/* Toolchain candidate lists                                           */
/* ------------------------------------------------------------------ */

function cargoBinDir() {
  return path.join(os.homedir(), ".cargo", "bin");
}

function commonWindowsToolDirs(toolFolderNames) {
  // Best-effort common install locations on Windows for compilers that are
  // not always added to PATH by their installers.
  const roots = ["C:\\", "C:\\Program Files", "C:\\Program Files (x86)"];
  const dirs = [];
  for (const root of roots) {
    for (const folder of toolFolderNames) {
      dirs.push(path.join(root, folder));
    }
  }
  return dirs;
}

function getCCandidates() {
  if (isWindows()) {
    return uniq([
      "gcc",
      path.join("C:\\msys64\\mingw64\\bin", "gcc.exe"),
      path.join("C:\\msys64\\ucrt64\\bin", "gcc.exe"),
      path.join("C:\\MinGW\\bin", "gcc.exe"),
      path.join("C:\\TDM-GCC-64\\bin", "gcc.exe")
    ]);
  }
  return uniq(["gcc", "cc", "/usr/bin/gcc", "/usr/local/bin/gcc"]);
}

function getCppCandidates() {
  if (isWindows()) {
    return uniq([
      "g++",
      path.join("C:\\msys64\\mingw64\\bin", "g++.exe"),
      path.join("C:\\msys64\\ucrt64\\bin", "g++.exe"),
      path.join("C:\\MinGW\\bin", "g++.exe"),
      path.join("C:\\TDM-GCC-64\\bin", "g++.exe")
    ]);
  }
  return uniq(["g++", "/usr/bin/g++", "/usr/local/bin/g++"]);
}

function getPythonCandidates() {
  if (isWindows()) {
    return uniq(["python", "python3", "py"]);
  }
  return uniq(["python3", "python", "/usr/bin/python3", "/usr/local/bin/python3"]);
}

function getRustcCandidates() {
  const cargoRustc = path.join(cargoBinDir(), exeName("rustc"));
  if (isWindows()) {
    return uniq(["rustc", cargoRustc]);
  }
  return uniq(["rustc", cargoRustc, "/usr/bin/rustc", "/usr/local/bin/rustc"]);
}

function getJavaHomeCandidate(binaryName) {
  const javaHome = process.env.JAVA_HOME;
  if (!javaHome) return null;
  return path.join(javaHome, "bin", exeName(binaryName));
}

function scanWindowsJdkInstalls(binaryName) {
  // JDK installers on Windows frequently skip adding javac/java to PATH, so
  // fall back to scanning the usual install roots for jdk-*/bin/<binary>.
  if (!isWindows()) return [];

  const roots = ["C:\\Program Files\\Java", "C:\\Program Files (x86)\\Java", "C:\\Program Files\\Eclipse Adoptium"];
  const found = [];
  for (const root of roots) {
    let entries = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      found.push(path.join(root, entry.name, "bin", exeName(binaryName)));
    }
  }
  return found;
}

function getJavacCandidates() {
  const fromHome = getJavaHomeCandidate("javac");
  return uniq(["javac", fromHome, ...scanWindowsJdkInstalls("javac")]);
}

function getJavaBinaryCandidates() {
  const fromHome = getJavaHomeCandidate("java");
  return uniq(["java", fromHome, ...scanWindowsJdkInstalls("java")]);
}

function findWorkingCandidate(candidates, versionArgs) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    // If it looks like an absolute path, make sure it actually exists before
    // spawning (avoids slow/noisy ENOENT probes on some platforms).
    if (path.isAbsolute(candidate) && !pathExists(candidate)) continue;
    const version = probeVersion(candidate, versionArgs);
    if (version) return { command: candidate, version };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Language runtime detection                                          */
/* ------------------------------------------------------------------ */

function detectC() {
  const found = findWorkingCandidate(getCCandidates(), ["--version"]);
  if (!found) {
    return {
      available: false,
      message: "No C compiler found. Install GCC (e.g. MinGW-w64 on Windows, build-essential on Linux) and ensure gcc is on PATH."
    };
  }
  return { available: true, command: found.command, version: found.version, message: `Detected ${found.version}` };
}

function detectCpp() {
  const found = findWorkingCandidate(getCppCandidates(), ["--version"]);
  if (!found) {
    return {
      available: false,
      message: "No C++ compiler found. Install GCC/G++ (e.g. MinGW-w64 on Windows, build-essential on Linux) and ensure g++ is on PATH."
    };
  }
  return { available: true, command: found.command, version: found.version, message: `Detected ${found.version}` };
}

function detectPython() {
  const found = findWorkingCandidate(getPythonCandidates(), ["--version"]);
  if (!found) {
    return {
      available: false,
      message: "No Python interpreter found. Install Python 3 and ensure python3 (or python) is on PATH."
    };
  }
  return { available: true, command: found.command, version: found.version, message: `Detected ${found.version}` };
}

function detectRust() {
  const found = findWorkingCandidate(getRustcCandidates(), ["--version"]);
  if (!found) {
    return {
      available: false,
      message: "No Rust compiler found. Install Rust via rustup (https://rustup.rs) and ensure rustc is on PATH."
    };
  }
  return { available: true, command: found.command, version: found.version, message: `Detected ${found.version}` };
}

function detectJava() {
  const javac = findWorkingCandidate(getJavacCandidates(), ["-version"]);
  if (javac) {
    return {
      available: true,
      command: javac.command,
      version: javac.version,
      mode: "compiled",
      message: `Detected ${javac.version}`
    };
  }

  // Fall back to single-file source-launcher mode (`java Main.java`),
  // supported since JDK 11, which works even with some minimal Java
  // installs that ship java but not a standalone javac on PATH.
  const java = findWorkingCandidate(getJavaBinaryCandidates(), ["-version"]);
  if (java) {
    return {
      available: true,
      command: java.command,
      version: java.version,
      mode: "source-launch",
      message: `Detected ${java.version} (using single-file source launch; install a full JDK for faster repeated runs)`
    };
  }

  return {
    available: false,
    message: "No Java runtime found. Install a JDK (11+) and ensure javac/java are on PATH, or set JAVA_HOME."
  };
}

function detectJavaScript() {
  // JavaScript always runs through the Node runtime bundled with Electron
  // itself (via ELECTRON_RUN_AS_NODE), so it never depends on anything the
  // user needs to install.
  return {
    available: true,
    command: process.execPath,
    version: process.version,
    message: `Bundled with CareerOS Desktop (Node ${process.version})`
  };
}

function detectAllRuntimes() {
  return {
    c: detectC(),
    cpp: detectCpp(),
    java: detectJava(),
    javascript: detectJavaScript(),
    python: detectPython(),
    rust: detectRust()
  };
}

/* ------------------------------------------------------------------ */
/* Process execution helpers                                           */
/* ------------------------------------------------------------------ */

class JudgeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "JudgeError";
    this.stage = details.stage || "run";
    this.log = details.log || message;
  }
}

function describeCrashSignal(signal) {
  switch (signal) {
    case "SIGSEGV":
      return "commonly an out-of-bounds array access or an invalid/null pointer dereference";
    case "SIGFPE":
      return "commonly an integer divide-by-zero or invalid arithmetic operation";
    case "SIGABRT":
      return "the program called abort(), often from a failed assertion or a C++ exception with no handler";
    case "SIGILL":
      return "the CPU hit an invalid instruction, often triggered by undefined behavior such as divide-by-zero or corrupted control flow";
    case "SIGBUS":
      return "an invalid memory alignment or access, similar to an out-of-bounds pointer dereference";
    case "SIGKILL":
      return "the process was forcibly terminated, most likely for exceeding a memory limit";
    default:
      return "an unhandled runtime fault in your program";
  }
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env || process.env,
        windowsHide: true
      });
    } catch (error) {
      resolve({ code: null, stdout: "", stderr: String(error && error.message ? error.message : error), timedOut: false, spawnError: true });
      return;
    }

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, options.timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS);

    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    }

    child.stdout?.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString();
    });

    child.on("error", (error) => {
      finish({ code: null, stdout, stderr: stderr || String(error.message || error), timedOut, spawnError: true });
    });

    child.on("close", (code, signal) => {
      // A process can die from a signal (SIGSEGV, SIGABRT, SIGFPE, ...)
      // without ever writing to stderr - e.g. an out-of-bounds array access
      // in C/C++/Rust. Without this, the user would see a blank "failed"
      // result with no explanation at all. Synthesize a clear message so a
      // crash never looks like a silent no-op.
      let finalStderr = stderr;
      if (!timedOut && code === null && signal && !finalStderr.trim()) {
        finalStderr = `Program crashed with signal ${signal} before finishing (${describeCrashSignal(signal)}).`;
      }
      finish({ code, stdout, stderr: finalStderr, timedOut, spawnError: false, signal: signal || null });
    });

    if (options.stdin !== undefined) {
      child.stdin.on("error", () => {
        // Ignore EPIPE-style errors if the process exits before we finish
        // writing (e.g. it errors out early); the close handler still fires.
      });
      child.stdin.write(options.stdin);
      child.stdin.end();
    } else {
      child.stdin?.end();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Per-language build + run                                            */
/* ------------------------------------------------------------------ */

async function prepareWorkspace() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "careeros-judge-"));
  return dir;
}

async function cleanupWorkspace(dir) {
  await fsp.rm(dir, { force: true, recursive: true }).catch(() => {});
}

async function buildRunnable(language, source, runtimeInfo, workDir) {
  switch (language) {
    case "javascript": {
      const filePath = path.join(workDir, "sol.js");
      await fsp.writeFile(filePath, source, "utf8");
      return {
        run: (stdinText, timeoutMs) =>
          runProcess(runtimeInfo.command, [filePath], {
            cwd: workDir,
            env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
            stdin: stdinText,
            timeoutMs
          })
      };
    }

    case "python": {
      const filePath = path.join(workDir, "sol.py");
      await fsp.writeFile(filePath, source, "utf8");
      return {
        run: (stdinText, timeoutMs) =>
          runProcess(runtimeInfo.command, [filePath], { cwd: workDir, stdin: stdinText, timeoutMs })
      };
    }

    case "c": {
      const filePath = path.join(workDir, "sol.c");
      const exePath = path.join(workDir, exeName("sol"));
      await fsp.writeFile(filePath, source, "utf8");
      const compileResult = await runProcess(
        runtimeInfo.command,
        ["-O2", "-std=gnu11", "-o", exePath, filePath, "-lm"],
        { cwd: workDir, timeoutMs: DEFAULT_COMPILE_TIMEOUT_MS }
      );
      if (compileResult.code !== 0) {
        throw new JudgeError("Compilation failed.", { stage: "compile", log: compileResult.stderr || compileResult.stdout });
      }
      return {
        run: (stdinText, timeoutMs) => runProcess(exePath, [], { cwd: workDir, stdin: stdinText, timeoutMs })
      };
    }

    case "cpp": {
      const filePath = path.join(workDir, "sol.cpp");
      const exePath = path.join(workDir, exeName("sol"));
      await fsp.writeFile(filePath, source, "utf8");
      const compileResult = await runProcess(
        runtimeInfo.command,
        ["-O2", "-std=c++17", "-o", exePath, filePath],
        { cwd: workDir, timeoutMs: DEFAULT_COMPILE_TIMEOUT_MS }
      );
      if (compileResult.code !== 0) {
        throw new JudgeError("Compilation failed.", { stage: "compile", log: compileResult.stderr || compileResult.stdout });
      }
      return {
        run: (stdinText, timeoutMs) => runProcess(exePath, [], { cwd: workDir, stdin: stdinText, timeoutMs })
      };
    }

    case "rust": {
      const filePath = path.join(workDir, "sol.rs");
      const exePath = path.join(workDir, exeName("sol"));
      await fsp.writeFile(filePath, source, "utf8");
      const compileResult = await runProcess(
        runtimeInfo.command,
        ["-O", "-o", exePath, filePath],
        { cwd: workDir, timeoutMs: DEFAULT_COMPILE_TIMEOUT_MS }
      );
      if (compileResult.code !== 0) {
        throw new JudgeError("Compilation failed.", { stage: "compile", log: compileResult.stderr || compileResult.stdout });
      }
      return {
        run: (stdinText, timeoutMs) => runProcess(exePath, [], { cwd: workDir, stdin: stdinText, timeoutMs })
      };
    }

    case "java": {
      const filePath = path.join(workDir, "Main.java");
      await fsp.writeFile(filePath, source, "utf8");

      if (runtimeInfo.mode === "source-launch") {
        // `java Main.java` compiles-and-runs in one step (JEP 330), so we
        // just validate it can at least parse here and defer real errors to
        // the first actual test run (keeps behavior close to `compiled`).
        return {
          run: (stdinText, timeoutMs) =>
            runProcess(runtimeInfo.command, [filePath], { cwd: workDir, stdin: stdinText, timeoutMs })
        };
      }

      const javaBinary = runtimeInfo.javaCommand || "java";
      const compileResult = await runProcess(runtimeInfo.command, [filePath, "-d", workDir], {
        cwd: workDir,
        timeoutMs: DEFAULT_COMPILE_TIMEOUT_MS
      });
      if (compileResult.code !== 0) {
        throw new JudgeError("Compilation failed.", { stage: "compile", log: compileResult.stderr || compileResult.stdout });
      }
      return {
        run: (stdinText, timeoutMs) =>
          runProcess(javaBinary, ["-cp", workDir, "Main"], { cwd: workDir, stdin: stdinText, timeoutMs })
      };
    }

    default:
      throw new JudgeError(`Unsupported language: ${language}`, { stage: "setup" });
  }
}

/* ------------------------------------------------------------------ */
/* Output comparison                                                   */
/* ------------------------------------------------------------------ */

function normalizeOutput(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/, "")
    .trim();
}

function looksNumeric(line) {
  return /^-?\d+(\.\d+)?$/.test(line.trim());
}

function outputsMatch(expected, actual) {
  const normExpected = normalizeOutput(expected);
  const normActual = normalizeOutput(actual);
  if (normExpected === normActual) return true;

  // Tolerant fallback for floating point rounding differences across
  // language runtimes (e.g. a boundary case rounding 0.5 differently).
  const expectedLines = normExpected.split("\n");
  const actualLines = normActual.split("\n");
  if (expectedLines.length !== actualLines.length) return false;

  for (let i = 0; i < expectedLines.length; i++) {
    const e = expectedLines[i].trim();
    const a = actualLines[i].trim();
    if (e === a) continue;
    if (!looksNumeric(e) || !looksNumeric(a)) return false;
    if (Math.abs(parseFloat(e) - parseFloat(a)) > 1e-4) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

function createCodeRuntime({ log } = {}) {
  let cachedStatus = null;
  let cachedAt = 0;
  const STATUS_CACHE_MS = 15_000;

  function getRuntimeStatus(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedStatus && now - cachedAt < STATUS_CACHE_MS) {
      return cachedStatus;
    }
    cachedStatus = detectAllRuntimes();
    cachedAt = now;
    return cachedStatus;
  }

  async function runTests({ language, source, tests, timeoutMs }) {
    const statuses = getRuntimeStatus();
    const runtimeInfo = statuses[language];
    if (!runtimeInfo || !runtimeInfo.available) {
      throw new JudgeError(
        (runtimeInfo && runtimeInfo.message) || `Language "${language}" is not available on this machine.`,
        { stage: "setup" }
      );
    }
    if (language === "java" && runtimeInfo.mode === "compiled") {
      runtimeInfo.javaCommand = findWorkingCandidate(getJavaBinaryCandidates(), ["-version"])?.command || "java";
    }

    const trimmedSource = typeof source === "string" ? source : "";
    if (!trimmedSource.trim()) {
      throw new JudgeError("Your solution is empty.", { stage: "setup" });
    }
    if (trimmedSource.length > 200_000) {
      throw new JudgeError("Source is too large.", { stage: "setup" });
    }

    const workDir = await prepareWorkspace();
    try {
      const runnable = await buildRunnable(language, trimmedSource, runtimeInfo, workDir);

      const results = [];
      for (let i = 0; i < tests.length; i++) {
        const test = tests[i];
        const start = Date.now();
        const execResult = await runnable.run(test.input ?? "", timeoutMs ?? DEFAULT_RUN_TIMEOUT_MS);
        const elapsedMs = Date.now() - start;

        if (execResult.timedOut) {
          results.push({
            index: i,
            input: test.input,
            expectedOutput: test.output,
            actualOutput: "",
            stderr: "Time limit exceeded.",
            passed: false,
            timedOut: true,
            timeMs: elapsedMs
          });
          continue;
        }

        if (execResult.spawnError) {
          results.push({
            index: i,
            input: test.input,
            expectedOutput: test.output,
            actualOutput: "",
            stderr: execResult.stderr || "Failed to run program.",
            passed: false,
            runtimeError: true,
            timeMs: elapsedMs
          });
          continue;
        }

        const hasExpected = typeof test.output === "string";
        const crashed = execResult.code !== 0;
        const passed = crashed ? false : hasExpected ? outputsMatch(test.output, execResult.stdout) : undefined;

        results.push({
          index: i,
          input: test.input,
          expectedOutput: test.output,
          actualOutput: execResult.stdout,
          stderr: execResult.stderr || "",
          exitCode: execResult.code,
          signal: execResult.signal || null,
          runtimeError: crashed,
          passed,
          timeMs: elapsedMs
        });
      }

      return { compileError: null, results };
    } catch (error) {
      if (error instanceof JudgeError && error.stage === "compile") {
        return { compileError: error.log || error.message, results: [] };
      }
      throw error;
    } finally {
      await cleanupWorkspace(workDir);
    }
  }

  return {
    getRuntimeStatus,
    runTests
  };
}

module.exports = {
  createCodeRuntime,
  JudgeError,
  outputsMatch,
  normalizeOutput
};
