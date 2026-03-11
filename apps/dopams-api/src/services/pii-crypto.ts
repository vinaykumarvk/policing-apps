import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;
const MIN_CIPHERTEXT_LENGTH = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;

/** Cache derived keys by salt hex to avoid blocking the event loop on every call. */
const derivedKeyCache = new Map<string, Buffer>();

function deriveKey(salt: Buffer): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("PII_ENCRYPTION_KEY environment variable is required for PII operations");
  }
  const cacheKey = salt.toString("hex");
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) return cached;

  const derived = scryptSync(key, salt, 32);
  derivedKeyCache.set(cacheKey, derived);
  return derived;
}

/** Encrypt a plaintext string. Returns base64-encoded ciphertext (salt+iv+tag+encrypted). */
export function encryptPii(plaintext: string): string {
  const salt = process.env.PII_SALT
    ? Buffer.from(process.env.PII_SALT, "hex")
    : randomBytes(SALT_LENGTH);
  const key = deriveKey(salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

/** Decrypt a base64-encoded ciphertext. Returns plaintext string. */
export function decryptPii(ciphertext: string): string {
  const data = Buffer.from(ciphertext, "base64");
  if (data.length < MIN_CIPHERTEXT_LENGTH) {
    throw new Error("Invalid ciphertext: buffer too short");
  }
  const salt = data.subarray(0, SALT_LENGTH);
  const key = deriveKey(salt);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
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
