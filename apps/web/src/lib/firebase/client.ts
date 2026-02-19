import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function readEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  const withoutMatchingQuotes = normalized.replace(/^(['"`])(.*)\1$/, "$2").trim();
  const withoutTrailingSemicolon = withoutMatchingQuotes.endsWith(";")
    ? withoutMatchingQuotes.slice(0, -1).trim()
    : withoutMatchingQuotes;

  const sanitized = withoutTrailingSemicolon.trim();
  if (!sanitized) {
    return undefined;
  }

  if (sanitized.toLowerCase() === "undefined" || sanitized.toLowerCase() === "null") {
    return undefined;
  }

  if (sanitized.startsWith("${") && sanitized.endsWith("}")) {
    return undefined;
  }

  return sanitized;
}

const firebaseConfig = {
  apiKey: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: readEnvValue(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID)
};

export const isFirebaseClientConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

export function getFirebaseClientApp(): FirebaseApp {
  if (!isFirebaseClientConfigured) {
    throw new Error("Missing Firebase client environment variables.");
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export const auth = isFirebaseClientConfigured ? getAuth(getFirebaseClientApp()) : null;
export const db = isFirebaseClientConfigured ? getFirestore(getFirebaseClientApp()) : null;
