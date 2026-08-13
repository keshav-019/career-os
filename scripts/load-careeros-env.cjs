const fs = require("node:fs");
const path = require("node:path");

const PUBLIC_ENV_FALLBACKS = Object.freeze({
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyBEZap2qVQ9yZYWhaHBOaUXfJxB_rvMaCQ",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "career-os-9aa87.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "career-os-9aa87",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "career-os-9aa87.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "730846222539",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:730846222539:web:cdc52392353badf569234e",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-76V7V21WDS",
  NEXT_PUBLIC_R2_PUBLIC_BASE_URL: "https://pub-33382a89004f4a9f9dc850cbcac5fedd.r2.dev",
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "depzyau1x",
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: "profile_pics",
  NEXT_PUBLIC_APP_URL: "https://keshav-019-career-os.vercel.app",
  NEXT_PUBLIC_SITE_URL: "https://keshav-019-career-os.vercel.app",
  EXPO_PUBLIC_CAREEROS_API_BASE_URL: "https://careerosbackend.projectyourown.com",
  EXPO_PUBLIC_CAREEROS_LEGACY_WEB_BASE_URL: "https://keshav-019-career-os.vercel.app"
});

const EQUIVALENT_ENV_GROUPS = Object.freeze([
  ["FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY", "EXPO_PUBLIC_FIREBASE_API_KEY"],
  ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"],
  ["FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "EXPO_PUBLIC_FIREBASE_PROJECT_ID"],
  ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"],
  ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"],
  ["NEXT_PUBLIC_FIREBASE_APP_ID", "EXPO_PUBLIC_FIREBASE_APP_ID"],
  ["NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", "EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID"],
  ["R2_PUBLIC_BASE_URL", "NEXT_PUBLIC_R2_PUBLIC_BASE_URL", "EXPO_PUBLIC_R2_PUBLIC_BASE_URL"],
  ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME"],
  ["NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET", "EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET"],
  ["APP_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"]
]);

function hasEnvValue(key) {
  return Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key] !== "";
}

function setEnvIfMissing(key, value) {
  if (!hasEnvValue(key) && value !== undefined && value !== null && String(value).length > 0) {
    process.env[key] = String(value);
    return true;
  }

  return false;
}

function parseEnvLine(line) {
  let trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  if (trimmed.startsWith("export ")) {
    trimmed = trimmed.slice("export ".length).trim();
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  let value = trimmed.slice(separatorIndex + 1).trim();
  const quote = value[0];
  if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1);
  } else {
    value = value.replace(/\s+#.*$/, "").trim();
  }

  return { key, value };
}

function loadEnvFile(filePath, options = {}) {
  const override = options.override === true;
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  const loadedKeys = [];
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const entry = parseEnvLine(line);
    if (!entry) {
      continue;
    }

    if (override || setEnvIfMissing(entry.key, entry.value)) {
      if (override) {
        process.env[entry.key] = entry.value;
      }
      loadedKeys.push(entry.key);
    }
  }

  return loadedKeys;
}

function findRepoRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    const packageJsonPath = path.join(current, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        if (packageJson.name === "careeros" && Array.isArray(packageJson.workspaces)) {
          return current;
        }
      } catch {
        // Keep walking up.
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Unable to find CareerOS repo root from ${startDir}.`);
    }
    current = parent;
  }
}

function applyEnvAliases() {
  for (const group of EQUIVALENT_ENV_GROUPS) {
    const sourceKey = group.find((key) => hasEnvValue(key));
    if (!sourceKey) {
      continue;
    }

    const sourceValue = process.env[sourceKey];
    for (const key of group) {
      setEnvIfMissing(key, sourceValue);
    }
  }
}

function applyPublicFallbacks() {
  for (const [key, value] of Object.entries(PUBLIC_ENV_FALLBACKS)) {
    setEnvIfMissing(key, value);
  }
}

function loadCareerOsEnv(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const repoRoot = findRepoRoot(cwd);
  const loadedFiles = [];
  const rootFiles = [
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env")
  ];

  for (const filePath of rootFiles) {
    if (fs.existsSync(filePath)) {
      loadEnvFile(filePath);
      loadedFiles.push(filePath);
    }
  }

  applyEnvAliases();
  if (options.includePublicFallbacks !== false) {
    applyPublicFallbacks();
    applyEnvAliases();
  }

  return { loadedFiles, repoRoot };
}

module.exports = {
  applyEnvAliases,
  loadCareerOsEnv,
  loadEnvFile,
  parseEnvLine
};
