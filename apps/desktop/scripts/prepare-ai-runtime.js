const path = require("node:path");
const { loadCareerOsEnv } = require("../../../scripts/load-careeros-env.cjs");

const DEFAULT_MODEL = "openrouter/free";

function main() {
  loadCareerOsEnv({ cwd: path.resolve(__dirname, "..") });

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  console.log("CareerOS AI inference uses the configured OpenRouter endpoint.");
  console.log(`OPENROUTER_MODEL=${model}`);

  if (!process.env.OPENROUTER_API_KEY) {
    console.log("OPENROUTER_API_KEY is not set. Add it to .env.local for development or to hosting environment variables for production.");
    return;
  }

  console.log("OPENROUTER_API_KEY is configured.");
}

main();
