import { useEffect, useMemo, useState } from 'react';
import { merchantLogoQueryKeyFromFields } from '../utils/merchantLogoQuery';
import { resolveMerchantLogos } from '../services/api';

/** Session cache so a list does not ask the server again for a company it already resolved. */
const memory = new Map();

function fieldsOf(entry) {
  if (!entry || typeof entry === 'string') {
    return { title: entry || '', description: '', merchant: null };
  }
  return {
    title: entry.title || '',
    description: entry.description || '',
    merchant: entry.merchant,
  };
}

function keysFor(entries) {
  const keys = [];
  const seen = new Set();
  for (const entry of entries || []) {
    const key = merchantLogoQueryKeyFromFields(fieldsOf(entry));
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

/**
 * One batch request for the establishment logos that are not in the local catalog.
 * @param {Array<object|string>} entries
 * @returns {Record<string, { name: string, url: string }>}
 */
export function useMerchantLogos(entries) {
  const keyList = keysFor(entries).join('\u0000');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const keys = keyList ? keyList.split('\u0000') : [];
    const missing = keys.filter((key) => !memory.has(key));
    if (missing.length === 0) return undefined;
    let cancelled = false;
    resolveMerchantLogos(missing)
      .then((results) => {
        for (const key of missing) {
          const row = results?.[key];
          if (!row || row.status === 'pending') continue;
          if (row.status === 'found' && row.url) {
            memory.set(key, { name: row.name || key, url: row.url });
          } else {
            memory.set(key, null);
          }
        }
        if (!cancelled) setVersion((value) => value + 1);
      })
      .catch((err) => {
        console.warn('[merchant-logos] falha ao resolver:', err?.message || err);
      });
    return () => {
      cancelled = true;
    };
  }, [keyList]);

  return useMemo(() => {
    const resolved = {};
    const keys = keyList ? keyList.split('\u0000') : [];
    for (const key of keys) {
      const hit = memory.get(key);
      if (hit?.url) resolved[key] = hit;
    }
    return resolved;
  }, [keyList, version]);
}
