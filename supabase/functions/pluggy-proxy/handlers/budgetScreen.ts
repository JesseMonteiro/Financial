/**
 * Budget spent for a month — same due-month + isBillPayment rules as web Budget.jsx.
 */
import { errorResponse, jsonResponse } from "../middleware/http.ts";
import { type PluggyClient } from "./pluggy.ts";
import { hydrateManualAccount } from "../utils/manualAccounts.ts";
import {
  fetchAccountsWithConnectors,
  fetchAllTransactionsForAccount,
  loadCreditLedger,
  loadManualTransactions,
} from "../utils/creditLedger.ts";
import { buildBudgetRows } from "../utils/budgetSpent.ts";

export async function handleBudgetScreen(client: PluggyClient, url: URL): Promise<Response> {
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse("Parâmetro month obrigatório no formato YYYY-MM", 400);
  }

  const [
    pluggyAccounts,
    manuals,
    budgetsRes,
    manualAccountsRes,
    mealBenefitsRes,
    mealPurchasesRes,
  ] = await Promise.all([
    fetchAccountsWithConnectors(client),
    loadManualTransactions(client),
    client.supabase.from("budgets").select("*").eq("user_id", client.userId),
    client.supabase.from("manual_accounts").select("*").eq("user_id", client.userId),
    client.supabase.from("meal_benefits").select("*").eq("user_id", client.userId),
    client.supabase.from("meal_benefit_purchases").select("*").eq("user_id", client.userId),
  ]);

  const accounts = [
    ...pluggyAccounts,
    ...((manualAccountsRes.data || []) as Record<string, unknown>[]).map((row) =>
      hydrateManualAccount(row)
    ),
  ];
  const creditCards = accounts.filter((a) => String(a.type).toUpperCase() === "CREDIT");
  const { billsByAccount } = await loadCreditLedger(client, creditCards);

  const pluggyTxs = (await Promise.all(
    pluggyAccounts.map((a) => fetchAllTransactionsForAccount(client, String(a.id))),
  )).flat();
  const transactions = [...pluggyTxs, ...manuals];
  const officialBills = Object.values(billsByAccount).flat();
  const creditIds = new Set(creditCards.map((c) => String(c.id)));
  const budgets = ((budgetsRes.data || []) as Record<string, unknown>[]).map((b) => ({
    id: String(b.id || ""),
    category: String(b.category || ""),
    limit: Number(b.limit) || 0,
    period: String(b.period || "monthly"),
  }));
  const rows = buildBudgetRows(
    transactions,
    budgets,
    month,
    officialBills,
    creditIds,
    mealBenefitsRes.data || [],
    mealPurchasesRes.data || [],
    undefined,
    accounts,
  );
  return jsonResponse({ month, categories: rows });
}
