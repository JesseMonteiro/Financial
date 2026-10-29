import {
  MERCHANT_LOGO_QUERY_LIMIT,
  brandNameMatchesQuery,
  canonicalQueryKey,
} from '../../src/utils/merchantLogoQuery.js';
import { normalizeMerchantText } from '../../src/utils/merchantLogos.js';

const BUCKET = 'merchant-logos';
const STALE_PENDING_MS = 2 * 60 * 1000;
const inflight = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storagePathForDomain(domain) {
  const safe = String(domain || '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe || 'brand'}.webp`;
}

function present(supabase, row) {
  if (!row || row.status === 'pending') return { status: 'pending' };
  if (row.status !== 'found' || !row.storage_path) return { status: 'miss' };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(row.storage_path);
  if (!data?.publicUrl) return { status: 'miss' };
  return {
    status: 'found',
    name: row.brand_name || row.domain || row.query_key,
    url: data.publicUrl,
  };
}

function isStalePending(row) {
  if (!row || row.status !== 'pending') return false;
  const created = new Date(row.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created > STALE_PENDING_MS;
}

async function readRow(supabase, key) {
  const { data, error } = await supabase
    .from('merchant_logo_cache')
    .select('query_key, status, brand_name, domain, etag, storage_path, created_at')
    .eq('query_key', key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function waitForRow(supabase, key) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(400);
    const row = await readRow(supabase, key);
    if (row && row.status !== 'pending') return present(supabase, row);
    if (!row || isStalePending(row)) break;
  }
  return { status: 'pending' };
}

async function saveMiss(supabase, key) {
  const { error } = await supabase
    .from('merchant_logo_cache')
    .update({
      status: 'miss',
      brand_name: null,
      domain: null,
      etag: null,
      storage_path: null,
    })
    .eq('query_key', key);
  if (error) throw error;
}

async function releasePending(supabase, key) {
  await supabase.from('merchant_logo_cache').delete().eq('query_key', key).eq('status', 'pending');
}

async function logoDev(path, secret) {
  const response = await fetch(`https://api.logo.dev${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: 'application/json',
    },
  });
  return response;
}

/**
 * Search once, then download the logo file once. Temporary CDN URLs are not stored.
 * @returns {{ kind: 'found', name: string, domain: string, etag: string|null, bytes: Uint8Array } | { kind: 'miss' } | { kind: 'retry' }}
 */
async function fetchLogo(secret, key) {
  const searchUrl = new URL('https://api.logo.dev/v2/search');
  searchUrl.searchParams.set('q', key);
  searchUrl.searchParams.set('method', 'match');
  searchUrl.searchParams.set('limit', '1');
  const searchRes = await logoDev(`${searchUrl.pathname}${searchUrl.search}`, secret);
  if (searchRes.status === 429 || searchRes.status === 402 || searchRes.status >= 500) {
    return { kind: 'retry' };
  }
  if (!searchRes.ok) return { kind: 'miss' };

  const searchBody = await searchRes.json();
  const hit = Array.isArray(searchBody?.data) ? searchBody.data[0] : null;
  const domainLabel = typeof hit?.domain === 'string' ? hit.domain.split('.')[0] : '';
  if (!hit?.domain || !hit?.name) return { kind: 'miss' };
  if (!brandNameMatchesQuery(key, hit.name) && !brandNameMatchesQuery(key, domainLabel)) {
    return { kind: 'miss' };
  }

  const logoRes = await logoDev(`/v2/brands/logo?domain=${encodeURIComponent(hit.domain)}`, secret);
  if (logoRes.status === 202 || logoRes.status === 429 || logoRes.status === 402 || logoRes.status >= 500) {
    return { kind: 'retry' };
  }
  if (!logoRes.ok) return { kind: 'miss' };

  const logoBody = await logoRes.json();
  const image = logoBody?.data;
  if (!image?.url || image.status === 'not_indexed') return { kind: 'retry' };

  const download = new URL(image.url);
  download.searchParams.set('format', 'webp');
  download.searchParams.set('size', '256');
  const fileRes = await fetch(download);
  const type = fileRes.headers.get('content-type') || '';
  if (!fileRes.ok || !type.startsWith('image/')) return { kind: 'retry' };
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  if (bytes.byteLength < 32) return { kind: 'retry' };
  return {
    kind: 'found',
    name: hit.name,
    domain: hit.domain,
    etag: image.etag || null,
    bytes,
  };
}

async function resolveOne(ctx, key) {
  const existing = await readRow(ctx.supabase, key);
  if (existing && existing.status !== 'pending') return present(ctx.supabase, existing);
  if (existing && !isStalePending(existing)) return waitForRow(ctx.supabase, key);

  if (!existing) {
    const { error } = await ctx.supabase.from('merchant_logo_cache').insert({
      query_key: key,
      status: 'pending',
    });
    if (error?.code === '23505') {
      const raced = await readRow(ctx.supabase, key);
      if (raced && raced.status !== 'pending') return present(ctx.supabase, raced);
      if (raced && !isStalePending(raced)) return waitForRow(ctx.supabase, key);
    } else if (error) {
      throw error;
    }
  }

  try {
    const outcome = await fetchLogo(ctx.secret, key);
    if (outcome.kind === 'retry') {
      await releasePending(ctx.supabase, key);
      return { status: 'pending' };
    }
    if (outcome.kind === 'miss') {
      await saveMiss(ctx.supabase, key);
      return { status: 'miss' };
    }

    const path = storagePathForDomain(outcome.domain);
    const upload = await ctx.supabase.storage.from(BUCKET).upload(path, outcome.bytes, {
      contentType: 'image/webp',
      upsert: true,
    });
    if (upload.error) throw upload.error;

    const { error: updateError } = await ctx.supabase
      .from('merchant_logo_cache')
      .update({
        status: 'found',
        brand_name: outcome.name,
        domain: outcome.domain,
        etag: outcome.etag,
        storage_path: path,
      })
      .eq('query_key', key);
    if (updateError) throw updateError;

    const row = await readRow(ctx.supabase, key);
    return present(ctx.supabase, row);
  } catch (err) {
    console.warn('[merchant-logos] lookup failed:', key, err?.message || err);
    await releasePending(ctx.supabase, key);
    return { status: 'pending' };
  }
}

function resolveOneShared(ctx, key) {
  const current = inflight.get(key);
  if (current) return current;
  const promise = resolveOne(ctx, key).finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/**
 * Resolve establishment logos. Misses and hits are stored. A missing secret
 * returns miss without writing, so the list still renders.
 * @param {{ supabase: object|null, secret: string, queries: unknown }} params
 */
export async function resolveMerchantLogos({ supabase, secret, queries }) {
  const results = {};
  const pending = [];
  const seen = new Set();
  const list = Array.isArray(queries) ? queries : [];

  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const echo = normalizeMerchantText(raw);
    if (!echo || seen.has(echo)) continue;
    if (seen.size >= MERCHANT_LOGO_QUERY_LIMIT) break;
    seen.add(echo);
    const key = canonicalQueryKey(raw);
    if (!key) {
      results[echo] = { status: 'miss' };
      continue;
    }
    pending.push(key);
  }

  if (!supabase || !secret) {
    for (const key of pending) results[key] = { status: 'miss' };
    return results;
  }

  if (pending.length === 0) return results;

  const { data: rows, error } = await supabase
    .from('merchant_logo_cache')
    .select('query_key, status, brand_name, domain, etag, storage_path, created_at')
    .in('query_key', pending);
  if (error) throw error;

  const byKey = new Map((rows || []).map((row) => [row.query_key, row]));
  const work = [];
  for (const key of pending) {
    const row = byKey.get(key);
    if (row && row.status !== 'pending') {
      results[key] = present(supabase, row);
    } else {
      work.push(key);
    }
  }

  const resolved = await mapPool(work, 3, (key) => resolveOneShared({ supabase, secret }, key));
  work.forEach((key, index) => {
    results[key] = resolved[index];
  });
  return results;
}
