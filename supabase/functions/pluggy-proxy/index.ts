// Pluggy Proxy — Supabase Edge Function
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const PLUGGY_API = 'https://api.pluggy.ai';

// ─── In-memory token cache ───
interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

// ─── CORS ───
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
  return jsonResponse({ error: message }, status);
}

interface PluggyClient {
  clientId: string;
  clientSecret: string;
  itemIds: string[];
}

async function getPluggyApiKey(client: PluggyClient): Promise<string> {
  const { clientId, clientSecret } = client;
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
  client: PluggyClient,
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string | undefined> } = {}
): Promise<Response> {
  const apiKey = await getPluggyApiKey(client);
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
  client: PluggyClient,
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

async function handleAccounts(client: PluggyClient, url: URL, id?: string): Promise<Response> {
  if (id) return jsonResponse(await pluggyJson(client, `/accounts/${id}`));
  const itemId = url.searchParams.get('itemId');
  const type = url.searchParams.get('type') ?? undefined;
  let targetItemIds = itemId ? (client.itemIds.includes(itemId) ? [itemId] : []) : client.itemIds;
  if (itemId && targetItemIds.length === 0) return errorResponse('Acesso negado para este item ID', 403);
  if (targetItemIds.length === 0) return jsonResponse({ results: [], total: 0 });
  
  const all: unknown[] = [];
  for (const iid of targetItemIds) {
    try {
      const params: Record<string, string | undefined> = { itemId: iid };
      if (type) params.type = type;
      const d = await pluggyJson(client, '/accounts', { params }) as { results?: unknown[] };
      all.push(...(d.results || []));
    } catch (_) {}
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
  let targetItemIds = itemId ? (client.itemIds.includes(itemId) ? [itemId] : []) : client.itemIds;
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
  let targetItemIds = itemId ? (client.itemIds.includes(itemId) ? [itemId] : []) : client.itemIds;
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

async function handleItems(client: PluggyClient, url: URL, method: string, body: unknown, idOrAction?: string): Promise<Response> {
  if (idOrAction === 'connect-token' && method === 'POST') {
    const itemId = (body as { itemId?: string })?.itemId;
    return jsonResponse(await pluggyJson(client, '/connect_token', { method: 'POST', body: itemId ? { itemId } : {} }));
  }
  if (idOrAction === 'register') {
    return errorResponse('Use internal register logic', 400); 
  }
  const id = idOrAction;
  if (id && method === 'PATCH') {
    if (!client.itemIds.includes(id)) return errorResponse('Acesso negado', 403);
    return jsonResponse(await pluggyJson(client, `/items/${id}`, { method: 'PATCH', body }));
  }
  if (id && method === 'DELETE') {
    if (!client.itemIds.includes(id)) return errorResponse('Acesso negado', 403);
    await pluggyFetch(client, `/items/${id}`, { method: 'DELETE' });
    return jsonResponse({ success: true, message: 'Conexão removida com sucesso' });
  }
  if (id) {
    if (!client.itemIds.includes(id)) return errorResponse('Acesso negado', 403);
    return jsonResponse(await pluggyJson(client, `/items/${id}`));
  }
  const itemIds = client.itemIds;
  if (itemIds.length === 0) return jsonResponse({ results: [], total: 0 });
  const results: unknown[] = [];
  for (const iid of itemIds) {
    try {
      const d = await pluggyJson(client, `/items/${iid}`);
      results.push(d);
    } catch (_) {}
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
    return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
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

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('pluggy_item_ids, pluggy_client_id, pluggy_client_secret')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) return errorResponse(`Profile fetch error: ${profileError.message}`, 500);
  const itemIds = profile?.pluggy_item_ids || [];
  
  if (resource === 'items' && actionOrId === 'register' && method === 'POST') {
    const itemIdToRegister = (body as { itemId?: string })?.itemId;
    if (!itemIdToRegister) return errorResponse('itemId é obrigatório', 400);

    const newItemIds = Array.from(new Set([...itemIds, itemIdToRegister]));
    const { error: updateErr } = await supabaseClient
      .from('profiles')
      .update({ pluggy_item_ids: newItemIds })
      .eq('id', user.id);

    if (updateErr) return errorResponse(`Failed to register item: ${updateErr.message}`, 500);
    return jsonResponse({ success: true, message: 'Item registrado com sucesso no perfil.' });
  }

  const clientId = profile?.pluggy_client_id || Deno.env.get('PLUGGY_CLIENT_ID');
  const clientSecret = profile?.pluggy_client_secret || Deno.env.get('PLUGGY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return errorResponse('PLUGGY_CLIENT_ID or PLUGGY_CLIENT_SECRET not configured for this user or globally', 500);
  }
  const clientConfig: PluggyClient = { clientId, clientSecret, itemIds };

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