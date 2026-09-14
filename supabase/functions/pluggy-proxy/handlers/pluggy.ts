/**
 * Pluggy API helpers + resource handlers (accounts, transactions, bills, etc.).
 * Shared by legacy routes in index.ts and /v1 wrappers.
 */
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { errorResponse, jsonResponse } from '../middleware/http.ts';
import {
  fetchAccountsWithConnectors,
  loadCreditLedger,
  loadCustomNames,
} from '../utils/creditLedger.ts';
import {
  enrichAccounts,
  enrichBankAccount,
  enrichCreditAccount,
} from '../utils/accountValues.ts';
import { mergeInvestmentsWithReserved } from '../utils/reservedBalances.ts';

export const PLUGGY_API = 'https://api.pluggy.ai';

interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

export interface PluggyClient {
  clientId: string;
  clientSecret: string;
  itemIds: string[];
  userId: string;
  supabase: SupabaseClient;
}

export function asItemIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function getPluggyApiKey(clientId: string, clientSecret: string): Promise<string> {
  const cached = tokenCache.get(clientId);
  if (cached && Date.now() < cached.expiresAt - 5 * 60 * 1000) {
    return cached.token;
  }
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy auth failed: ${err}`);
  }
  const data = await res.json();
  tokenCache.set(clientId, { token: data.apiKey, expiresAt: Date.now() + 7200 * 1000 });
  return data.apiKey;
}

export async function pluggyFetch(
  client: { clientId: string; clientSecret: string },
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string | undefined> } = {},
): Promise<Response> {
  const apiKey = await getPluggyApiKey(client.clientId, client.clientSecret);
  let url = `${PLUGGY_API}${path}`;
  if (options.params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== null) qs.set(k, String(v));
    }
    const qStr = qs.toString();
    if (qStr) url += '?' + qStr;
  }
  const fetchOpts: RequestInit = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
  };
  if (options.body) fetchOpts.body = JSON.stringify(options.body);
  return fetch(url, fetchOpts);
}

export async function pluggyJson(
  client: { clientId: string; clientSecret: string },
  path: string,
  options?: { method?: string; body?: unknown; params?: Record<string, string | undefined> },
): Promise<unknown> {
  const res = await pluggyFetch(client, path, options);
  if (!res.ok) {
    const errText = await res.text();
    let parsed: { message?: string; codeDescription?: string; code?: number; data?: unknown } | null = null;
    try {
      parsed = JSON.parse(errText);
    } catch {
      parsed = null;
    }
    const err = new Error(
      parsed?.message || `Pluggy API ${path} failed (${res.status}): ${errText}`,
    ) as Error & {
      status?: number;
      codeDescription?: string;
      pluggyCode?: number;
      pluggyData?: unknown;
    };
    err.status = res.status;
    err.codeDescription = parsed?.codeDescription;
    err.pluggyCode = parsed?.code;
    err.pluggyData = parsed?.data;
    throw err;
  }
  return res.json();
}

/** Resolve a pasted UUID to a Pluggy Item id (rejects bare Account UUIDs unless remapped). */
export async function resolvePluggyItemId(
  client: { clientId: string; clientSecret: string },
  id: string,
): Promise<{ itemId: string; remappedFromAccount?: string; accountName?: string }> {
  try {
    const item = await pluggyJson(client, `/items/${id}`) as { id?: string };
    if (item?.id) return { itemId: item.id };
  } catch (e) {
    const err = e as { status?: number };
    if (err.status && err.status !== 404) throw e;
  }

  try {
    const account = await pluggyJson(client, `/accounts/${id}`) as {
      id?: string;
      itemId?: string;
      name?: string;
    };
    if (account?.itemId) {
      return {
        itemId: account.itemId,
        remappedFromAccount: account.id,
        accountName: account.name,
      };
    }
  } catch (e) {
    const err = e as { status?: number };
    if (err.status && err.status !== 404) throw e;
  }

  const err = new Error('Conexão Pluggy não encontrada para este ID.') as Error & { status?: number };
  err.status = 404;
  throw err;
}

export function ownedItemIds(client: PluggyClient, requested?: string | null): string[] {
  if (requested) {
    return client.itemIds.includes(requested) ? [requested] : [];
  }
  return client.itemIds;
}

export async function handleAccounts(client: PluggyClient, url: URL, id?: string): Promise<Response> {
  if (id) {
    const account = await pluggyJson(client, `/accounts/${id}`) as {
      itemId?: string;
      type?: string;
      id?: string;
    };
    if (!account?.itemId || !client.itemIds.includes(account.itemId)) {
      return errorResponse('Acesso negado para esta conta', 403);
    }
    const type = String(account.type || "").toUpperCase();
    if (type === "CREDIT") {
      const { transactionsByAccount, billsByAccount } = await loadCreditLedger(client, [account]);
      const accId = String(account.id || id);
      return jsonResponse(enrichCreditAccount(
        account,
        transactionsByAccount[accId] || [],
        billsByAccount[accId] || [],
      ));
    }
    return jsonResponse(enrichBankAccount(account));
  }

  const itemId = url.searchParams.get('itemId');
  const type = url.searchParams.get('type') ?? undefined;
  const targetItemIds = ownedItemIds(client, itemId);
  if (itemId && targetItemIds.length === 0) {
    return errorResponse('Acesso negado para este item ID', 403);
  }
  if (targetItemIds.length === 0) {
    return jsonResponse({ results: [], total: 0 });
  }

  let all = await fetchAccountsWithConnectors(client);
  if (itemId) all = all.filter((acc) => String(acc.itemId) === itemId);
  if (type) all = all.filter((acc) => String(acc.type).toUpperCase() === String(type).toUpperCase());

  const creditCards = all.filter((acc) => String(acc.type).toUpperCase() === "CREDIT");
  const { transactionsByAccount, billsByAccount } = await loadCreditLedger(client, creditCards);
  const names = await loadCustomNames(client);
  const enriched = enrichAccounts(all, transactionsByAccount, billsByAccount).map((acc) => {
    const accId = String(acc.id || "");
    if (accId && names[accId]) acc.name = names[accId];
    return acc;
  });
  return jsonResponse({ results: enriched, total: enriched.length });
}

export async function handleTransactions(
  client: PluggyClient,
  url: URL,
  method: string,
  id?: string,
): Promise<Response> {
  if (method === 'PATCH' && id) return jsonResponse({ message: 'patch not supported in proxy mode' });
  if (id) return jsonResponse(await pluggyJson(client, `/transactions/${id}`));
  const accountId = url.searchParams.get('accountId');
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  if (client.itemIds.length === 0) return jsonResponse({ results: [], total: 0 });

  let accountIds = accountId ? [accountId] : [];
  if (!accountId) {
    for (const iid of client.itemIds) {
      try {
        const d = await pluggyJson(client, '/accounts', { params: { itemId: iid } }) as {
          results?: { id: string }[];
        };
        accountIds.push(...(d.results || []).map((a) => a.id));
      } catch (_) {
        /* skip item */
      }
    }
  }
  const all: unknown[] = [];
  for (const accId of accountIds) {
    try {
      const params: Record<string, string | undefined> = { accountId: accId, from, to, cursor };
      const d = await pluggyJson(client, '/v2/transactions', { params }) as { results?: unknown[] };
      all.push(...(d.results || []));
    } catch (_) {
      /* skip account */
    }
  }
  return jsonResponse({ results: all, total: all.length });
}

export async function handleInvestments(client: PluggyClient, url: URL, id?: string): Promise<Response> {
  if (id) return jsonResponse(await pluggyJson(client, `/investments/${id}`));
  const itemId = url.searchParams.get('itemId');
  const type = url.searchParams.get('type') ?? undefined;
  const targetItemIds = ownedItemIds(client, itemId);
  if (itemId && targetItemIds.length === 0) return errorResponse('Acesso negado para este item ID', 403);
  if (targetItemIds.length === 0) return jsonResponse({ results: [], total: 0 });
  const all: unknown[] = [];
  for (const iid of targetItemIds) {
    try {
      const params: Record<string, string | undefined> = { itemId: iid };
      if (type) params.type = type;
      const d = await pluggyJson(client, '/investments', { params }) as { results?: unknown[] };
      all.push(...(d.results || []));
    } catch (_) {
      /* skip */
    }
  }
  const accounts = await fetchAccountsWithConnectors(client);
  const merged = mergeInvestmentsWithReserved(all as Record<string, unknown>[], accounts);
  return jsonResponse({ results: merged, total: merged.length });
}

export async function handleLoans(client: PluggyClient, url: URL, id?: string): Promise<Response> {
  if (id) return jsonResponse(await pluggyJson(client, `/loans/${id}`));
  const itemId = url.searchParams.get('itemId');
  const targetItemIds = ownedItemIds(client, itemId);
  if (itemId && targetItemIds.length === 0) return errorResponse('Acesso negado para este item ID', 403);
  if (targetItemIds.length === 0) return jsonResponse({ results: [], total: 0 });
  const all: unknown[] = [];
  for (const iid of targetItemIds) {
    try {
      const d = await pluggyJson(client, '/loans', { params: { itemId: iid } }) as { results?: unknown[] };
      all.push(...(d.results || []));
    } catch (_) {
      /* skip */
    }
  }
  return jsonResponse({ results: all, total: all.length });
}

export async function handleBills(
  client: PluggyClient,
  url: URL,
  id?: string,
  subPath?: string,
): Promise<Response> {
  if (id && subPath === 'transactions') {
    return jsonResponse(await pluggyJson(client, `/bills/${id}/transactions`));
  }
  if (id) return jsonResponse(await pluggyJson(client, `/bills/${id}`));
  const accountId = url.searchParams.get('accountId') ?? undefined;
  return jsonResponse(await pluggyJson(client, '/bills', { params: accountId ? { accountId } : {} }));
}

export async function handleConnectors(client: PluggyClient, url: URL, id?: string): Promise<Response> {
  if (id) return jsonResponse(await pluggyJson(client, `/connectors/${id}`));
  const name = url.searchParams.get('name') ?? undefined;
  const countries = url.searchParams.get('countries') ?? 'BR';
  return jsonResponse(await pluggyJson(client, '/connectors', { params: { countries, name } }));
}

async function saveItemIds(client: PluggyClient, nextIds: string[]): Promise<void> {
  const { error } = await client.supabase
    .from('profiles')
    .upsert({ id: client.userId, pluggy_item_ids: nextIds }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  client.itemIds = nextIds;
}

export async function handleItems(
  client: PluggyClient,
  url: URL,
  method: string,
  body: unknown,
  idOrAction?: string,
): Promise<Response> {
  void url;
  if (idOrAction === 'connect-token' && method === 'POST') {
    const itemId = (body as { itemId?: string })?.itemId;
    if (itemId && !client.itemIds.includes(itemId)) {
      return errorResponse('Acesso negado para este item ID', 403);
    }

    const payload: Record<string, unknown> = {
      options: { clientUserId: client.userId },
    };
    if (itemId) payload.itemId = itemId;

    return jsonResponse(await pluggyJson(client, '/connect_token', { method: 'POST', body: payload }));
  }

  const id = idOrAction;
  if (id && method === 'PATCH') {
    if (!client.itemIds.includes(id)) return errorResponse('Acesso negado para este item ID', 403);
    return jsonResponse(await pluggyJson(client, `/items/${id}`, { method: 'PATCH', body }));
  }
  if (id && method === 'DELETE') {
    if (!client.itemIds.includes(id)) return errorResponse('Acesso negado para este item ID', 403);
    try {
      await pluggyFetch(client, `/items/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn(`[pluggy-proxy] Failed deleting item ${id} from Pluggy:`, e);
    }
    const nextIds = client.itemIds.filter((item) => item !== id);
    await saveItemIds(client, nextIds);
    return jsonResponse({ success: true, message: 'Conexão removida com sucesso' });
  }
  if (id) {
    if (!client.itemIds.includes(id)) return errorResponse('Acesso negado para este item ID', 403);
    return jsonResponse(await pluggyJson(client, `/items/${id}`));
  }

  const itemIds = client.itemIds;
  if (itemIds.length === 0) return jsonResponse({ results: [], total: 0 });
  const results: unknown[] = [];
  for (const iid of itemIds) {
    try {
      const d = await pluggyJson(client, `/items/${iid}`);
      results.push(d);
    } catch (e) {
      console.error(`[pluggy-proxy] Failed to fetch item ${iid}:`, e);
    }
  }
  return jsonResponse({ results, total: results.length });
}

export async function handleWebhooks(
  client: PluggyClient,
  url: URL,
  method: string,
  body: unknown,
  action?: string,
): Promise<Response> {
  void url;
  if (method === 'GET' && action === 'list') {
    return jsonResponse(await pluggyJson(client, '/webhooks'));
  }
  if (method === 'GET' && action === 'history') {
    return jsonResponse([]);
  }
  if (method === 'POST' && action === 'register') {
    const { url: webhookUrl, event = 'all' } = body as { url?: string; event?: string };
    if (!webhookUrl) return errorResponse('URL é obrigatória', 400);
    return jsonResponse(
      await pluggyJson(client, '/webhooks', { method: 'POST', body: { url: webhookUrl, event } }),
    );
  }
  if (method === 'DELETE' && action) {
    await pluggyFetch(client, `/webhooks/${action}`, { method: 'DELETE' });
    return jsonResponse({ success: true });
  }
  return errorResponse('Invalid webhook action', 400);
}
