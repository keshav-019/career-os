import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb, isFirebaseAdminConfigured } from "@/lib/firebase/admin";

type FirestorePrimitiveField =
  | { booleanValue: boolean }
  | { nullValue: null }
  | { stringValue: string }
  | { timestampValue: string };

type FirestoreDocumentResponse = {
  fields?: Record<string, FirestorePrimitiveField | undefined>;
};

export type UserTwoFactorSettings = {
  twoFactorEnabled: boolean;
  twoFactorPendingSecret: string | null;
  twoFactorSecret: string | null;
  twoFactorSessionHash: string | null;
  twoFactorSessionIssuedAtMs: number | null;
};

type UpdateTwoFactorSettings = {
  twoFactorEnabled?: boolean;
  twoFactorPendingSecret?: string | null;
  twoFactorSecret?: string | null;
  twoFactorSessionHash?: string | null;
  twoFactorSessionIssuedAt?: Date | null;
};

function readEnvValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

const FIREBASE_PROJECT_ID = readEnvValue(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

const FIRESTORE_BASE_URL = FIREBASE_PROJECT_ID
  ? `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents`
  : "";

function assertFirestoreConfigured() {
  if (!FIRESTORE_BASE_URL) {
    throw new Error("Firestore project is not configured for server routes.");
  }
}

function buildMaskQuery(fieldNames: string[], queryParamName: "mask.fieldPaths" | "updateMask.fieldPaths"): string {
  const params = new URLSearchParams();
  fieldNames.forEach((fieldName) => params.append(queryParamName, fieldName));
  return params.toString();
}

function parseBooleanField(value: FirestorePrimitiveField | undefined): boolean {
  if (!value || !("booleanValue" in value)) {
    return false;
  }

  return Boolean(value.booleanValue);
}

function parseStringField(value: FirestorePrimitiveField | undefined): string | null {
  if (!value || !("stringValue" in value)) {
    return null;
  }

  return value.stringValue;
}

function parseTimestampToMs(value: FirestorePrimitiveField | undefined): number | null {
  if (!value || !("timestampValue" in value)) {
    return null;
  }

  const parsed = Date.parse(value.timestampValue);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readUserDocument(
  idToken: string,
  userId: string,
  fieldNames: string[]
): Promise<FirestoreDocumentResponse | null> {
  if (isFirebaseAdminConfigured) {
    const snapshot = await getAdminDb()
      .collection("users")
      .doc(userId)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as Record<string, unknown> | undefined;
    const fields: Record<string, FirestorePrimitiveField> = {};

    fieldNames.forEach((fieldName) => {
      const value = data?.[fieldName];
      if (typeof value === "boolean") {
        fields[fieldName] = { booleanValue: value };
        return;
      }

      if (typeof value === "string") {
        fields[fieldName] = { stringValue: value };
        return;
      }

      if (value instanceof Timestamp) {
        fields[fieldName] = { timestampValue: value.toDate().toISOString() };
        return;
      }

      if (value instanceof Date) {
        fields[fieldName] = { timestampValue: value.toISOString() };
        return;
      }

      if (value === null) {
        fields[fieldName] = { nullValue: null };
      }
    });

    return { fields };
  }

  assertFirestoreConfigured();

  const fieldMaskQuery = buildMaskQuery(fieldNames, "mask.fieldPaths");
  const response = await fetch(
    `${FIRESTORE_BASE_URL}/users/${encodeURIComponent(userId)}${fieldMaskQuery ? `?${fieldMaskQuery}` : ""}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to read two-factor settings.");
  }

  return (await response.json()) as FirestoreDocumentResponse;
}

async function patchUserDocument(
  idToken: string,
  userId: string,
  fields: Record<string, FirestorePrimitiveField>
): Promise<void> {
  if (isFirebaseAdminConfigured) {
    const payload: Record<string, unknown> = {};

    Object.entries(fields).forEach(([fieldName, value]) => {
      if ("booleanValue" in value) {
        payload[fieldName] = value.booleanValue;
        return;
      }

      if ("stringValue" in value) {
        payload[fieldName] = value.stringValue;
        return;
      }

      if ("timestampValue" in value) {
        payload[fieldName] = Timestamp.fromDate(new Date(value.timestampValue));
        return;
      }

      payload[fieldName] = FieldValue.delete();
    });

    await getAdminDb()
      .collection("users")
      .doc(userId)
      .set(payload, { merge: true });

    return;
  }

  assertFirestoreConfigured();

  const fieldNames = Object.keys(fields);
  if (fieldNames.length === 0) {
    return;
  }

  const updateMaskQuery = buildMaskQuery(fieldNames, "updateMask.fieldPaths");
  const response = await fetch(
    `${FIRESTORE_BASE_URL}/users/${encodeURIComponent(userId)}?${updateMaskQuery}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Unable to update two-factor settings.");
  }
}

export async function getUserTwoFactorSettings(idToken: string, userId: string): Promise<UserTwoFactorSettings> {
  const userDoc = await readUserDocument(idToken, userId, [
    "twoFactorEnabled",
    "twoFactorPendingSecret",
    "twoFactorSecret",
    "twoFactorSessionHash",
    "twoFactorSessionIssuedAt"
  ]);
  const fields = userDoc?.fields;

  return {
    twoFactorEnabled: parseBooleanField(fields?.twoFactorEnabled),
    twoFactorPendingSecret: parseStringField(fields?.twoFactorPendingSecret),
    twoFactorSecret: parseStringField(fields?.twoFactorSecret),
    twoFactorSessionHash: parseStringField(fields?.twoFactorSessionHash),
    twoFactorSessionIssuedAtMs: parseTimestampToMs(fields?.twoFactorSessionIssuedAt)
  };
}

export async function updateUserTwoFactorSettings(
  idToken: string,
  userId: string,
  nextSettings: UpdateTwoFactorSettings
): Promise<void> {
  const fields: Record<string, FirestorePrimitiveField> = {
    updatedAt: { timestampValue: new Date().toISOString() }
  };

  if (typeof nextSettings.twoFactorEnabled === "boolean") {
    fields.twoFactorEnabled = { booleanValue: nextSettings.twoFactorEnabled };
  }

  if ("twoFactorSecret" in nextSettings) {
    fields.twoFactorSecret =
      nextSettings.twoFactorSecret === null
        ? { nullValue: null }
        : { stringValue: nextSettings.twoFactorSecret ?? "" };
  }

  if ("twoFactorPendingSecret" in nextSettings) {
    fields.twoFactorPendingSecret =
      nextSettings.twoFactorPendingSecret === null
        ? { nullValue: null }
        : { stringValue: nextSettings.twoFactorPendingSecret ?? "" };
  }

  if ("twoFactorSessionHash" in nextSettings) {
    fields.twoFactorSessionHash =
      nextSettings.twoFactorSessionHash === null
        ? { nullValue: null }
        : { stringValue: nextSettings.twoFactorSessionHash ?? "" };
  }

  if ("twoFactorSessionIssuedAt" in nextSettings) {
    fields.twoFactorSessionIssuedAt =
      nextSettings.twoFactorSessionIssuedAt === null
        ? { nullValue: null }
        : { timestampValue: (nextSettings.twoFactorSessionIssuedAt ?? new Date()).toISOString() };
  }

  await patchUserDocument(idToken, userId, fields);
}
