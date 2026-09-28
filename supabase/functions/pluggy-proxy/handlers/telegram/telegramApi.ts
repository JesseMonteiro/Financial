import { asItemIdList, pluggyJson, getPluggyApiKey, PLUGGY_API } from "../pluggy.ts";
import type { TelegramProfile } from "./types.ts";

export function resolvePluggyCredentials(profile: TelegramProfile): { clientId: string; clientSecret: string } | null {
  if (profile.pluggy_client_id && profile.pluggy_client_secret) {
    return { clientId: profile.pluggy_client_id, clientSecret: profile.pluggy_client_secret };
  }
  const envId = Deno.env.get('PLUGGY_CLIENT_ID');
  const envSecret = Deno.env.get('PLUGGY_CLIENT_SECRET');
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };
  return null;
}

/** Prefer the name the user set in Accounts/Cards over Pluggy's raw name. */
export function accountDisplayName(profile: TelegramProfile, account: { id?: string; name?: string }): string {
  const custom = profile.custom_account_names;
  if (custom && account?.id && custom[account.id]) {
    return String(custom[account.id]);
  }
  return account?.name || 'Conta';
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN missing');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn('[telegram] Send with Markdown failed, retrying plain text:', errText);
      const fallbackRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text.replace(/[*_`]/g, '') }),
      });
      return fallbackRes.ok;
    }
    return true;
  } catch (e) {
    console.error('[telegram] sendTelegramMessage error:', e);
    return false;
  }
}

export function escapeTelegramMd(text: string): string {
  if (!text) return '';
  return String(text).replace(/([_*[\]`])/g, '\\$1');
}

export function getCategoryEmojiEdge(category: string): string {
  const c = String(category || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (c.includes('alimenta') || c.includes('comida') || c.includes('restaurante') || c.includes('food') || c.includes('refeic') || c.includes('bar') || c.includes('cafe')) return '🍔';
  if (c.includes('mercado') || c.includes('supermercado') || c.includes('grocer') || c.includes('feira') || c.includes('hortifruti')) return '🛒';
  if (c.includes('transporte') || c.includes('uber') || c.includes('99') || c.includes('combustivel') || c.includes('posto') || c.includes('gasolina') || c.includes('onibus') || c.includes('metro') || c.includes('estacionamento') || c.includes('pedagio')) return '🚗';
  if (c.includes('moradia') || c.includes('habitacao') || c.includes('aluguel') || c.includes('condominio') || c.includes('luz') || c.includes('energia') || c.includes('agua') || c.includes('gas') || c.includes('internet')) return '🏠';
  if (c.includes('saude') || c.includes('farmacia') || c.includes('droga') || c.includes('medico') || c.includes('hospital') || c.includes('consulta') || c.includes('dentista') || c.includes('exame')) return '💊';
  if (c.includes('educacao') || c.includes('curso') || c.includes('escola') || c.includes('faculdade') || c.includes('livr') || c.includes('livro')) return '📚';
  if (c.includes('lazer') || c.includes('cinema') || c.includes('show') || c.includes('viag') || c.includes('hotel') || c.includes('passeio') || c.includes('jogos') || c.includes('game')) return '🎉';
  if (c.includes('servico') || c.includes('assinatura') || c.includes('streaming') || c.includes('netflix') || c.includes('spotify') || c.includes('nuvem')) return '⚡';
  if (c.includes('compra') || c.includes('shopping') || c.includes('shopee') || c.includes('amazon') || c.includes('mercado livre') || c.includes('vestuario') || c.includes('roupa')) return '🛍️';
  if (c.includes('renda') || c.includes('salario') || c.includes('investimento') || c.includes('dividendo') || c.includes('provento') || c.includes('pix')) return '💰';
  if (c.includes('imposto') || c.includes('taxa') || c.includes('tarifa') || c.includes('iof') || c.includes('tributo')) return '🧾';
  if (c.includes('pets') || c.includes('veterinario') || c.includes('racao')) return '🐾';
  return '📂';
}

export function getYesterdayDateInfoEdge(referenceDate = new Date()): { todayStr: string; yesterdayStr: string; displayDate: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = formatter.format(referenceDate);
  const [y, m, d] = todayStr.split('-').map(Number);
  const yesterdayUtc = new Date(Date.UTC(y, m - 1, d - 1));
  const yesterdayStr = yesterdayUtc.toISOString().slice(0, 10);
  const [yy, mm, dd] = yesterdayStr.split('-');
  const displayDate = `${dd}/${mm}/${yy}`;

  return { todayStr, yesterdayStr, displayDate };
}

export async function fetchPluggyAccountsForProfile(profile: TelegramProfile): Promise<Array<{
  name: string;
  balance: number;
  id: string;
  type?: string;
  number?: string;
  owner?: string;
  bankData?: {
    reservedBalances?: Array<{
      name?: string;
      identification?: string;
      availableAmounts?: Array<{ amount?: number }>;
    }>;
  };
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
    owner?: string;
    bankData?: {
      reservedBalances?: Array<{
        name?: string;
        identification?: string;
        availableAmounts?: Array<{ amount?: number }>;
      }>;
    };
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
          owner?: string;
          bankData?: {
            reservedBalances?: Array<{
              name?: string;
              identification?: string;
              availableAmounts?: Array<{ amount?: number }>;
            }>;
          };
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

export function formatMoney(value: number): string {
  return `R$ ${Number(value).toFixed(2)}`;
}

export type ReservedBox = { name: string; amount: number };

export function reservedBalancesFromAccount(acc: {
  bankData?: { reservedBalances?: Array<{
    name?: string;
    identification?: string;
    availableAmounts?: Array<{ amount?: number }>;
  }> };
}): ReservedBox[] {
  const raw = acc?.bankData?.reservedBalances;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const amounts = Array.isArray(item?.availableAmounts) ? item.availableAmounts : [];
      const amount = amounts.reduce((sum, a) => sum + (Number(a?.amount) || 0), 0);
      const name = (item?.name && String(item.name).trim()) || `Caixinha ${index + 1}`;
      return { name, amount };
    })
    .filter((b) => b.amount > 0);
}

export async function fetchPluggyBillsForAccount(
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

export async function fetchAllPluggyTransactionsForAccount(
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
