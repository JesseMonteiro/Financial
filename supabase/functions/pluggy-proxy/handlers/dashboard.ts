/**
 * Dashboard BFF — same aggregations as the web Dashboard page.
 */
import { errorResponse, jsonResponse } from "../middleware/http.ts";
import { pluggyJson, type PluggyClient } from "./pluggy.ts";
import {
  buildIncomeExpenseSeries,
  buildInsights,
  buildNetWorthSeries,
  calculateNetWorth,
  currentYm,
  buildDailySpend,
  buildRecentCreditPurchases,
  buildRecentExecutedTransactions,
  expensesByCategory,
  monthCashflow,
  monthOverMonth,
  translateCategory,
  weeklyRecap,
} from "../utils/dashboardAnalytics.ts";
import { mergeInvestmentsWithReserved } from "../utils/reservedBalances.ts";
import { enrichAccounts, sumOpenBillsTotal } from "../utils/accountValues.ts";
import { hydrateManualAccount } from "../utils/manualAccounts.ts";
import {
  fetchAccountsWithConnectors,
  fetchAllTransactionsForAccount,
  loadCreditLedger,
} from "../utils/creditLedger.ts";
import { buildBudgetRows } from "../utils/budgetSpent.ts";

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

  const [pluggyAccounts, investmentsRaw, loans, profileRes, budgetsRes, manualsRes, manualAccountsRes, mealBenefitsRes, mealPurchasesRes] =
    await Promise.all([
      fetchAccountsWithConnectors(client),
      fetchInvestments(client),
      fetchLoans(client),
      client.supabase
        .from("profiles")
        .select("display_name, custom_account_names")
        .eq("id", client.userId)
        .maybeSingle(),
      client.supabase.from("budgets").select("*").eq("user_id", client.userId),
      client.supabase.from("manual_transactions").select("*").eq("user_id", client.userId),
      client.supabase.from("manual_accounts").select("*").eq("user_id", client.userId),
      client.supabase.from("meal_benefits").select("*").eq("user_id", client.userId),
      client.supabase.from("meal_benefit_purchases").select("*").eq("user_id", client.userId),
    ]);

  const accounts = [...pluggyAccounts];
  for (const row of (manualAccountsRes.data || []) as Record<string, unknown>[]) {
    accounts.push(hydrateManualAccount(row));
  }

  const customNames = (profileRes.data?.custom_account_names &&
      typeof profileRes.data.custom_account_names === "object")
    ? profileRes.data.custom_account_names as Record<string, string>
    : {};

  for (const a of accounts) {
    const id = String(a.id || "");
    if (id && customNames[id]) a.name = customNames[id];
  }

  const creditCards = accounts.filter((a) => String(a.type).toUpperCase() === "CREDIT");
  const { transactionsByAccount, billsByAccount } = await loadCreditLedger(client, creditCards);
  const enriched = enrichAccounts(accounts, transactionsByAccount, billsByAccount);

  const investments = mergeInvestmentsWithReserved(investmentsRaw, enriched);

  const pluggyAccountIds = pluggyAccounts.map((a) => String(a.id)).filter(Boolean);
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

  const summary = calculateNetWorth(enriched, investments, loans);
  const cashflow = monthCashflow(transactions, ym);
  const mom = monthOverMonth(transactions, ym);
  const recap = weeklyRecap(transactions);
  const insights = buildInsights(transactions, ym);
  const netWorthSeries = buildNetWorthSeries(transactions, enriched, investments, loans, 6, ym);
  const incomeExpenseSeries = buildIncomeExpenseSeries(transactions, 6, ym);
  const categoryExpenses = expensesByCategory(transactions, { limit: 7, ym });
  const creditAccountIds = new Set(
    creditCards.map((c) => String(c.id || "")).filter(Boolean),
  );
  const dailySpend = buildDailySpend(transactions, 30, new Date(), creditAccountIds);

  const budgets = ((budgetsRes.data || []) as Record<string, unknown>[]).map((b) => ({
    id: String(b.id || ""),
    category: String(b.category || ""),
    limit: Number(b.limit) || 0,
    period: String(b.period || "monthly"),
  }));
  const officialBills = Object.values(billsByAccount).flat();
  const creditIds = new Set(creditCards.map((c) => String(c.id)));
  const budgetRows = buildBudgetRows(
    transactions,
    budgets,
    ym,
    officialBills,
    creditIds,
    mealBenefitsRes.data || [],
    mealPurchasesRes.data || [],
  );
  const budgetCategories = budgetRows
    .filter((r) => r.spent > 0 || r.hasLimit)
    .slice(0, 6)
    .map((r) => ({
      category: r.category,
      spent: r.spent,
      limit: r.hasLimit ? r.limit : Math.max(1000, Math.ceil(r.spent * 1.25)),
      percent: r.percent,
      color: null as string | null,
    }));

  const bankCount = enriched.filter((a) => String(a.type).toUpperCase() === "BANK").length;
  const creditCount = creditCards.length;
  const openBillsTotal = sumOpenBillsTotal(enriched);

  const displayName = String(
    profileRes.data?.display_name || "usuário",
  ).trim() || "usuário";

  const recentTransactions = buildRecentExecutedTransactions(transactions, {
    limit: 5,
    formatRelativeDate,
    translateCategory,
  });

  const accountNameById = new Map(
    creditCards.map((c) => [String(c.id || ""), String(c.name || "Cartão")]),
  );
  const recentCreditPurchases = buildRecentCreditPurchases(
    transactions,
    creditAccountIds,
    {
      days: 15,
      limit: 24,
      accountNameById,
      formatRelativeDate,
      translateCategory,
    },
  );

  return jsonResponse({
    displayName,
    selectedMonth: ym,
    summary: {
      netWorth: Number(summary.netWorth.toFixed(2)),
      bankBalance: Number(summary.bankBalance.toFixed(2)),
      reservedBalance: Number(summary.reservedBalance.toFixed(2)),
      investmentTotal: Number(summary.investmentTotal.toFixed(2)),
      creditDebt: Number(summary.creditDebt.toFixed(2)),
      openBillsTotal: Number(openBillsTotal.toFixed(2)),
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
    recentCreditPurchases,
    dailySpend,
    budgetCategories,
  });
}
