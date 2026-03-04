export type CacheEnvelope<T> = { schemaVersion: number; schema: string; data: T; fetchedAt: string };
export type CacheReadOptions<T> = { schema: string; maxAgeMs?: number; validate?: (data: unknown) => data is T };
export type CacheWriteOptions = { schema: string };

const CACHE_SCHEMA_VERSION = 1;
export const CACHE_PREFIXES = ["sm_cache_"] as const;

function safeRemove(key: string) { try { localStorage.removeItem(key); } catch {} }
function isValidTimestamp(v: unknown): v is string { return typeof v === "string" && !Number.isNaN(Date.parse(v)); }

export function readCached<T>(key: string, opts: CacheReadOptions<T>): CacheEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
    if (!p || typeof p !== "object") { safeRemove(key); return null; }
    if (p.schemaVersion !== CACHE_SCHEMA_VERSION || p.schema !== opts.schema) { safeRemove(key); return null; }
    if (!isValidTimestamp(p.fetchedAt) || !("data" in p)) { safeRemove(key); return null; }
    if (typeof opts.maxAgeMs === "number" && opts.maxAgeMs > 0) {
      const age = Date.now() - Date.parse(p.fetchedAt);
      if (!Number.isFinite(age) || age > opts.maxAgeMs) { safeRemove(key); return null; }
    }
    if (opts.validate && !opts.validate(p.data)) { safeRemove(key); return null; }
    return p as CacheEnvelope<T>;
  } catch { safeRemove(key); return null; }
}

export function writeCached<T>(key: string, data: T, opts: CacheWriteOptions): CacheEnvelope<T> {
  const payload: CacheEnvelope<T> = { schemaVersion: CACHE_SCHEMA_VERSION, schema: opts.schema, data, fetchedAt: new Date().toISOString() };
  try { localStorage.setItem(key, JSON.stringify(payload)); } catch {}
  return payload;
}

export function clearCachedState() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) keys.push(k); }
    keys.forEach((k) => { if (CACHE_PREFIXES.some((p) => k.startsWith(p))) safeRemove(k); });
  } catch {}
}
