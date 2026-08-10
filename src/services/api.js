import axios from 'axios';
import { supabase } from './supabaseClient.js';
import { cachedFetch, cacheClearAll } from './clientCache.js';

// In production (GitHub Pages) calls go to the Supabase Edge Function.
// Locally, Vite proxies /api → localhost:3001 (vite.config.js proxy setting).
const SUPABASE_FUNCTION_URL = 'https://tslzhkbxabbhrmbefhrj.supabase.co/functions/v1/pluggy-proxy';
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : SUPABASE_FUNCTION_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Interceptor to attach the Supabase user session token to outgoing requests
api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error('[API Interceptor Error] Falha ao obter sessão do Supabase:', error);
  }
  return config;
});

async function cacheScope() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || 'anon';
  } catch {
    return 'anon';
  }
}

function cacheKey(scope, parts) {
  return `${scope}:${parts.join(':')}`;
}

/** Bust client API cache (e.g. manual sync / logout). */
export function clearApiCache() {
  cacheClearAll();
}

export async function fetchAccounts(itemId, { force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['accounts', itemId || 'all']);
  return cachedFetch(
    key,
    async () => {
      try {
        const res = await api.get('/accounts', { params: itemId ? { itemId } : {} });
        const data = res.data;
        if (data && Array.isArray(data.results)) return data.results;
        if (Array.isArray(data)) return data;
        return [];
      } catch (err) {
        console.warn('[API Error] Falha ao buscar contas:', err.message);
        return [];
      }
    },
    { force }
  );
}

export async function fetchTransactions(params = {}, { force = false } = {}) {
  const scope = await cacheScope();
  const { accountId, from, to, cursor, ...rest } = params || {};
  const key = cacheKey(scope, [
    'transactions',
    accountId || 'all',
    from || '',
    to || '',
    cursor || '',
    JSON.stringify(rest),
  ]);
  return cachedFetch(
    key,
    async () => {
      try {
        const res = await api.get('/transactions', { params });
        const data = res.data;
        if (data && Array.isArray(data.results)) return data;
        if (Array.isArray(data)) return { results: data, next: null };
        return { results: [], next: null };
      } catch (err) {
        console.warn('[API Error] Falha ao buscar transações:', err.message);
        return { results: [], next: null };
      }
    },
    { force }
  );
}

export async function fetchBills(accountId, { force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['bills', accountId || 'all']);
  return cachedFetch(
    key,
    async () => {
      try {
        const res = await api.get('/bills', { params: accountId ? { accountId } : {} });
        const data = res.data;
        if (data && Array.isArray(data.results)) return data.results;
        if (Array.isArray(data)) return data;
        return [];
      } catch (err) {
        console.warn('[API Error] Falha ao buscar faturas:', err.message);
        return [];
      }
    },
    { force }
  );
}

export async function fetchInvestments(itemId, { force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['investments', itemId || 'all']);
  return cachedFetch(
    key,
    async () => {
      try {
        const res = await api.get('/investments', { params: itemId ? { itemId } : {} });
        const data = res.data;
        if (data && Array.isArray(data.results)) return data.results;
        if (Array.isArray(data)) return data;
        return [];
      } catch (err) {
        console.warn('[API Error] Falha ao buscar investimentos:', err.message);
        return [];
      }
    },
    { force }
  );
}

export async function fetchLoans(itemId, { force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['loans', itemId || 'all']);
  return cachedFetch(
    key,
    async () => {
      try {
        const res = await api.get('/loans', { params: itemId ? { itemId } : {} });
        const data = res.data;
        if (data && Array.isArray(data.results)) return data.results;
        if (Array.isArray(data)) return data;
        return [];
      } catch (err) {
        console.warn('[API Error] Falha ao buscar empréstimos:', err.message);
        return [];
      }
    },
    { force }
  );
}

export async function fetchCategories({ force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['categories']);
  return cachedFetch(
    key,
    async () => {
      try {
        const res = await api.get('/categories');
        const data = res.data;
        return data?.results || data || [];
      } catch (err) {
        return [];
      }
    },
    { force }
  );
}

export async function fetchConnectors({ force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['connectors']);
  return cachedFetch(
    key,
    async () => {
      try {
        const res = await api.get('/connectors');
        const data = res.data;
        return data?.results || data || [];
      } catch (err) {
        return [];
      }
    },
    { force }
  );
}

export async function fetchItems({ force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['items']);
  return cachedFetch(
    key,
    async () => {
      try {
        const res = await api.get('/items');
        const data = res.data;
        return data?.results || data || [];
      } catch (err) {
        return [];
      }
    },
    { force }
  );
}

export async function syncItemIds(itemIds) {
  try {
    const res = await api.post('/items/sync', { itemIds });
    clearApiCache();
    return res.data;
  } catch (err) {
    const message = err.response?.data?.error || err.message || 'Falha ao vincular conexões Pluggy';
    throw new Error(message);
  }
}

/** Fetch a single Pluggy Item (connection) by id. */
export async function fetchItem(itemId) {
  try {
    const res = await api.get(`/items/${itemId}`);
    return res.data;
  } catch (err) {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'Falha ao consultar conexão Pluggy';
    throw new Error(message);
  }
}

/**
 * Trigger a bank-side sync for an Item (Pluggy PATCH /items/{id}).
 * This asks Pluggy to fetch fresh data from the institution — not just re-read cached results.
 */
