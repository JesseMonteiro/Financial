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
  budgets: { id?: string; category: string; limit: number }[] = [],
  ym: string,
  officialBills: AnyRec[] = [],
  creditAccountIds: Set<string> = new Set(),
) {
  const spentMap = spendingByCategoryForMonth(
    transactions,
    ym,
    officialBills,
    creditAccountIds,
  );
  const rows: Record<string, {
    id: string;
    category: string;
    spent: number;
    limit: number;
    hasLimit: boolean;
  }> = {};

  Object.entries(spentMap).forEach(([cat, spent]) => {
    rows[cat] = { id: cat, category: cat, spent, limit: 0, hasLimit: false };
  });
  budgets.forEach((b) => {
    const cat = String(b.category || "");
    if (!cat) return;
    if (rows[cat]) {
      rows[cat].id = String(b.id || cat);
      rows[cat].limit = Number(b.limit) || 0;
      rows[cat].hasLimit = true;
    } else {
      rows[cat] = {
        id: String(b.id || cat),
        category: cat,
        spent: 0,
        limit: Number(b.limit) || 0,
        hasLimit: true,
      };
    }
  });

  return Object.values(rows)
    .map((row) => ({
      ...row,
      spent: Number(row.spent.toFixed(2)),
      percent: row.limit > 0 ? Math.min(100, Math.round((row.spent / row.limit) * 100)) : 0,
    }))
    .sort((a, b) => {
      const aOver = a.hasLimit && a.spent > a.limit;
      const bOver = b.hasLimit && b.spent > b.limit;
      if (aOver !== bOver) return aOver ? -1 : 1;
      return b.spent - a.spent;
    });
}
