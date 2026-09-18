/**
 * Shared Pluggy credit-ledger loaders used by accounts, cards, dashboard, agenda.
 */
import {
  getPluggyApiKey,
  PLUGGY_API,
  pluggyJson,
  type PluggyClient,
} from "../handlers/pluggy.ts";
import { hydrateManualAccount, syntheticManualBill } from "./manualAccounts.ts";

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

export async function fetchAccountsWithConnectors(
  client: PluggyClient,
  opts: { includeConnectors?: boolean } = {},
): Promise<AnyRec[]> {
  const includeConnectors = opts.includeConnectors !== false;
  const chunks = await Promise.all(client.itemIds.map(async (iid) => {
    try {
      const accountsPromise = pluggyJson(client, "/accounts", { params: { itemId: iid } }) as Promise<{
        results?: AnyRec[];
      }>;
      const itemPromise = includeConnectors
        ? pluggyJson(client, `/items/${iid}`).catch(() => null) as Promise<{
          connector?: { name?: string; id?: number | string };
        } | null>
        : Promise.resolve(null);
      const [d, item] = await Promise.all([accountsPromise, itemPromise]);
      const connectorName = item?.connector?.name ? String(item.connector.name) : "";
      const connectorId = item?.connector?.id;
      return (d.results || []).map((acc) => ({
        ...acc,
        itemId: acc.itemId || iid,
        _connector: connectorName,
        _connectorId: connectorId,
      }));
    } catch (e) {
      console.error("[credit-ledger] accounts", iid, e);
      return [] as AnyRec[];
    }
  }));
  return chunks.flat();
}

export async function fetchBillsForAccount(
  client: PluggyClient,
  accountId: string,
): Promise<AnyRec[]> {
  try {
    const d = await pluggyJson(client, "/bills", { params: { accountId } }) as {
      results?: AnyRec[];
    };
    return (d.results || []).map((b) => ({ ...b, accountId: b.accountId || accountId }));
  } catch (e) {
    console.error("[credit-ledger] bills", accountId, e);
    return [];
  }
}

export async function fetchAllTransactionsForAccount(
  client: PluggyClient,
  accountId: string,
  opts: { maxPages?: number } = {},
): Promise<AnyRec[]> {
  const maxPages = Math.max(1, Math.min(30, opts.maxPages ?? 30));
  const results: AnyRec[] = [];
  let next: string | null = null;
  let guard = 0;
  const apiKey = await getPluggyApiKey(client.clientId, client.clientSecret);
  do {
    try {
      const url = next
        ? (next.startsWith("http") ? next : `${PLUGGY_API}${next}`)
        : `${PLUGGY_API}/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
      const res = await fetch(url, { headers: { "X-API-KEY": apiKey, Accept: "application/json" } });
      if (!res.ok) break;
      const data = await res.json() as { results?: AnyRec[]; next?: string | null };
      for (const t of data.results || []) {
        results.push({ ...t, accountId: t.accountId || accountId });
      }
      next = data.next || null;
    } catch (e) {
      console.error("[credit-ledger] txs", accountId, e);
      break;
    }
    guard++;
  } while (next && guard < maxPages);
  return results;
}

export async function loadCreditLedger(
  client: PluggyClient,
  creditCards: AnyRec[],
  opts: { maxPages?: number } = {},
): Promise<{
  transactionsByAccount: Record<string, AnyRec[]>;
  billsByAccount: Record<string, AnyRec[]>;
}> {
  const transactionsByAccount: Record<string, AnyRec[]> = {};
  const billsByAccount: Record<string, AnyRec[]> = {};
  await Promise.all(creditCards.map(async (card) => {
    const id = String(card.id || "");
    if (!id) return;
    if (card.isManual) {
      transactionsByAccount[id] = [];
      const bill = syntheticManualBill(card);
      billsByAccount[id] = bill ? [bill] : [];
      return;
    }
    const [txs, bills] = await Promise.all([
      fetchAllTransactionsForAccount(client, id, opts),
      fetchBillsForAccount(client, id),
    ]);
    transactionsByAccount[id] = txs;
    billsByAccount[id] = bills;
  }));
  return { transactionsByAccount, billsByAccount };
}

export async function loadManualAccounts(client: PluggyClient): Promise<AnyRec[]> {
  const { data } = await client.supabase
    .from("manual_accounts")
    .select("*")
    .eq("user_id", client.userId);
  return ((data || []) as AnyRec[]).map((row) => hydrateManualAccount(row));
}

export async function loadManualTransactions(client: PluggyClient): Promise<AnyRec[]> {
  const { data } = await client.supabase
    .from("manual_transactions")
    .select("*")
    .eq("user_id", client.userId);
  return ((data || []) as AnyRec[]).map((row) => ({
    id: row.id,
    description: row.description,
    originalDescription: row.original_description || row.description,
    amount: row.amount,
    date: row.date,
    category: row.category,
    accountId: row.account_id || "manual",
    type: Number(row.amount) >= 0 ? "CREDIT" : "DEBIT",
    isManual: true,
    isPaid: Boolean(row.is_paid || row.paid_at),
    paidAt: row.paid_at || null,
    status: "POSTED",
  }));
}

export async function loadCustomNames(client: PluggyClient): Promise<Record<string, string>> {
  const { data } = await client.supabase
    .from("profiles")
    .select("custom_account_names")
    .eq("id", client.userId)
    .maybeSingle();
  const raw = data?.custom_account_names;
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && String(v).trim())
      .map(([k, v]) => [k, String(v)]),
  );
}
