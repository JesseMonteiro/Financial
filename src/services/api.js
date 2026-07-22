import axios from 'axios';

// In production (GitHub Pages) calls go to the Supabase Edge Function.
// Locally, Vite proxies /api → localhost:3001 (vite.config.js proxy setting).
const SUPABASE_FUNCTION_URL = 'https://tslzhkbxabbhrmbefhrj.supabase.co/functions/v1/pluggy-proxy';
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? '/api' : SUPABASE_FUNCTION_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});


export async function fetchAccounts(itemId) {
  try {
    const res = await api.get('/accounts', { params: itemId ? { itemId } : {} });
    const data = res.data;
    if (data && Array.isArray(data.results)) {
      return data.results;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (err) {
    console.warn('[API Error] Falha ao buscar contas:', err.message);
    return [];
  }
}

export async function fetchTransactions(params = {}) {
  try {
    const res = await api.get('/transactions', { params });
    const data = res.data;
    if (data && Array.isArray(data.results)) {
      return data;
    }
    if (Array.isArray(data)) {
      return { results: data, next: null };
    }
    return { results: [], next: null };
  } catch (err) {
    console.warn('[API Error] Falha ao buscar transações:', err.message);
    return { results: [], next: null };
  }
}

export async function fetchBills(accountId) {
  try {
    const res = await api.get('/bills', { params: accountId ? { accountId } : {} });
    const data = res.data;
    if (data && Array.isArray(data.results)) {
      return data.results;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (err) {
    console.warn('[API Error] Falha ao buscar faturas:', err.message);
    return [];
  }
}

export async function fetchInvestments(itemId) {
  try {
    const res = await api.get('/investments', { params: itemId ? { itemId } : {} });
    const data = res.data;
    if (data && Array.isArray(data.results)) {
      return data.results;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (err) {
    console.warn('[API Error] Falha ao buscar investimentos:', err.message);
    return [];
  }
}

export async function fetchLoans(itemId) {
  try {
    const res = await api.get('/loans', { params: itemId ? { itemId } : {} });
    const data = res.data;
    if (data && Array.isArray(data.results)) {
      return data.results;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  } catch (err) {
    console.warn('[API Error] Falha ao buscar empréstimos:', err.message);
    return [];
  }
}

export async function fetchCategories() {
  try {
    const res = await api.get('/categories');
    const data = res.data;
    return data?.results || data || [];
  } catch (err) {
    return [];
  }
}

export async function fetchConnectors() {
  try {
    const res = await api.get('/connectors');
    const data = res.data;
    return data?.results || data || [];
  } catch (err) {
    return [];
  }
}

export async function fetchItems() {
  try {
    const res = await api.get('/items');
    const data = res.data;
    return data?.results || data || [];
  } catch (err) {
    return [];
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

export async function checkServerHealth() {
  try {
    const res = await api.get('/health');
    return res.data;
  } catch (err) {
    return { status: 'offline', pluggyConfigured: false };
  }
}

export default api;
