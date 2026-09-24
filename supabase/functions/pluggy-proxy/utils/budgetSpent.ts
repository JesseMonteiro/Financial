/**
 * Budget spent by category — web Budget.jsx rules:
 * card txs indexed by due month, bank by calendar month, exclude bill payments.
 */
import {
  getDueMonthKey,
  inferForecastToDueOffset,
  isBillPayment,
  signedTxAmount,
} from "../creditBillPeriod.ts";
import { translateCategory } from "./dashboardAnalytics.ts";
import {
  asOfForBudgetMonth,
  canonicalBudgetCategory,
  isSubcategory,
  mergeBudgetRows,
  resolveBudgetCategoryKey,
  BASE_KEY_TO_LABEL,
  type BudgetInput,
  type BudgetTransactionRow,
} from "./budgetPeriod.ts";
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
  accounts: AnyRec[] = [],
): {
  byKey: Record<string, number>;
  subSpend: Record<string, Record<string, number>>;
  txsByKey: Record<string, BudgetTransactionRow[]>;
} {
  const byKey: Record<string, number> = {};
  const subSpend: Record<string, Record<string, number>> = {};
  const txsByKey: Record<string, BudgetTransactionRow[]> = {};
  const accountsById: Record<string, AnyRec> = {};
  accounts.forEach((a) => {
    if (a?.id) accountsById[String(a.id)] = a;
  });

  transactions.forEach((tx) => {
    if (isBillPayment(tx)) return;
    const signed = signedTxAmount(tx);
    if (signed <= 0) return;
    // Uses purchase date (calendar month), aligning with budget week/day periods and web Budget.jsx
    const txMonth = String(tx.date || "").slice(0, 7);
    if (txMonth !== ym) return;
    const raw = String(tx.category || "");
    const baseKey = resolveBudgetCategoryKey(raw);
    byKey[baseKey] = (byKey[baseKey] || 0) + signed;

    const canonicalSub = canonicalBudgetCategory(raw);
    if (isSubcategory(canonicalSub)) {
      byKey[canonicalSub] = (byKey[canonicalSub] || 0) + signed;
    }

    const subLabel = translateCategory(raw);
    const baseLabel = BASE_KEY_TO_LABEL[baseKey] || baseKey;
    if (subLabel && subLabel !== baseLabel && subLabel !== baseKey) {
      if (!subSpend[baseKey]) subSpend[baseKey] = {};
      subSpend[baseKey][subLabel] = (subSpend[baseKey][subLabel] || 0) + signed;
    }

    if (!txsByKey[baseKey]) txsByKey[baseKey] = [];
    const acc = accountsById[String(tx.accountId || "")];
    const accountName = acc?.name || acc?.marketingName || "Conta";
    const item: BudgetTransactionRow = {
      id: String(tx.id || ""),
      description: String(tx.description || tx.descriptionTranslated || tx.descriptionRaw || "Sem descrição"),
      date: String(tx.date || "").slice(0, 10),
      amount: Number(signed.toFixed(2)),
      isMeal: false,
      accountName,
      subCategoryLabel: subLabel,
    };
    txsByKey[baseKey].push(item);
    if (isSubcategory(canonicalSub)) {
      if (!txsByKey[canonicalSub]) txsByKey[canonicalSub] = [];
      txsByKey[canonicalSub].push(item);
    }
  });
  return { byKey, subSpend, txsByKey };
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
  accounts: AnyRec[] = [],
) {
  const { byKey: spentBankMap, subSpend, txsByKey } = spendingByCategoryForMonth(
    transactions,
    ym,
    officialBills,
    creditAccountIds,
    accounts,
  );

  const rawMealMap = mealSpendByCategory(mealBenefits, mealPurchases, ym);
  const spentMealMap: Record<string, number> = {};
  const benefitsById: Record<string, AnyRec> = {};
  mealBenefits.forEach((b) => {
    if (b?.id) benefitsById[String(b.id)] = b;
  });

  Object.entries(rawMealMap).forEach(([cat, amount]) => {
    const amt = Number(amount || 0);
    const baseKey = resolveBudgetCategoryKey(cat);
    spentMealMap[baseKey] = (spentMealMap[baseKey] || 0) + amt;
    const canonicalSub = canonicalBudgetCategory(cat);
    if (isSubcategory(canonicalSub)) {
      spentMealMap[canonicalSub] = (spentMealMap[canonicalSub] || 0) + amt;
    }
    const subLabel = translateCategory(cat);
    const baseLabel = BASE_KEY_TO_LABEL[baseKey] || baseKey;
    if (subLabel && subLabel !== baseLabel && subLabel !== baseKey) {
      if (!subSpend[baseKey]) subSpend[baseKey] = {};
      subSpend[baseKey][subLabel] = (subSpend[baseKey][subLabel] || 0) + amt;
    }
  });

  // Collect meal purchase transaction rows
  mealPurchases.forEach((p) => {
    const pDate = String(p.purchasedAt || p.date || "");
    if (!pDate.slice(0, 7).startsWith(ym)) return;
    const benefit = benefitsById[String(p.benefitId || "")];
    const rawCategory = String(p.category || (benefit?.kind === "VR" ? "Restaurantes & Bares" : "Supermercado & Alimentação"));
    const baseKey = resolveBudgetCategoryKey(rawCategory);
    const canonicalSub = canonicalBudgetCategory(rawCategory);
    if (!txsByKey[baseKey]) txsByKey[baseKey] = [];
    const subLabel = translateCategory(rawCategory);
    const accountName = benefit?.label || (benefit?.kind === "VR" ? "VR" : "VA");
    const item: BudgetTransactionRow = {
      id: String(p.id || ""),
      description: String(p.description || (benefit?.kind === "VR" ? "VR — compra" : "VA — compra")),
      date: pDate.slice(0, 10),
      amount: Number(Number(p.amount || 0).toFixed(2)),
      isMeal: true,
      accountName,
      subCategoryLabel: subLabel,
    };
    txsByKey[baseKey].push(item);
    if (isSubcategory(canonicalSub)) {
      if (!txsByKey[canonicalSub]) txsByKey[canonicalSub] = [];
      txsByKey[canonicalSub].push(item);
    }
  });

  return mergeBudgetRows({
    spentBankMap,
    spentMealMap,
    budgets,
    ym,
    asOfDate: asOfDate || asOfForBudgetMonth(ym),
    subSpend,
    txsByKey,
  });
}

