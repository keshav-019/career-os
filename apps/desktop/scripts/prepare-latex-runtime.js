const path = require("node:path");
const {
  TECTONIC_VERSION,
  getTectonicTarget,
  installTectonicRuntime,
} = require("../src/latex-runtime");

const vendorDirectory = path.resolve(__dirname, "..", "vendor", "latex");

function getArgValue(name) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex !== -1) {
    return process.argv[exactIndex + 1] || "";
  }

  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function parseTarget() {
  const targetKey = (
    getArgValue("--target") ||
    process.argv.slice(2).find((arg) => !arg.startsWith("-")) ||
    ""
  ).trim();
  if (!targetKey) {
    return {
      arch: process.arch,
      platform: process.platform,
    };
  }

  const parts = targetKey.split("-");
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

async function main() {
  const runtimeTarget = parseTarget();
  const target = getTectonicTarget(runtimeTarget.platform, runtimeTarget.arch);

  if (!target) {
    throw new Error(
      `Tectonic ${TECTONIC_VERSION} is not configured for ${runtimeTarget.platform}-${runtimeTarget.arch}.`,
    );
  }

  const executablePath = await installTectonicRuntime(vendorDirectory, {
    arch: runtimeTarget.arch,
    platform: runtimeTarget.platform,
    log: console,
  });

  console.log(
    `Prepared Tectonic ${TECTONIC_VERSION} for ${target.key}: ${executablePath}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
