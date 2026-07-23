// Pluggy Proxy — Supabase Edge Function (multi-user via profiles.pluggy_item_ids)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { summarizeCardOpenBill } from "./creditBillPeriod.ts";

const PLUGGY_API = 'https://api.pluggy.ai';

interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 500): Response {
  console.error(`[pluggy-proxy] Error Response (${status}): ${message}`);
  return jsonResponse({ error: message }, status);
}

function asItemIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

interface PluggyClient {
  clientId: string;
  clientSecret: string;
  itemIds: string[];
  userId: string;
  supabase: SupabaseClient;
}

async function getPluggyApiKey(clientId: string, clientSecret: string): Promise<string> {
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

async function pluggyFetch(
  client: { clientId: string; clientSecret: string },
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string | undefined> } = {}
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

async function pluggyJson(
  client: { clientId: string; clientSecret: string },
  path: string,
  options?: { method?: string; body?: unknown; params?: Record<string, string | undefined> }
): Promise<unknown> {
  const res = await pluggyFetch(client, path, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy API ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

function ownedItemIds(client: PluggyClient, requested?: string | null): string[] {
  if (requested) {
    return client.itemIds.includes(requested) ? [requested] : [];
  }
  return client.itemIds;
}

async function handleAccounts(client: PluggyClient, url: URL, id?: string): Promise<Response> {
  if (id) {
    const account = await pluggyJson(client, `/accounts/${id}`) as { itemId?: string };
    if (!account?.itemId || !client.itemIds.includes(account.itemId)) {
      return errorResponse('Acesso negado para esta conta', 403);
    }
    return jsonResponse(account);
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

  const all: unknown[] = [];
  for (const iid of targetItemIds) {
    try {
      const params: Record<string, string | undefined> = { itemId: iid };
      if (type) params.type = type;
      const d = await pluggyJson(client, '/accounts', { params }) as { results?: unknown[] };
      all.push(...(d.results || []));
    } catch (e) {
      console.error(`[pluggy-proxy] Error fetching accounts for item ${iid}:`, e);
    }
  }
  return jsonResponse({ results: all, total: all.length });
}

async function handleTransactions(client: PluggyClient, url: URL, method: string, id?: string): Promise<Response> {
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
        const d = await pluggyJson(client, '/accounts', { params: { itemId: iid } }) as { results?: { id: string }[] };
        accountIds.push(...(d.results || []).map(a => a.id));
      } catch (_) {}
    }
  }
  const all: unknown[] = [];
  for (const accId of accountIds) {
    try {
      const params: Record<string, string | undefined> = { accountId: accId, from, to, cursor };
      const d = await pluggyJson(client, '/v2/transactions', { params }) as { results?: unknown[] };
      all.push(...(d.results || []));
    } catch (_) {}
  }
  return jsonResponse({ results: all, total: all.length });
}

async function handleInvestments(client: PluggyClient, url: URL, id?: string): Promise<Response> {
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
    } catch (_) {}
  }
  return jsonResponse({ results: all, total: all.length });
}

async function handleLoans(client: PluggyClient, url: URL, id?: string): Promise<Response> {
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
    } catch (_) {}
  }
  return jsonResponse({ results: all, total: all.length });
}

async function handleBills(client: PluggyClient, url: URL, id?: string, subPath?: string): Promise<Response> {
  if (id && subPath === 'transactions') return jsonResponse(await pluggyJson(client, `/bills/${id}/transactions`));
  if (id) return jsonResponse(await pluggyJson(client, `/bills/${id}`));
  const accountId = url.searchParams.get('accountId') ?? undefined;
  return jsonResponse(await pluggyJson(client, '/bills', { params: accountId ? { accountId } : {} }));
}

