declare const process: { env: Record<string, string | undefined> };

const readPublicEnv = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

/**
 * Central place for public mobile config. Values come from the repo-root .env.local via the mobile npm scripts,
 * with production-safe public fallbacks so a fresh checkout can still run against the hosted CareerOS services.
 */

/** apps/mobile-backend's origin (see that app's README for why it exists) - AI Match, interview templates/MCQ
 *  review, and system design all go here. Every apiGet/apiPost call defaults to this base unless a call site
 *  explicitly overrides it (see LEGACY_WEB_BASE_URL below). */
export const API_BASE_URL = readPublicEnv(
  process.env.EXPO_PUBLIC_CAREEROS_API_BASE_URL,
  "https://careerosbackend.projectyourown.com"
);

/** The original deployed CareerOS web app's origin. Only the learning content routes (/api/learning/library,
 *  /api/learning/topic) and their figure images still live here - that content never touched Firebase Admin, so
 *  it was never affected by the crash that moved everything else to apps/mobile-backend, and wasn't worth
 *  duplicating (the learning material and its images are 80MB+). See lib/learningClient.ts for the two call
 *  sites that use this instead of the default API_BASE_URL. */
export const LEGACY_WEB_BASE_URL = readPublicEnv(
  process.env.EXPO_PUBLIC_CAREEROS_LEGACY_WEB_BASE_URL,
  "https://keshav-019-career-os.vercel.app"
);

/** Learning Center figure images (and any other learning/interview asset referenced by a site-relative path like
 *  "/learning/os-book/figures/x.jpg") now live in Cloudflare R2's public bucket instead of being bundled/served by
 *  the web app - see apps/web/src/lib/learning/asset-url.ts for the web equivalent of resolveAssetUrl below. */
export const R2_PUBLIC_BASE_URL = readPublicEnv(
  process.env.EXPO_PUBLIC_R2_PUBLIC_BASE_URL,
  "https://pub-33382a89004f4a9f9dc850cbcac5fedd.r2.dev"
);

/** Public Firebase client values. Security is enforced by Firebase rules, not by hiding these identifiers. */
export const FIREBASE_CONFIG = {
  apiKey: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, "AIzaSyBEZap2qVQ9yZYWhaHBOaUXfJxB_rvMaCQ"),
  authDomain: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, "career-os-9aa87.firebaseapp.com"),
  projectId: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, "career-os-9aa87"),
  storageBucket: readPublicEnv(
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    "career-os-9aa87.firebasestorage.app"
  ),
  messagingSenderId: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "730846222539"),
  appId: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, "1:730846222539:web:cdc52392353badf569234e"),
  measurementId: readPublicEnv(process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID, "G-76V7V21WDS")
};

export const CLOUDINARY_CONFIG = {
  cloudName: readPublicEnv(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME, "depzyau1x"),
  uploadPreset: readPublicEnv(process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET, "profile_pics")
};
