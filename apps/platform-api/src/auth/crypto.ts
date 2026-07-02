// Auth primitives for the platform claims issuer. node:crypto only — the
// platform runtime stays free of third-party crypto dependencies.
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

// --- Password hashing (scrypt) ---

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, "hex");
  if (expected.length !== SCRYPT_KEYLEN) {
    return false;
  }
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  return timingSafeEqual(actual, expected);
}

// --- TOTP (RFC 6238: HMAC-SHA1, 30s step, 6 digits) ---

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error("invalid base32 character");
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let out = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

export function totpCode(secretBase32: string, epochMs: number, stepOffset = 0): string {
  const counter = Math.floor(epochMs / 1000 / 30) + stepOffset;
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secretBase32)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secretBase32: string, code: string, epochMs: number): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  for (const offset of [0, -1, 1]) {
    const expected = Buffer.from(totpCode(secretBase32, epochMs, offset));
    if (expected.length === code.length && timingSafeEqual(expected, Buffer.from(code))) {
      return true;
    }
  }
  return false;
}

// --- Session tokens (HMAC-SHA256 signed, stateless) ---

export type SessionAuthMethod = "totp" | "password";

export interface SessionToken {
  userId: string;
  sessionId: string;
  expiresAtMs: number;
  /** How the session was authenticated — carried into minted mfa.methods. */
  authMethod: SessionAuthMethod;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  userId: string,
  secret: string,
  nowMs: number,
  ttlSeconds: number,
  authMethod: SessionAuthMethod = "totp",
): string {
  const sessionId = `sess-${randomBytes(12).toString("hex")}`;
  const expiresAtMs = nowMs + ttlSeconds * 1000;
  const payload = Buffer.from(
    JSON.stringify({ u: userId, s: sessionId, e: expiresAtMs, m: authMethod }),
  ).toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

export function verifySessionToken(token: string, secret: string, nowMs: number): SessionToken | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = signPayload(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  let parsed: { u?: unknown; s?: unknown; e?: unknown; m?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed.u !== "string" || typeof parsed.s !== "string" || typeof parsed.e !== "number") {
    return null;
  }
  if (parsed.m !== "totp" && parsed.m !== "password") {
    return null;
  }
  if (parsed.e <= nowMs) {
    return null;
  }
  return { userId: parsed.u, sessionId: parsed.s, expiresAtMs: parsed.e, authMethod: parsed.m };
}
