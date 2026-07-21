const path = require("node:path");
const { TECTONIC_VERSION, getTectonicTarget, installTectonicRuntime } = require("../src/latex-runtime");

const vendorDirectory = path.resolve(__dirname, "..", "vendor", "latex");
const target = getTectonicTarget();

async function main() {
  if (!target) {
    throw new Error(`Tectonic ${TECTONIC_VERSION} is not configured for ${process.platform}-${process.arch}.`);
  }

  const executablePath = await installTectonicRuntime(vendorDirectory, {
    log: console
  });

  console.log(`Prepared Tectonic ${TECTONIC_VERSION} for ${target.key}: ${executablePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
