const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";

function documentsBaseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents`;
}

type FirestoreRestValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreRestValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreRestValue> } };

type FirestoreRestDocument = { fields?: Record<string, FirestoreRestValue>; name?: string };

/**
 * A minimal Firestore REST API client, used as a fallback data path for the small set of Firestore
 * collections that need to work even when the Firebase Admin SDK service account isn't configured
 * (see lib/firebase/admin.ts and lib/server/require-admin.ts for why that fallback exists at all).
 *
 * Every function here authenticates as a specific signed-in user via their own verified ID token, so
 * everything it does is still subject to firestore.rules - this is not a privilege-bypassing
 * mechanism like the Admin SDK, it is Firestore access exactly as if the user's own browser made the
 * request. Callers are responsible for making sure the rules actually allow whatever operation they're
 * asking for (e.g. a collection with `allow write: if false` will reject writes here exactly the same
 * way it would reject them from a browser).
 */

function encodeValue(value: unknown): FirestoreRestValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }

  if (typeof value === "string") {
    return { stringValue: value };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }

  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }

  return { stringValue: String(value) };
}

function encodeFields(data: Record<string, unknown>): Record<string, FirestoreRestValue> {
  const fields: Record<string, FirestoreRestValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }

    fields[key] = encodeValue(value);
  }

  return fields;
}

function decodeValue(value: FirestoreRestValue | undefined): unknown {
  if (!value) {
    return undefined;
  }

  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});

  return undefined;
}

function decodeFields(fields: Record<string, FirestoreRestValue>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = decodeValue(value);
  }

  return result;
}

async function parseErrorResponse(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text ? text.slice(0, 400) : `HTTP ${response.status}`;
}

export function isFirestoreRestConfigured(): boolean {
  return Boolean(FIREBASE_PROJECT_ID);
}

export async function restGetDocument(
  idToken: string,
  collection: string,
  id: string
): Promise<Record<string, unknown> | null> {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not set.");
  }

  const response = await fetch(`${documentsBaseUrl()}/${collection}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Firestore REST read of ${collection}/${id} failed: ${await parseErrorResponse(response)}`);
  }

  const document = (await response.json()) as FirestoreRestDocument;
  return decodeFields(document.fields ?? {});
}

export async function restSetDocument(
  idToken: string,
  collection: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not set.");
  }

  const fields = encodeFields(data);
  const url = new URL(`${documentsBaseUrl()}/${collection}/${encodeURIComponent(id)}`);
  // A bare PATCH replaces only the given fields (Firestore's default merge-less patch behavior
  // actually requires an explicit field mask to NOT wipe unspecified fields - since every caller
  // here always sends the full record, we intentionally do a full overwrite by patching every field
  // and adding an updateMask covering exactly those fields, which is equivalent to a full document
  // set() for a record where every field is always provided).
  Object.keys(fields).forEach((key) => url.searchParams.append("updateMask.fieldPaths", key));

  const response = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });

  if (!response.ok) {
    throw new Error(`Firestore REST write of ${collection}/${id} failed: ${await parseErrorResponse(response)}`);
  }
}

export async function restListDocuments(
  idToken: string,
  collectionId: string,
  options: { direction?: "ASCENDING" | "DESCENDING"; limit?: number; orderByField: string }
): Promise<Record<string, unknown>[]> {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) is not set.");
  }

  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
    orderBy: [{ direction: options.direction ?? "ASCENDING", field: { fieldPath: options.orderByField } }]
  };

  if (options.limit) {
    structuredQuery.limit = options.limit;
  }

  const response = await fetch(`${documentsBaseUrl()}:runQuery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ structuredQuery })
  });

  if (!response.ok) {
    throw new Error(`Firestore REST query of ${collectionId} failed: ${await parseErrorResponse(response)}`);
  }

  const rows = (await response.json()) as Array<{ document?: FirestoreRestDocument }>;
  return rows.filter((row) => row.document).map((row) => decodeFields(row.document!.fields ?? {}));
}
