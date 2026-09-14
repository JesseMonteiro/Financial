/**
 * Reports aggregations — web analytics.js (exclude bill payments).
 */
import { errorResponse, jsonResponse } from "../middleware/http.ts";
import { type PluggyClient } from "./pluggy.ts";
import {
  buildIncomeExpenseSeries,
  currentYm,
  expensesByCategory,
  isExpenseTx,
  isIncomeTx,
  lastNMonths,
  monthCashflow,
} from "../utils/dashboardAnalytics.ts";
import {
  fetchAccountsWithConnectors,
  fetchAllTransactionsForAccount,
  loadManualTransactions,
} from "../utils/creditLedger.ts";

export async function handleReports(client: PluggyClient, url: URL): Promise<Response> {
  const months = Math.min(12, Math.max(3, Number(url.searchParams.get("months") || 6) || 6));
  const accountId = url.searchParams.get("accountId") || "";
  const ym = currentYm();

  const [pluggyAccounts, manuals] = await Promise.all([
    fetchAccountsWithConnectors(client),
    loadManualTransactions(client),
  ]);
  const targets = accountId
    ? pluggyAccounts.filter((a) => String(a.id) === accountId)
    : pluggyAccounts;
  const pluggyTxs = (await Promise.all(
    targets.map((a) => fetchAllTransactionsForAccount(client, String(a.id))),
  )).flat();
  const fromYm = lastNMonths(months, ym)[0];
  const transactions = [...pluggyTxs, ...manuals].filter((t) => {
    if (accountId && String(t.accountId) !== accountId && !t.isManual) return false;
    const tYm = String(t.date || "").slice(0, 7);
    return tYm >= fromYm && tYm <= ym;
  });

  let income = 0;
  let expense = 0;
  transactions.forEach((t) => {
    if (isIncomeTx(t)) income += Math.abs(Number(t.amount) || 0);
    else if (isExpenseTx(t)) expense += Math.abs(Number(t.amount) || 0);
  });
  const cashflow = monthCashflow(transactions, ym);
  const incomeExpenseSeries = buildIncomeExpenseSeries(transactions, months, ym);
  const categories = expensesByCategory(transactions, { limit: 20 });

  return jsonResponse({
    months,
    selectedMonth: ym,
    income: Number(income.toFixed(2)),
    expense: Number(expense.toFixed(2)),
    cashflow,
    incomeExpenseSeries,
    categories,
    accounts: pluggyAccounts.map((a) => ({
      id: String(a.id),
      name: String(a.marketingName || a.name || "Conta"),
      type: String(a.type || "BANK"),
    })),
  });
}
