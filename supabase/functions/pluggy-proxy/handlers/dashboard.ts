/**
 * Dashboard BFF — same aggregations as the web Dashboard page.
 */
import { errorResponse, jsonResponse } from "../middleware/http.ts";
import {
  getPluggyApiKey,
  PLUGGY_API,
  pluggyJson,
  type PluggyClient,
} from "./pluggy.ts";
import {
  buildBudgetCategories,
  buildIncomeExpenseSeries,
  buildInsights,
  buildNetWorthSeries,
  calculateNetWorth,
  currentYm,
  expensesByCategory,
  isIncomeTx,
  monthCashflow,
  monthOverMonth,
  translateCategory,
  weeklyRecap,
} from "../utils/dashboardAnalytics.ts";

async function fetchAccounts(client: PluggyClient): Promise<Record<string, unknown>[]> {
  const chunks = await Promise.all(client.itemIds.map(async (iid) => {
    try {
      const d = await pluggyJson(client, "/accounts", { params: { itemId: iid } }) as {
        results?: Record<string, unknown>[];
      };
      return (d.results || []).map((acc) => ({ ...acc, itemId: acc.itemId || iid }));
    } catch (e) {
      console.error("[dashboard] accounts", iid, e);
      return [] as Record<string, unknown>[];
    }
  }));
  return chunks.flat();
}

