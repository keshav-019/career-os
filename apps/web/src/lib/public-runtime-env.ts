const PUBLIC_RUNTIME_FALLBACKS = {
  firebaseApiKey: "AIzaSyBEZap2qVQ9yZYWhaHBOaUXfJxB_rvMaCQ"
} as const;

function readEnvValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

export function getFirebaseWebApiKey(): string {
  return readEnvValue("FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY") || PUBLIC_RUNTIME_FALLBACKS.firebaseApiKey;
}