export async function updateItem(itemId, body = {}) {
  try {
    const res = await api.patch(`/items/${itemId}`, body);
    clearApiCache();
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    const message =
      data?.message ||
      data?.error ||
      err.message ||
      'Falha ao sincronizar conexão com o banco';
    const error = new Error(message);
    error.code = data?.codeDescription || data?.code || err.response?.status;
    error.data = data?.data;
    error.status = err.response?.status;
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ITEM_STATUSES_NEEDING_USER = new Set([
  'WAITING_USER_INPUT',
  'LOGIN_ERROR',
]);

/**
 * Poll item until Pluggy finishes the connector execution (status !== UPDATING).
 * @see https://docs.pluggy.ai/docs/data-sync-update-an-item
 */
export async function waitForItemUpdate(itemId, { intervalMs = 2500, timeoutMs = 180000 } = {}) {
  const started = Date.now();
  let item = await fetchItem(itemId);

  while (item?.status === 'UPDATING') {
    if (Date.now() - started > timeoutMs) {
      throw new Error(
        'A sincronização está demorando mais que o esperado. Os dados podem atualizar em breve — tente novamente.'
      );
    }
    await sleep(intervalMs);
    item = await fetchItem(itemId);
  }

  return item;
}

function pluggyErrorNeedsUserAction(err) {
  const code = String(err?.code || '');
  return (
    code.includes('CONNECTOR_REQUIRED_PARAMETER') ||
    code.includes('MFA') ||
    code.includes('INVALID_CREDENTIALS')
  );
}

/**
 * Sync all (or selected) Pluggy Items against the banks, then wait for completion.
 * Returns per-item results; some may need Pluggy Connect (MFA / credentials).
 */
export async function syncPluggyConnections(itemIds) {
  let ids = Array.isArray(itemIds) ? itemIds.filter(Boolean) : [];
  if (ids.length === 0) {
    const items = await fetchItems({ force: true });
    ids = (items || []).map((item) => item.id).filter(Boolean);
  }

  if (ids.length === 0) {
    return { results: [], message: 'Nenhuma conexão Pluggy vinculada ao perfil.' };
  }

  const results = [];

  for (const itemId of ids) {
    try {
      let item = await updateItem(itemId);
      if (item?.status === 'UPDATING') {
        item = await waitForItemUpdate(itemId);
      }

      const needsUserAction = ITEM_STATUSES_NEEDING_USER.has(item?.status);
      results.push({
        itemId,
        ok: !needsUserAction && item?.status === 'UPDATED',
        needsUserAction,
        item,
        connectorName: item?.connector?.name,
        status: item?.status,
        executionStatus: item?.executionStatus,
      });
    } catch (err) {
      results.push({
        itemId,
        ok: false,
        needsUserAction: pluggyErrorNeedsUserAction(err),
        error: err.message,
        code: err.code,
        status: err.status,
      });
    }
  }

  clearApiCache();
  const okCount = results.filter((r) => r.ok).length;
  const needsAction = results.filter((r) => r.needsUserAction).length;
  return {
    results,
    okCount,
    needsAction,
    message:
      needsAction > 0
        ? `${okCount} sincronizada(s); ${needsAction} precisa(m) de autenticação no banco.`
        : `${okCount} de ${results.length} conexão(ões) sincronizada(s) com o banco.`,
  };
}

export async function createConnectToken(itemId) {
  try {
    const res = await api.post('/items/connect-token', { itemId });
    return res.data;
  } catch (err) {
    throw new Error('Não foi possível gerar token de conexão com a Pluggy.ai');
  }
}

export async function generateTelegramLinkToken() {
  try {
    const res = await api.post('/chatbot/telegram/link-token');
    return res.data?.token || null;
  } catch (err) {
    console.error('Erro ao gerar token do telegram:', err);
    throw new Error('Falha ao gerar o token de vinculação do Telegram.');
  }
}

export async function fetchJointStatus({ force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['joint', 'status']);
  return cachedFetch(
    key,
    async () => {
      const res = await api.get('/joint/status');
      return res.data?.link || null;
    },
    { force, ttlMs: 60_000 }
  );
}

export async function generateJointInvite() {
  try {
    const res = await api.post('/joint/invite');
    clearApiCache();
    return res.data?.token || null;
  } catch (err) {
    const message = err.response?.data?.error || err.message || 'Falha ao gerar convite';
    throw new Error(message);
  }
}

export async function acceptJointInvite(token) {
  try {
    const res = await api.post('/joint/accept', { token });
    clearApiCache();
    return res.data;
  } catch (err) {
    const message = err.response?.data?.error || err.message || 'Falha ao aceitar convite';
    throw new Error(message);
  }
}

export async function unlinkJoint() {
  try {
    const res = await api.delete('/joint/unlink');
    clearApiCache();
    return res.data;
  } catch (err) {
    const message = err.response?.data?.error || err.message || 'Falha ao desvincular';
    throw new Error(message);
  }
}

export async function fetchJointMomentData({ force = false } = {}) {
  const scope = await cacheScope();
  const key = cacheKey(scope, ['joint', 'moment-data']);
  return cachedFetch(
    key,
    async () => {
      const res = await api.get('/joint/moment-data');
      return res.data;
    },
    { force, ttlMs: 5 * 60_000 }
  );
}

export async function checkServerHealth() {
  try {
    const res = await api.get('/health');
    return res.data;
  } catch (err) {
    return { status: 'offline', pluggyConfigured: false };
  }
}

export default api;