async function handleConnectors(client: PluggyClient, url: URL, id?: string): Promise<Response> {
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

async function handleItems(client: PluggyClient, url: URL, method: string, body: unknown, idOrAction?: string): Promise<Response> {
  if (idOrAction === 'connect-token' && method === 'POST') {
    const itemId = (body as { itemId?: string })?.itemId;
    if (itemId && !client.itemIds.includes(itemId)) {
      return errorResponse('Acesso negado para este item ID', 403);
    }

    // clientUserId tags the Pluggy Item with the FinanceHub user for multi-tenant isolation
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

async function handleWebhooks(client: PluggyClient, url: URL, method: string, body: unknown, action?: string): Promise<Response> {
  if (method === 'GET' && action === 'list') {
    return jsonResponse(await pluggyJson(client, '/webhooks'));
  }
  if (method === 'GET' && action === 'history') {
    return jsonResponse([]);
  }
  if (method === 'POST' && action === 'register') {
    const { url: webhookUrl, event = 'all' } = body as { url?: string; event?: string };
    if (!webhookUrl) return errorResponse('URL é obrigatória', 400);
    return jsonResponse(await pluggyJson(client, '/webhooks', { method: 'POST', body: { url: webhookUrl, event } }));
  }
  if (method === 'DELETE' && action) {
    await pluggyFetch(client, `/webhooks/${action}`, { method: 'DELETE' });
    return jsonResponse({ success: true });
  }
  return errorResponse('Invalid webhook action', 400);
}

// ─── Telegram chatbot (per-user context via profiles.telegram_chat_id) ───

interface TelegramProfile {
  id: string;
  display_name?: string;
  pluggy_item_ids?: unknown;
  pluggy_client_id?: string | null;
  pluggy_client_secret?: string | null;
  custom_account_names?: Record<string, string> | null;
}

function resolvePluggyCredentials(profile: TelegramProfile): { clientId: string; clientSecret: string } | null {
  if (profile.pluggy_client_id && profile.pluggy_client_secret) {
    return { clientId: profile.pluggy_client_id, clientSecret: profile.pluggy_client_secret };
  }
  const envId = Deno.env.get('PLUGGY_CLIENT_ID');
  const envSecret = Deno.env.get('PLUGGY_CLIENT_SECRET');
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };
  return null;
}

/** Prefer the name the user set in Accounts/Cards over Pluggy's raw name. */
function accountDisplayName(profile: TelegramProfile, account: { id?: string; name?: string }): string {
  const custom = profile.custom_account_names;
  if (custom && account?.id && custom[account.id]) {
    return String(custom[account.id]);
  }
  return account?.name || 'Conta';
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN missing');
    return;
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

async function parseIntentWithGemini(text: string): Promise<{ intent: string; data?: Record<string, unknown>; message?: string }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return { intent: 'UNKNOWN', message: 'Assistente de linguagem natural indisponível no momento.' };

  const system = `Você é o assistente do FinanceHub. Retorne APENAS JSON:
{"intent":"ADD_TRANSACTION"|"GET_BALANCE"|"GET_CREDIT_BILLS"|"GET_TRANSACTIONS"|"GET_WEEKLY_SUMMARY"|"UNKNOWN","data":{"amount":number,"description":string,"category":string,"type":"DEBIT"|"CREDIT","date_offset_days":number},"message":string}
Regras de intent:
- GET_BALANCE: saldo de conta corrente/poupança/banco (ex: "qual meu saldo?", "saldo das contas"). NÃO use para fatura ou cartão.
- GET_CREDIT_BILLS: fatura/dívida/limite de cartão de crédito (ex: "minhas faturas", "fatura do cartão", "quanto está a fatura").
- GET_TRANSACTIONS: extrato/últimos lançamentos.
- GET_WEEKLY_SUMMARY: resumo da semana / quanto gastei esta semana / /resumo.
- ADD_TRANSACTION: registrar gasto ou receita.
Categorias: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Outros.`;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError = '';
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      lastError = await res.text();
      console.error(`[telegram] Gemini error (${model}):`, lastError);
      continue;
    }
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    try {
      return JSON.parse(raw);
    } catch {
      return { intent: 'UNKNOWN', message: 'Não consegui entender o comando.' };
    }
  }

  return {
    intent: 'UNKNOWN',
    message: 'Desculpe, tive um problema ao interpretar sua mensagem. Tente /saldo, /faturas ou /ultimos.',
  };
}

