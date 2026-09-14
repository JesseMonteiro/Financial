/**
 * Recurring merchant detection — port of src/utils/subscriptions.js (core).
 */
import { jsonResponse } from "../middleware/http.ts";
import { isBillPayment } from "../creditBillPeriod.ts";
import { translateCategory } from "../utils/dashboardAnalytics.ts";
import { type PluggyClient } from "./pluggy.ts";
import {
  fetchAccountsWithConnectors,
  fetchAllTransactionsForAccount,
  loadManualTransactions,
} from "../utils/creditLedger.ts";

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

function normalize(text: unknown): string {
  return String(text || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function merchantName(tx: AnyRec): string {
  return (
    tx?.merchant?.businessName ||
    tx?.merchant?.name ||
    tx?.originalDescription ||
    tx?.description ||
    "Desconhecido"
  );
}

function isExpense(tx: AnyRec): boolean {
  if (!tx || isBillPayment(tx)) return false;
  if (tx.type === "CREDIT" || tx.type === "CREDIT_INCOME") return false;
  return Number(tx.amount) < 0 || tx.type === "DEBIT";
}

export function detectSubscriptions(transactions: AnyRec[] = [], minOccurrences = 3) {
  const groups: Record<string, AnyRec[]> = {};
  for (const t of transactions) {
    if (!isExpense(t)) continue;
    const key = normalize(merchantName(t)).slice(0, 24);
    if (key.length < 4) continue;
    (groups[key] ||= []).push(t);
  }
  const results: AnyRec[] = [];
  for (const [key, txs] of Object.entries(groups)) {
    if (txs.length < minOccurrences) continue;
    const amounts = txs.map((t) => Math.abs(Number(t.amount) || 0)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const dates = txs
      .map((t) => new Date(String(t.date)))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length < 2) continue;
    const last = dates[dates.length - 1];
    const sample = txs[txs.length - 1];
    results.push({
      id: key,
      name: merchantName(sample),
      amount: Number(median.toFixed(2)),
      billingDay: last.getDate(),
      category: translateCategory(sample.category),
      isActive: true,
      occurrences: txs.length,
    });
  }
  return results.sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
}

export async function handleSubscriptions(client: PluggyClient): Promise<Response> {
  const [accounts, manuals] = await Promise.all([
    fetchAccountsWithConnectors(client),
    loadManualTransactions(client),
  ]);
  const pluggyTxs = (await Promise.all(
    accounts.map((a) => fetchAllTransactionsForAccount(client, String(a.id))),
  )).flat();
  const recurringManuals = manuals.filter((t) => t.isManual);
  const items = detectSubscriptions([...pluggyTxs, ...recurringManuals]);
  return jsonResponse({ items });
}
