import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { restGetDocument, restListDocuments, restSetDocument } from "@/lib/firebase/firestore-rest";
import type { SystemDesignProblemRecord } from "./catalog.server";

const COLLECTION = "systemDesignProblems";

function requireIdTokenForRestFallback(idToken: string | undefined): string {
  if (!idToken) {
    throw new Error("Missing Firebase Admin environment variables.");
  }

  return idToken;
}

/**
 * Mirrors lib/coding-catalog/firestore.ts exactly. Every function below prefers the Firebase Admin
 * SDK (bypasses firestore.rules entirely, the normal production path). When the Admin SDK isn't
 * configured (see lib/firebase/admin.ts), each one falls back to plain Firestore REST calls
 * authenticated as the calling user's own verified ID token - which only works because
 * firestore.rules allows any signed-in user to read `systemDesignProblems`, and allows writes when
 * that user's own doc has `non_admin === true` (see firestore.rules and lib/server/require-admin.ts).
 */

export async function saveSystemDesignProblemRecord(record: SystemDesignProblemRecord, idToken?: string): Promise<void> {
  if (isFirebaseAdminConfigured) {
    await getAdminDb().collection(COLLECTION).doc(record.id).set(record);
    return;
  }

  await restSetDocument(
    requireIdTokenForRestFallback(idToken),
    COLLECTION,
    record.id,
    record as unknown as Record<string, unknown>
  );
}

export async function getSystemDesignProblemRecord(id: string, idToken?: string): Promise<SystemDesignProblemRecord | null> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as SystemDesignProblemRecord;
  }

  const data = await restGetDocument(requireIdTokenForRestFallback(idToken), COLLECTION, id);
  return data as SystemDesignProblemRecord | null;
}

export async function listSystemDesignProblemRecords(idToken?: string): Promise<SystemDesignProblemRecord[]> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).orderBy("order", "asc").get();
    return snapshot.docs.map((doc) => doc.data() as SystemDesignProblemRecord);
  }

  const rows = await restListDocuments(requireIdTokenForRestFallback(idToken), COLLECTION, {
    direction: "ASCENDING",
    orderByField: "order"
  });
  return rows as SystemDesignProblemRecord[];
}

export async function getNextSystemDesignProblemOrder(idToken?: string): Promise<number> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).orderBy("order", "desc").limit(1).get();
    if (snapshot.empty) {
      return 1;
    }

    const highest = snapshot.docs[0].data() as SystemDesignProblemRecord;
    return (highest.order ?? 0) + 1;
  }

  const rows = await restListDocuments(requireIdTokenForRestFallback(idToken), COLLECTION, {
    direction: "DESCENDING",
    limit: 1,
    orderByField: "order"
  });

  if (rows.length === 0) {
    return 1;
  }

  const highest = rows[0] as SystemDesignProblemRecord;
  return (highest.order ?? 0) + 1;
}
