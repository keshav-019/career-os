const fs = require("node:fs");
const path = require("node:path");
const { getTectonicTarget } = require("../src/latex-runtime");

function parseTargetKey(targetKey) {
  const parts = String(targetKey || "").split("-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid LaTeX runtime target "${targetKey}". Expected format like win32-x64.`,
    );
  }

  return {
    arch: parts[1],
    platform: parts[0],
  };
}

function main() {
  const targetKey = process.argv[2] || "win32-x64";
  const runtimeTarget = parseTargetKey(targetKey);
  const target = getTectonicTarget(runtimeTarget.platform, runtimeTarget.arch);

  if (!target) {
    throw new Error(`No Tectonic runtime is configured for ${targetKey}.`);
  }

  const bundledCompilerPath = path.resolve(
    __dirname,
    "..",
    "dist",
    "win-unpacked",
    "resources",
    "latex",
    target.key,
    target.executableName,
  );

  if (!fs.existsSync(bundledCompilerPath)) {
    throw new Error(
      `Packaged LaTeX compiler is missing: ${bundledCompilerPath}. Run prepare:latex:win before building the Windows desktop app.`,
    );
  }

  const stat = fs.statSync(bundledCompilerPath);
  if (!stat.isFile() || stat.size < 1_000_000) {
    throw new Error(
      `Packaged LaTeX compiler looks invalid: ${bundledCompilerPath}`,
    );
  }

  console.log(
    `Verified bundled LaTeX compiler: ${bundledCompilerPath} (${stat.size} bytes)`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
