import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secretSource = process.env.TWO_FACTOR_ENCRYPTION_KEY ?? process.env.FIREBASE_PRIVATE_KEY;

  if (!secretSource) {
    throw new Error("Missing server secret for two-factor encryption.");
  }

  return createHash("sha256").update(secretSource, "utf8").digest();
}

export function encryptTwoFactorSecret(secret: string): string {
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTwoFactorSecret(payload: string): string {
  const segments = payload.split(".");
  if (segments.length !== 3) {
    throw new Error("Invalid encrypted two-factor payload.");
  }

  const [ivPart, authTagPart, encryptedPart] = segments;
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
