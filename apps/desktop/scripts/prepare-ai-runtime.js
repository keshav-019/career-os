const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MODEL = "openrouter/free";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (entry && !process.env[entry.key]) {
      process.env[entry.key] = entry.value;
    }
  }
}

function main() {
  const repoRoot = path.resolve(__dirname, "../../..");
  loadEnvFile(path.join(repoRoot, ".env.local"));
  loadEnvFile(path.join(repoRoot, "apps", "web", ".env.local"));

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
