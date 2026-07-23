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

export async function checkServerHealth() {
  try {
    const res = await api.get('/health');
    return res.data;
  } catch (err) {
    return { status: 'offline', pluggyConfigured: false };
  }
}

export default api;
