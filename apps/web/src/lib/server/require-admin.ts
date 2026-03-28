import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { verifyRequestAuth, type VerifiedRequestAuth } from "@/lib/server/verify-request-auth";

export type VerifiedAdminAuth = VerifiedRequestAuth;

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";

type FirestoreRestValue = { booleanValue?: boolean };
type FirestoreRestDocument = { fields?: Record<string, FirestoreRestValue> };

/**
 * Reads whether the signed-in user's own `users/{uid}` document has
 * `non_admin === true`, using the Firestore REST API with the user's OWN
 * verified ID token - no Admin SDK service account required. This only works
 * because firestore.rules already lets a user read their own document, and
 * because `non_admin` (unlike `admin`) isn't blocked from being set by a
 * developer through the Firebase console on their own doc.
 *
 * This is a deliberately separate, weaker mechanism from the real `admin`
 * flag - a local-development escape hatch for admin-only routes when the
 * Firebase Admin SDK hasn't been configured yet (see lib/firebase/admin.ts).
 * It should never be treated as equivalent to a verified `admin === true`
 * once the Admin SDK is actually configured - see requireAdmin() below.
 */
async function hasNonAdminFlagViaRest(idToken: string, userId: string): Promise<boolean> {
  if (!FIREBASE_PROJECT_ID) {
    return false;
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(userId)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store"
    });

    if (!response.ok) {
      return false;
    }

    const document = (await response.json()) as FirestoreRestDocument;
    return document.fields?.non_admin?.booleanValue === true;
  } catch {
    return false;
  }
}

/**
 * Verifies the request's Bearer id token AND that the signed-in user is
 * allowed to perform admin-only actions. This is the only place that should
 * ever gate an admin-only API route - the client-side `useIsAdmin()` hook
 * (lib/firebase/user-profile.ts) only controls what UI is shown and must
 * never be trusted on its own, since a user could edit their own client state.
 *
 * The real check is `users/{uid}.admin === true`, read via the Firebase
 * Admin SDK (bypassing Firestore rules) - `admin` can only ever be set
 * through the Firebase console or the Admin SDK, so a true reading here means
 * a human deliberately granted access.
 *
 * If the Admin SDK isn't configured (no service account env vars), this
 * falls back to a weaker, local-development-only check: `users/{uid}.
 * non_admin === true`, read over plain Firestore REST with the user's own
 * token. This exists purely so admin screens can be unblocked locally without
 * setting up a service account - remove the `non_admin` field once the Admin
 * SDK is configured for real.
 */
export async function requireAdmin(authorizationHeader: string | null): Promise<VerifiedAdminAuth> {
  const verifiedAuth = await verifyRequestAuth(authorizationHeader);

  if (isFirebaseAdminConfigured) {
    const adminDb = getAdminDb();
    const userDoc = await adminDb.collection("users").doc(verifiedAuth.userId).get();
    const isAdmin = userDoc.exists && userDoc.data()?.admin === true;

    if (!isAdmin) {
      throw new Error("Admin access is required for this action.");
    }

    return verifiedAuth;
  }

  const hasNonAdminFlag = await hasNonAdminFlagViaRest(verifiedAuth.idToken, verifiedAuth.userId);
  if (!hasNonAdminFlag) {
    throw new Error(
      "Admin access is required for this action. Configure the Firebase Admin SDK environment variables, or set non_admin: true on your users/{uid} document in the Firebase console as a temporary local workaround."
    );
  }

  return verifiedAuth;
}
