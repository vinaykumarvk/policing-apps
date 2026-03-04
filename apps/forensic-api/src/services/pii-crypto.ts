import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("PII_ENCRYPTION_KEY environment variable is required for PII operations");
  }
  return scryptSync(key, "puda-pii-salt", 32);
}

/** Encrypt a plaintext string. Returns base64-encoded ciphertext (salt:iv:tag:encrypted). */
export function encryptPii(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** Decrypt a base64-encoded ciphertext. Returns plaintext string. */
export function decryptPii(ciphertext: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/** Encrypt a JSON-serializable value. Returns base64 ciphertext. */
export function encryptPiiJson(value: unknown): string {
  return encryptPii(JSON.stringify(value));
}

/** Decrypt a base64 ciphertext and parse as JSON. */
export function decryptPiiJson<T = unknown>(ciphertext: string): T {
  return JSON.parse(decryptPii(ciphertext)) as T;
}