function parseIntentLocally(text: string): { intent: string; data?: Record<string, unknown>; message?: string } | null {
  const lower = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

  // Faturas/cartão antes de saldo — evita "saldo da fatura" cair em GET_BALANCE.
  if (
    lower === '/faturas' ||
    lower === '/fatura' ||
    lower === '/cartoes' ||
    lower === 'faturas' ||
    lower === 'fatura' ||
    /\b(fatura|faturas|cartao(es)? de credito|limite do cartao|divida do cartao)\b/.test(lower)
  ) {
    return { intent: 'GET_CREDIT_BILLS' };
  }

  if (
    lower === '/saldo' ||
    lower === 'saldo' ||
    lower === '/contas' ||
    /\b(saldo|quanto tenho|meu patrimonio|meus saldos|conta corrente|poupanca|saldo das contas)\b/.test(lower)
  ) {
    return { intent: 'GET_BALANCE' };
  }

  if (
    lower === '/ultimos' ||
    lower === 'extrato' ||
    /\b(extrato|ultimas? (compras|transacoes|lancamentos)|ultimos gastos)\b/.test(lower)
  ) {
    return { intent: 'GET_TRANSACTIONS' };
  }

  if (
    lower === '/resumo' ||
    lower === 'resumo' ||
    /\b(resumo (da |dessa )?semana|quanto gastei (essa|esta) semana|recap)\b/.test(lower)
  ) {
    return { intent: 'GET_WEEKLY_SUMMARY' };
  }

  return null;
}

async function fetchPluggyAccountsForProfile(profile: TelegramProfile): Promise<Array<{
  name: string;
  balance: number;
  id: string;
  type?: string;
  number?: string;
  creditData?: { availableCreditLimit?: number; creditLimit?: number; balanceDueDate?: string };
}>> {
  const itemIds = asItemIdList(profile.pluggy_item_ids);
  const creds = resolvePluggyCredentials(profile);
  if (!itemIds.length || !creds) return [];

  const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };
  const all: Array<{
    name: string;
    balance: number;
    id: string;
    type?: string;
    number?: string;
    creditData?: { availableCreditLimit?: number; creditLimit?: number; balanceDueDate?: string };
  }> = [];
  for (const itemId of itemIds) {
    try {
      const d = await pluggyJson(client, '/accounts', { params: { itemId } }) as {
        results?: Array<{
          name: string;
          balance: number;
          id: string;
          type?: string;
          number?: string;
          creditData?: { availableCreditLimit?: number; creditLimit?: number; balanceDueDate?: string };
        }>;
      };
      all.push(...(d.results || []));
    } catch (e) {
      console.error(`[telegram] accounts for item ${itemId}:`, e);
    }
  }
  return all;
}

function formatMoney(value: number): string {
  return `R$ ${Number(value).toFixed(2)}`;
}

async function buildBankBalanceText(profile: TelegramProfile, supabase: ReturnType<typeof createClient>): Promise<string> {
  const accounts = await fetchPluggyAccountsForProfile(profile);
  const bankAccounts = accounts.filter((a) => a.type === 'BANK');

  let manualBalance = 0;
  const { data: manualTxs } = await supabase
    .from('manual_transactions')
    .select('amount, type')
    .eq('user_id', profile.id);

  (manualTxs || []).forEach((tx: { amount: number; type: string }) => {
    const amt = Number(tx.amount);
    manualBalance += tx.type === 'DEBIT' ? -amt : amt;
  });

  let text = `🏦 *Saldos das contas — ${profile.display_name || 'usuário'}*\n\n`;
  let bankTotal = 0;

  if (bankAccounts.length) {
    for (const acc of bankAccounts) {
      const bal = Number(acc.balance || 0);
      bankTotal += bal;
      text += `• *${accountDisplayName(profile, acc)}*: ${formatMoney(bal)}\n`;
    }
    text += `\n💵 *Total em contas:* ${formatMoney(bankTotal)}`;
  } else {
    text += `_Nenhuma conta bancária conectada._`;
  }

  if (manualBalance !== 0) {
    text += `\n📦 *Carteira manual:* ${formatMoney(manualBalance)}`;
    text += `\n📊 *Total disponível:* ${formatMoney(bankTotal + manualBalance)}`;
  }

  text += `\n\n_Para faturas de cartão, diga "faturas" ou /faturas._`;
  return text;
}

