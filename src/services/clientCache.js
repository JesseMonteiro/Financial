/**
 * Client-side cache (memory + localStorage) for Pluggy/API payloads.
 * Default TTL: 1 hour — bank data does not need to refresh on every page visit.
 */

export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const STORAGE_PREFIX = 'fh_api_cache_v1:';

/** @type {Map<string, { data: unknown, expiresAt: number }>} */
const memory = new Map();

function storageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

function now() {
  return Date.now();
}

export function isFreshTimestamp(ts, ttlMs = CACHE_TTL_MS) {
  if (ts == null) return false;
  const t = ts instanceof Date ? ts.getTime() : Number(ts);
  if (!Number.isFinite(t)) return false;
  return now() - t < ttlMs;
}

/**
 * Read cached value if still within TTL.
 * @returns {{ data: any, cachedAt: number } | null}
 */
export function cacheGet(key) {
  const mem = memory.get(key);
  if (mem && mem.expiresAt > now()) {
    return { data: mem.data, cachedAt: mem.expiresAt - CACHE_TTL_MS };
  }
  if (mem) memory.delete(key);

  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.expiresAt <= now()) {
      localStorage.removeItem(storageKey(key));
      return null;
    }
    memory.set(key, { data: parsed.data, expiresAt: parsed.expiresAt });
    return { data: parsed.data, cachedAt: parsed.cachedAt || parsed.expiresAt - CACHE_TTL_MS };
  } catch {
    return null;
  }
}

export function cacheSet(key, data, ttlMs = CACHE_TTL_MS) {
  const cachedAt = now();
  const expiresAt = cachedAt + ttlMs;
  const entry = { data, expiresAt, cachedAt };
  memory.set(key, { data, expiresAt });
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Quota / private mode — memory-only is fine
  }
}

export function cacheRemove(key) {
  memory.delete(key);
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
}

/** Clear all FinanceHub API cache entries (memory + localStorage). */
export function cacheClearAll() {
  memory.clear();
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/**
 * Return cached data or run fetcher and store the result.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @param {{ force?: boolean, ttlMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function cachedFetch(key, fetcher, opts = {}) {
  const { force = false, ttlMs = CACHE_TTL_MS } = opts;
  if (!force) {
    const hit = cacheGet(key);
    if (hit) return hit.data;
  }
  const data = await fetcher();
  cacheSet(key, data, ttlMs);
  return data;
}