async function fetchAllTransactionsForAccount(
  client: PluggyClient,
  accountId: string,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let next: string | null = null;
  let guard = 0;
  const apiKey = await getPluggyApiKey(client.clientId, client.clientSecret);
  do {
    try {
      const url = next
        ? (next.startsWith("http") ? next : `${PLUGGY_API}${next}`)
        : `${PLUGGY_API}/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
      const res = await fetch(url, {
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      });
      if (!res.ok) break;
      const data = await res.json() as {
        results?: Record<string, unknown>[];
        next?: string | null;
      };
      for (const t of data.results || []) {
        results.push({ ...t, accountId: t.accountId || accountId });
      }
      next = data.next || null;
    } catch (e) {
      console.error("[dashboard] txs", accountId, e);
      break;
    }
    guard++;
  } while (next && guard < 30);
  return results;
}

async function fetchInvestments(client: PluggyClient): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (const iid of client.itemIds) {
    try {
      const d = await pluggyJson(client, "/investments", { params: { itemId: iid } }) as {
        results?: Record<string, unknown>[];
      };
      all.push(...(d.results || []));
    } catch {
      /* skip */
    }
  }
  return all;
}

async function fetchLoans(client: PluggyClient): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (const iid of client.itemIds) {
    try {
      const d = await pluggyJson(client, "/loans", { params: { itemId: iid } }) as {
        results?: Record<string, unknown>[];
      };
      all.push(...(d.results || []));
    } catch {
      /* skip */
    }
  }
  return all;
}

function formatRelativeDate(dateStr: string): string {
  const day = String(dateStr).slice(0, 10);
  if (!day) return "";
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestKey = yest.toISOString().slice(0, 10);
  if (day === todayKey) return "Hoje";
  if (day === yestKey) return "Ontem";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

export async function handleDashboard(
  client: PluggyClient,
  url: URL,
): Promise<Response> {
  const ym = url.searchParams.get("month") || currentYm();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return errorResponse("Parâmetro month inválido (YYYY-MM)", 400);
  }

  const [accounts, investments, loans, profileRes, budgetsRes, manualsRes] = await Promise.all([
    fetchAccounts(client),
    fetchInvestments(client),
    fetchLoans(client),
    client.supabase
      .from("profiles")
      .select("display_name, custom_account_names")
      .eq("id", client.userId)
      .maybeSingle(),
    client.supabase.from("budgets").select("*").eq("user_id", client.userId),
    client.supabase.from("manual_transactions").select("*").eq("user_id", client.userId),
  ]);

  // Manual accounts
  const { data: manualAccounts } = await client.supabase
    .from("manual_accounts")
    .select("*")
    .eq("user_id", client.userId);

  for (const row of (manualAccounts || []) as Record<string, unknown>[]) {
    const id = String(row.id || "");
    if (!id) continue;
    const type = row.type === "CREDIT" ? "CREDIT" : "BANK";
    accounts.push({
      id,
      type,
      name: String(row.name || (type === "CREDIT" ? "Cartão manual" : "Conta manual")),
      balance: type === "CREDIT" ? Number(row.bill_amount) || 0 : Number(row.balance) || 0,
      isManual: true,
    });
  }

  const customNames = (profileRes.data?.custom_account_names &&
      typeof profileRes.data.custom_account_names === "object")
    ? profileRes.data.custom_account_names as Record<string, string>
    : {};

  for (const a of accounts) {
    const id = String(a.id || "");
    if (id && customNames[id]) a.name = customNames[id];
  }

  const accountIds = accounts.map((a) => String(a.id)).filter(Boolean);
  const pluggyAccountIds = accountIds.filter((id) => {
    const acc = accounts.find((a) => String(a.id) === id);
    return !acc?.isManual;
  });

  const txChunks = await Promise.all(
    pluggyAccountIds.map((id) => fetchAllTransactionsForAccount(client, id)),
  );
  const pluggyTxs = txChunks.flat();

  const manualTxs = ((manualsRes.data || []) as Record<string, unknown>[]).map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount,
    date: row.date,
    category: row.category,
    accountId: row.account_id || "manual",
    type: Number(row.amount) >= 0 ? "CREDIT" : "DEBIT",
    isManual: true,
  }));

  const transactions = [...pluggyTxs, ...manualTxs].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );

  const summary = calculateNetWorth(accounts, investments, loans);
  const cashflow = monthCashflow(transactions, ym);
  const mom = monthOverMonth(transactions, ym);
  const recap = weeklyRecap(transactions);
  const insights = buildInsights(transactions, ym);
  const netWorthSeries = buildNetWorthSeries(transactions, accounts, investments, loans, 6, ym);
  const incomeExpenseSeries = buildIncomeExpenseSeries(transactions, 6, ym);
  const categoryExpenses = expensesByCategory(transactions, { limit: 7, ym });

  const budgets = ((budgetsRes.data || []) as Record<string, unknown>[]).map((b) => ({
    category: String(b.category || ""),
    limit: Number(b.limit) || 0,
  }));
  const budgetCategories = buildBudgetCategories(transactions, budgets, ym);

  const bankCount = accounts.filter((a) => String(a.type).toUpperCase() === "BANK").length;
  const creditCount = accounts.filter((a) => String(a.type).toUpperCase() === "CREDIT").length;

  const displayName = String(
    profileRes.data?.display_name || "usuário",
  ).trim() || "usuário";

  const recentTransactions = transactions.slice(0, 5).map((tx) => {
    const amount = Number(tx.amount) || 0;
    const isCredit = isIncomeTx(tx) || amount > 0;
    return {
      id: String(tx.id || `${tx.accountId}-${tx.date}-${amount}`),
      description: String(tx.description || "Lançamento"),
      category: translateCategory(tx.category),
      date: String(tx.date || "").slice(0, 10),
      dateRelative: formatRelativeDate(String(tx.date || "")),
      amount: Math.abs(amount),
      isCredit,
      isPending: String(tx.status || "").toUpperCase() === "PENDING",
    };
  });

  return jsonResponse({
    displayName,
    selectedMonth: ym,
    summary: {
      netWorth: Number(summary.netWorth.toFixed(2)),
      bankBalance: Number(summary.bankBalance.toFixed(2)),
      reservedBalance: Number(summary.reservedBalance.toFixed(2)),
      investmentTotal: Number(summary.investmentTotal.toFixed(2)),
      creditDebt: Number(summary.creditDebt.toFixed(2)),
      loansTotal: Number(summary.loansTotal.toFixed(2)),
      totalAssets: Number(summary.totalAssets.toFixed(2)),
      bankCount,
      creditCount,
    },
    cashflow: {
      income: cashflow.income,
      expense: cashflow.expense,
      net: cashflow.net,
      savingsRate: cashflow.savingsRate,
    },
    monthOverMonth: {
      expenseDeltaPct: mom.expenseDeltaPct,
      currentExpense: mom.current.expense,
      previousExpense: mom.previous.expense,
    },
    netWorthSeries,
    incomeExpenseSeries,
    categoryExpenses,
    insights,
    weeklyRecap: {
      total: recap.current.total,
      deltaPct: recap.deltaPct,
      topCategory: recap.current.topCategory,
    },
    recentTransactions,
    budgetCategories,
  });
}