async function fetchPluggyBillsForAccount(
  client: { clientId: string; clientSecret: string },
  accountId: string,
): Promise<Array<Record<string, unknown>>> {
  try {
    const d = await pluggyJson(client, '/bills', { params: { accountId } }) as { results?: Array<Record<string, unknown>> };
    return (d.results || []).map((b) => ({ ...b, accountId }));
  } catch (e) {
    console.error('[telegram] bills fail', accountId, e);
    return [];
  }
}

async function fetchAllPluggyTransactionsForAccount(
  client: { clientId: string; clientSecret: string },
  accountId: string,
): Promise<Array<Record<string, unknown>>> {
  const results: Array<Record<string, unknown>> = [];
  let next: string | null = null;
  let guard = 0;
  const apiKey = await getPluggyApiKey(client.clientId, client.clientSecret);

  do {
    try {
      const url = next
        ? (next.startsWith('http') ? next : `${PLUGGY_API}${next}`)
        : `${PLUGGY_API}/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
      const res = await fetch(url, { headers: { 'X-API-KEY': apiKey, Accept: 'application/json' } });
      if (!res.ok) {
        console.error('[telegram] tx fail', accountId, res.status, await res.text());
        break;
      }
      const data = await res.json() as { results?: Array<Record<string, unknown>>; next?: string | null };
      for (const t of data.results || []) {
        results.push({ ...t, accountId: t.accountId || accountId });
      }
      next = data.next || null;
    } catch (e) {
      console.error('[telegram] tx fail', accountId, e);
      break;
    }
    guard++;
  } while (next && guard < 30);

  return results;
}

async function buildCreditBillsText(profile: TelegramProfile): Promise<string> {
  const accounts = await fetchPluggyAccountsForProfile(profile);
  const creditCards = accounts.filter((a) => a.type === 'CREDIT');

  let text = `💳 *Faturas em aberto — ${profile.display_name || 'usuário'}*\n\n`;
  let creditDebt = 0;

  if (!creditCards.length) {
    return `${text}_Nenhum cartão de crédito conectado._\n\n_Para saldo de contas, diga "saldo" ou /saldo._`;
  }

  const creds = resolvePluggyCredentials(profile);
  if (!creds) {
    return `${text}_Credenciais Pluggy indisponíveis._`;
  }
  const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };

  for (const acc of creditCards) {
    const [bills, txs] = await Promise.all([
      fetchPluggyBillsForAccount(client, acc.id),
      fetchAllPluggyTransactionsForAccount(client, acc.id),
    ]);
    const summary = summarizeCardOpenBill(acc, txs, bills);
    creditDebt += summary.openTotal;

    const last4 = acc.number ? ` • final ${String(acc.number).slice(-4)}` : '';
    const due = summary.openDueDate
      ? `\n  Vencimento: ${new Date(summary.openDueDate).toLocaleDateString('pt-BR')}`
      : '';
    const limit = summary.creditLimit != null
      ? `\n  Limite total: ${formatMoney(summary.creditLimit)}`
      : '';
    const available = summary.availableLimit != null
      ? `\n  Limite disponível: ${formatMoney(summary.availableLimit)}`
      : '';
    const lastPaid = summary.lastPaidTitle
      ? `\n  Última paga: ${summary.lastPaidTitle} (${formatMoney(summary.lastPaidTotal || 0)})`
      : '';

    text += `• *${accountDisplayName(profile, acc)}*${last4}\n`;
    text += `  ${summary.openTitle} (em aberto): *${formatMoney(summary.openTotal)}*${due}`;
    text += `\n  ${summary.openItemCount} lançamentos${limit}${available}${lastPaid}\n\n`;
  }

  text += `🧾 *Total em faturas abertas:* ${formatMoney(creditDebt)}`;
  text += `\n\n_Valor = soma dos lançamentos da *próxima fatura* (ciclo aberto), não a dívida total do cartão._`;
  text += `\n_Para saldo de contas, diga "saldo" ou /saldo._`;
  return text;
}

async function buildTransactionsText(profile: TelegramProfile, supabase: ReturnType<typeof createClient>): Promise<string> {
  const transactions: Array<{ date: Date; description: string; amount: number; type: string; category: string; origin: string }> = [];
  const itemIds = asItemIdList(profile.pluggy_item_ids);
  const creds = resolvePluggyCredentials(profile);

  if (itemIds.length && creds) {
    const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };
    const accounts = await fetchPluggyAccountsForProfile(profile);
    for (const acc of accounts.slice(0, 3)) {
      try {
        const d = await pluggyJson(client, '/v2/transactions', {
          params: { accountId: acc.id },
        }) as { results?: Array<{ date: string; description: string; amount: number; category?: string }> };
        for (const t of d.results || []) {
          const amount = Number(t.amount);
          transactions.push({
            date: new Date(t.date),
            description: t.description,
            amount,
            type: amount < 0 ? 'DEBIT' : 'CREDIT',
            category: t.category || 'Outros',
            origin: 'Banco',
          });
        }
      } catch (_) {}
    }
  }

  const { data: manualTxs } = await supabase
    .from('manual_transactions')
    .select('date, description, amount, type, category')
    .eq('user_id', profile.id)
    .order('date', { ascending: false })
    .limit(5);

  for (const t of manualTxs || []) {
    transactions.push({
      date: new Date(t.date),
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      category: t.category || 'Outros',
      origin: 'Manual',
    });
  }

  if (!transactions.length) return '📝 Nenhuma transação recente encontrada.';
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  let text = `📝 *Últimos Lançamentos de ${profile.display_name || 'usuário'}:*\n\n`;
  for (const tx of transactions.slice(0, 8)) {
    const dateStr = tx.date.toLocaleDateString('pt-BR');
    const prefix = tx.type === 'CREDIT' ? '🟢' : '🔴';
    const sign = tx.type === 'CREDIT' ? '+' : '-';
    text += `${prefix} *${dateStr}* - ${tx.description}\n     Valor: R$ ${sign}${Math.abs(tx.amount).toFixed(2)} [${tx.origin}] (${tx.category})\n`;
  }
  return text;
}

async function buildWeeklyRecapText(profile: TelegramProfile, supabase: ReturnType<typeof createClient>): Promise<string> {
  const money = (n: number) =>
    Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const now = new Date();
  const thisStart = new Date(now);
  thisStart.setDate(thisStart.getDate() - 6);
  thisStart.setHours(0, 0, 0, 0);
  const prevEnd = new Date(thisStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);
  prevStart.setHours(0, 0, 0, 0);

  const txs: Array<{ date: Date; amount: number; type?: string; category: string; description: string }> = [];
  const accounts = await fetchPluggyAccountsForProfile(profile);
  const creds = resolvePluggyCredentials(profile);
  if (creds) {
    const client = { clientId: creds.clientId, clientSecret: creds.clientSecret };
    for (const acc of accounts.slice(0, 6)) {
      try {
        const d = await pluggyJson(client, '/v2/transactions', {
          params: { accountId: acc.id, pageSize: 50, from: prevStart.toISOString().slice(0, 10) },
        }) as { results?: Array<{ date: string; description: string; amount: number; category?: string }> };
        for (const t of d.results || []) {
          txs.push({
            date: new Date(t.date),
            amount: Number(t.amount),
            category: t.category || 'Outros',
            description: t.description || '',
          });
        }
      } catch (_) {}
    }
  }

  const { data: manualTxs } = await supabase
    .from('manual_transactions')
    .select('date, description, amount, type, category')
    .eq('user_id', profile.id)
    .gte('date', prevStart.toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(100);

  for (const t of manualTxs || []) {
    txs.push({
      date: new Date(t.date),
      amount: Number(t.amount),
      type: t.type || (Number(t.amount) < 0 ? 'DEBIT' : 'CREDIT'),
      category: t.category || 'Outros',
      description: t.description || '',
    });
  }

  const isExpense = (t: { amount: number; type?: string }) =>
    Number(t.amount) < 0 || t.type === 'DEBIT';
  const inRange = (t: { date: Date }, from: Date, to: Date) => t.date >= from && t.date <= to;
  const sumWeek = (from: Date, to: Date) => {
    let total = 0;
    const cats: Record<string, number> = {};
    for (const t of txs) {
      if (!isExpense(t) || !inRange(t, from, to)) continue;
      const desc = (t.description || '').toUpperCase();
      if (desc.includes('PAGAMENTO DE FATURA') || desc.includes('PAGAMENTO RECEBIDO')) continue;
      const amt = Math.abs(Number(t.amount) || 0);
      total += amt;
      cats[t.category] = (cats[t.category] || 0) + amt;
    }
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    return { total, top };
  };

  const current = sumWeek(thisStart, now);
  const previous = sumWeek(prevStart, prevEnd);
  const deltaPct =
    previous.total > 0
      ? (((current.total - previous.total) / previous.total) * 100).toFixed(0)
      : current.total > 0
        ? '100'
        : '0';

  let text = `📊 *Resumo semanal de ${profile.display_name || 'usuário'}*\n\n`;
  text += `💸 Gastos (7 dias): *${money(current.total)}*\n`;
  text += `📅 Semana anterior: ${money(previous.total)} (${Number(deltaPct) > 0 ? '+' : ''}${deltaPct}%)\n`;
  if (current.top) {
    text += `🏷 Maior categoria: *${current.top[0]}* (${money(current.top[1])})\n`;
  }
  text += `\n_Diga /faturas para cartões ou /saldo para contas._`;
  return text;
}

async function handleTelegramWebhook(payload: unknown): Promise<void> {
  const message = (payload as { message?: { chat?: { id?: number | string }; text?: string } })?.message;
  if (!message?.text || message.chat?.id == null) return;

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  if (text.startsWith('/start')) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await sendTelegramMessage(chatId, '👋 *Olá! Eu sou o assistente do FinanceHub.*\n\nVincule sua conta em *Configurações → Conectar Telegram*.');
      return;
    }
    const { data: linkResult, error } = await supabase.rpc('link_telegram_user', { p_token: token, p_chat_id: chatId });
    if (error || !linkResult?.success) {
      await sendTelegramMessage(chatId, `❌ *Falha ao vincular:* ${linkResult?.message || error?.message || 'Token inválido'}`);
    } else {
      await sendTelegramMessage(chatId, `🎉 *Olá, ${linkResult.display_name}!*\n\nConta vinculada. Experimente:\n• /saldo — contas\n• /faturas — cartões`);
    }
    return;
  }

  const { data: profile, error: profileError } = await supabase.rpc('get_profile_by_telegram_chat_id', { p_chat_id: chatId });
  if (profileError || !profile?.id) {
    await sendTelegramMessage(chatId, '⚠️ *Conta não vinculada!*\nVá em Configurações do FinanceHub e conecte o Telegram.');
    return;
  }

  console.log(`[telegram] chat=${chatId} user=${profile.id} name=${profile.display_name} items=${asItemIdList(profile.pluggy_item_ids).length}`);

  let parsed: { intent: string; data?: Record<string, unknown>; message?: string } = { intent: 'UNKNOWN' };
  const local = parseIntentLocally(text);
  if (local) parsed = local;
  else parsed = await parseIntentWithGemini(text);

  if (parsed.intent === 'GET_BALANCE') {
    await sendTelegramMessage(chatId, '🔍 _Buscando saldo das contas..._');
    await sendTelegramMessage(chatId, await buildBankBalanceText(profile, supabase));
    return;
  }

  if (parsed.intent === 'GET_CREDIT_BILLS') {
    await sendTelegramMessage(chatId, '🔍 _Buscando faturas dos cartões..._');
    await sendTelegramMessage(chatId, await buildCreditBillsText(profile));
    return;
  }

  if (parsed.intent === 'GET_TRANSACTIONS') {
    await sendTelegramMessage(chatId, '🔍 _Buscando lançamentos..._');
    await sendTelegramMessage(chatId, await buildTransactionsText(profile, supabase));
    return;
  }

  if (parsed.intent === 'GET_WEEKLY_SUMMARY') {
    await sendTelegramMessage(chatId, '🔍 _Montando resumo da semana..._');
    await sendTelegramMessage(chatId, await buildWeeklyRecapText(profile, supabase));
    return;
  }

  if (parsed.intent === 'ADD_TRANSACTION') {
    const amount = Number(parsed.data?.amount);
    const description = String(parsed.data?.description || '');
    if (!amount || !description) {
      await sendTelegramMessage(chatId, '❌ Informe o valor e a descrição do lançamento.');
      return;
    }
    const formattedType = (parsed.data?.type as string) || 'DEBIT';
    const formattedCategory = (parsed.data?.category as string) || 'Outros';
    const dateOffset = Number(parsed.data?.date_offset_days || 0);
    const { data: txResult, error: txError } = await supabase.rpc('create_manual_transaction_from_telegram', {
      p_chat_id: chatId,
      p_amount: amount,
      p_description: description,
      p_category: formattedCategory,
      p_type: formattedType,
      p_date_offset_days: dateOffset,
    });
    if (txError || !txResult?.success) {
      await sendTelegramMessage(chatId, `❌ Erro ao salvar: ${txError?.message || txResult?.message}`);
    } else {
      const emoji = formattedType === 'CREDIT' ? '💰' : '💸';
      const typeText = formattedType === 'CREDIT' ? 'Receita' : 'Despesa';
      await sendTelegramMessage(chatId, `${emoji} *${typeText} cadastrada!*\n📝 ${description}\n💵 R$ ${amount.toFixed(2)}\n📂 ${formattedCategory}`);
    }
    return;
  }

  await sendTelegramMessage(
    chatId,
    parsed.message ||
      'Olá! Posso ajudar com:\n• *Saldo das contas:* "qual meu saldo?" ou /saldo\n• *Faturas do cartão:* "minhas faturas" ou /faturas\n• *Resumo semanal:* "resumo da semana" ou /resumo\n• *Registrar gasto:* "gastei 50 no mercado"'
  );
}

// ─── Main router ───
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/pluggy-proxy/, '');
  if (!path.startsWith('/')) path = '/' + path;

  const segments = path.split('/').filter(Boolean);
  const resource = segments[0] ?? '';
  const actionOrId = segments[1];
  const subPath = segments[2];
  const method = req.method;

  if (resource === 'chatbot') {
    const action = segments[2];

    // Public Telegram webhook — resolve FinanceHub user by telegram_chat_id
    if (segments[1] === 'telegram' && action === 'webhook' && method === 'POST') {
      try {
        const payload = await req.json();
        await handleTelegramWebhook(payload);
      } catch (e) {
        console.error('[telegram-webhook]', e);
      }
      return new Response('ok', { status: 200, headers: CORS });
    }

    if (segments[1] === 'telegram' && action === 'link-token' && method === 'POST') {
      const authHeader = req.headers.get('authorization');
      if (!authHeader) return errorResponse('Missing authorization header', 401);
      const token = authHeader.split(' ')[1];
      if (!token) return errorResponse('Invalid authorization format', 401);

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);

      const { data: { user }, error: authError } = await serviceRoleClient.auth.getUser(token);
      if (authError || !user) return errorResponse('Invalid or expired authentication token', 401);

      const { data: linkToken, error: rpcError } = await serviceRoleClient.rpc('generate_telegram_link_token', { p_user_id: user.id });
      if (rpcError) return errorResponse(`RPC Error: ${rpcError.message}`, 500);
      return jsonResponse({ success: true, token: linkToken });
    }
    return errorResponse(`Route /chatbot/${segments.join('/')} not found`, 404);
  }

  if (resource === 'webhooks' && method === 'POST' && !actionOrId) {
    return jsonResponse({ received: true });
  }

  if (resource === 'health') {
    const configured = Boolean(Deno.env.get('PLUGGY_CLIENT_ID') && Deno.env.get('PLUGGY_CLIENT_SECRET'));
    return jsonResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      pluggyConfigured: configured,
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return errorResponse('Missing authorization header', 401);
  const token = authHeader.split(' ')[1];
  if (!token) return errorResponse('Invalid authorization format', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) return errorResponse('Invalid or expired authentication token', 401);

  let body: unknown = {};
  if (['POST', 'PATCH', 'PUT'].includes(method)) {
    try { body = await req.json(); } catch (_) {}
  }

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('pluggy_item_ids, pluggy_client_id, pluggy_client_secret')
    .eq('id', user.id)
    .maybeSingle();

  let itemIds = asItemIdList(profile?.pluggy_item_ids);

  if (resource === 'items' && actionOrId === 'register' && method === 'POST') {
    const itemIdToRegister = (body as { itemId?: string })?.itemId;
    if (!itemIdToRegister || typeof itemIdToRegister !== 'string') {
      return errorResponse('itemId é obrigatório', 400);
    }

    const newItemIds = Array.from(new Set([...itemIds, itemIdToRegister]));
    const { error: updateErr } = await supabaseClient
      .from('profiles')
      .upsert({ id: user.id, pluggy_item_ids: newItemIds }, { onConflict: 'id' });

    if (updateErr) return errorResponse(`Failed to register item: ${updateErr.message}`, 500);
    return jsonResponse({
      success: true,
      message: 'Item registrado com sucesso no perfil.',
      itemIds: newItemIds,
    });
  }

  // Replace the full set of linked item IDs (used by Settings to paste existing Pluggy connections)
  if (resource === 'items' && actionOrId === 'sync' && method === 'POST') {
    const raw = (body as { itemIds?: unknown })?.itemIds;
    const incoming = Array.isArray(raw)
      ? asItemIdList(raw)
      : typeof raw === 'string'
        ? asItemIdList(
            raw
              .split(/[\s,;]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          )
        : [];

    const uniqueIds = Array.from(new Set(incoming));
    const { error: updateErr } = await supabaseClient
      .from('profiles')
      .upsert({ id: user.id, pluggy_item_ids: uniqueIds }, { onConflict: 'id' });

    if (updateErr) return errorResponse(`Failed to sync items: ${updateErr.message}`, 500);
    itemIds = uniqueIds;
    return jsonResponse({
      success: true,
      message: `${uniqueIds.length} conexão(ões) vinculada(s) ao perfil.`,
      itemIds: uniqueIds,
    });
  }

  const clientId = profile?.pluggy_client_id || Deno.env.get('PLUGGY_CLIENT_ID');
  const clientSecret = profile?.pluggy_client_secret || Deno.env.get('PLUGGY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return errorResponse(
      'Credenciais Pluggy não configuradas. Defina Client ID/Secret em Configurações ou nas variáveis de ambiente da Edge Function.',
      500
    );
  }

  const clientConfig: PluggyClient = {
    clientId,
    clientSecret,
    itemIds,
    userId: user.id,
    supabase: supabaseClient,
  };

  try {
    switch (resource) {
      case 'accounts':     return await handleAccounts(clientConfig, url, actionOrId);
      case 'transactions': return await handleTransactions(clientConfig, url, method, actionOrId);
      case 'investments':  return await handleInvestments(clientConfig, url, actionOrId);
      case 'loans':        return await handleLoans(clientConfig, url, actionOrId);
      case 'bills':        return await handleBills(clientConfig, url, actionOrId, subPath);
      case 'connectors':   return await handleConnectors(clientConfig, url, actionOrId);
      case 'items':        return await handleItems(clientConfig, url, method, body, actionOrId);
      case 'webhooks':     return await handleWebhooks(clientConfig, url, method, body, actionOrId);
      default:             return errorResponse(`Route /${resource} not found`, 404);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(message, 500);
  }
});
