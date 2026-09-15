/**
 * Budget spent by category — web Budget.jsx rules:
 * card txs indexed by due month, bank by calendar month, exclude bill payments.
 */
import {
  getDueMonthKey,
  inferForecastToDueOffset,
  isBillPayment,
} from "../creditBillPeriod.ts";
import { translateCategory } from "./dashboardAnalytics.ts";
import { asOfForBudgetMonth, mergeBudgetRows, type BudgetInput } from "./budgetPeriod.ts";
import { mealSpendByCategory } from "./mealBenefits.ts";

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

export function txDueMonth(
  tx: AnyRec,
  officialBills: AnyRec[] = [],
  creditAccountIds: Set<string> = new Set(),
): string {
  const accountId = String(tx.accountId || "");
  const isCard = Boolean(tx.creditCardMetadata) || creditAccountIds.has(accountId) ||
    officialBills.some((b) => String(b.accountId || b.account_id) === accountId);
  if (isCard) {
    const cardBills = officialBills.filter(
      (b) => String(b.accountId || b.account_id) === accountId,
    );
    const offset = inferForecastToDueOffset(
      [],
      cardBills.length ? cardBills : officialBills,
    );
    return getDueMonthKey(tx, cardBills.length ? cardBills : officialBills, offset);
  }
  return String(tx.date || "").slice(0, 7);
}

export function spendingByCategoryForMonth(
  transactions: AnyRec[] = [],
  ym: string,
  officialBills: AnyRec[] = [],
  creditAccountIds: Set<string> = new Set(),
): Record<string, number> {
  const map: Record<string, number> = {};
  transactions.forEach((tx) => {
    if (isBillPayment(tx)) return;
    if (Number(tx.amount) > 0) return;
    const txMonth = txDueMonth(tx, officialBills, creditAccountIds);
    if (txMonth !== ym) return;
    const label = translateCategory(tx.category);
    map[label] = (map[label] || 0) + Math.abs(Number(tx.amount) || 0);
  });
  return map;
}

export function buildBudgetRows(
  transactions: AnyRec[] = [],
  budgets: BudgetInput[] = [],
  ym: string,
  officialBills: AnyRec[] = [],
  creditAccountIds: Set<string> = new Set(),
  mealBenefits: AnyRec[] = [],
  mealPurchases: AnyRec[] = [],
  asOfDate?: string,
) {
  const spentBankMap = spendingByCategoryForMonth(
    transactions,
    ym,
    officialBills,
    creditAccountIds,
  );
  const spentMealMap = mealSpendByCategory(mealBenefits, mealPurchases, ym);
  return mergeBudgetRows({
    spentBankMap,
    spentMealMap,
    budgets,
    ym,
    asOfDate: asOfDate || asOfForBudgetMonth(ym),
  });
}
