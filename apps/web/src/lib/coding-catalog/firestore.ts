import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { restGetDocument, restListDocuments, restSetDocument } from "@/lib/firebase/firestore-rest";
import type { CodingProblemRecord } from "./types";

const COLLECTION = "codingProblems";

function requireIdTokenForRestFallback(idToken: string | undefined): string {
  if (!idToken) {
    throw new Error("Missing Firebase Admin environment variables.");
  }

  return idToken;
}

/**
 * Every function below prefers the Firebase Admin SDK (bypasses firestore.rules entirely, the
 * normal production path). When the Admin SDK isn't configured (see lib/firebase/admin.ts), each
 * one falls back to plain Firestore REST calls authenticated as the calling user's own verified ID
 * token - which only works because firestore.rules allows any signed-in user to read `codingProblems`,
 * and allows writes when that user's own doc has `non_admin === true` (see firestore.rules and
 * lib/server/require-admin.ts). Callers that can reach these functions from a non-admin context
 * (e.g. the public list/judge-data routes) still work either way; only the write path additionally
 * depends on the `non_admin` escape hatch when the Admin SDK isn't configured.
 */

export async function saveCodingProblemRecord(record: CodingProblemRecord, idToken?: string): Promise<void> {
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

export async function getCodingProblemRecord(id: string, idToken?: string): Promise<CodingProblemRecord | null> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).doc(id).get();
    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as CodingProblemRecord;
  }

  const data = await restGetDocument(requireIdTokenForRestFallback(idToken), COLLECTION, id);
  return data as CodingProblemRecord | null;
}

export async function listCodingProblemRecords(idToken?: string): Promise<CodingProblemRecord[]> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).orderBy("order", "asc").get();
    return snapshot.docs.map((doc) => doc.data() as CodingProblemRecord);
  }

  const rows = await restListDocuments(requireIdTokenForRestFallback(idToken), COLLECTION, {
    direction: "ASCENDING",
    orderByField: "order"
  });
  return rows as CodingProblemRecord[];
}

export async function getNextCodingProblemOrder(idToken?: string): Promise<number> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb().collection(COLLECTION).orderBy("order", "desc").limit(1).get();
    if (snapshot.empty) {
      return 1;
    }

    const highest = snapshot.docs[0].data() as CodingProblemRecord;
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

  const highest = rows[0] as CodingProblemRecord;
  return (highest.order ?? 0) + 1;
}
