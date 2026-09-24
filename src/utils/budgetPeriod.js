/** Period-aware budget allowance — keep in sync with supabase/.../utils/budgetPeriod.ts */
import {
  resolveBudgetCategoryKey,
  canonicalBudgetCategory,
  isSubcategory,
  getParentCategory,
  translateCategory,
  BASE_KEY_TO_LABEL,
  resolveCategoryLabel,
} from './categories.js';

export const BUDGET_PERIODS = ['daily', 'weekly', 'biweekly', 'monthly'];


/** Categories that should be excluded from budget by default (transfers, income, etc.) */
export const BUDGET_EXCLUDED_CATEGORIES = [
  'Transferências',
  'Pagamento de Fatura',
  'Tarifas Bancárias',
  'Salário & Renda',
  'Investimentos',
  // Pluggy categories in English (before translation)
  'Transfers',
  'Credit card payment',
  'Bank fees',
  'Salary',
  'Investments',
  'Cashback',
  'cashback',
  'CASHBACK',
];

export const BUDGET_PERIOD_LABELS = {
  daily: 'Diária',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
};

export const BUDGET_PERIOD_UNIT = {
  daily: '/dia',
  weekly: '/semana',
  biweekly: '/quinzena',
  monthly: '/mês',
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

export function normalizeBudgetPeriod(period) {
  return BUDGET_PERIODS.includes(period) ? period : 'monthly';
}

export function daysInMonth(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

export function lastDayOfMonth(ym) {
  return `${ym}-${pad2(daysInMonth(ym))}`;
}

export function periodCount(period, ym) {
  const p = normalizeBudgetPeriod(period);
  if (p === 'daily') return daysInMonth(ym);
  if (p === 'weekly') return 4;
  if (p === 'biweekly') return 2;
  return 1;
}

export function asOfForBudgetMonth(ym, today = todayISO()) {
  const asOf = String(today || todayISO()).slice(0, 10);
  const todayYm = asOf.slice(0, 7);
  if (ym && ym < todayYm) return lastDayOfMonth(ym);
  if (ym && ym > todayYm) return `${ym}-01`;
  return asOf;
}

export function startedPeriods(period, ym, asOfDate) {
  const p = normalizeBudgetPeriod(period);
  const count = periodCount(p, ym);
  const asOf = String(asOfDate || '').slice(0, 10);
  if (!asOf || !ym) return 0;
  const asOfYm = asOf.slice(0, 7);
  if (asOfYm < ym) return 0;
  if (asOfYm > ym) return count;
  const day = Number(asOf.slice(8, 10)) || 1;
  if (p === 'daily') return Math.min(count, Math.max(1, day));
  if (p === 'weekly') {
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    return 4;
  }
  if (p === 'biweekly') return day <= 15 ? 1 : 2;
  return 1;
}

export function allowance(amount, period, ym, asOfDate) {
  return Number(((Number(amount) || 0) * startedPeriods(period, ym, asOfDate)).toFixed(2));
}

export function monthCap(amount, period, ym) {
  return Number(((Number(amount) || 0) * periodCount(period, ym)).toFixed(2));
}

export function periodProgressLabel(period, ym, asOfDate) {
  const p = normalizeBudgetPeriod(period);
  const started = startedPeriods(p, ym, asOfDate);
  const total = periodCount(p, ym);
  if (p === 'daily') return `${started} de ${total} dias`;
  if (p === 'weekly') return `semana ${started} de ${total}`;
  if (p === 'biweekly') return `quinzena ${started} de ${total}`;
  return 'mês';
}

export function mergeBudgetRows({
  spentBankMap = {},
  spentMealMap = {},
  budgets = [],
  ym,
  asOfDate,
  subSpend = {},
} = {}) {
  const asOf = asOfDate || asOfForBudgetMonth(ym);
  const rows = {};

  const addSpent = (cat, bank, meal) => {
    if (!cat) return;
    const canonical = canonicalBudgetCategory(cat);
    const isSub = isSubcategory(canonical);
    if (!rows[canonical]) {
      const parentGroup = isSub ? getParentCategory(canonical) : null;
      rows[canonical] = {
        id: canonical,
        category: canonical,
        categoryLabel: isSub ? translateCategory(canonical) : (BASE_KEY_TO_LABEL[canonical] || resolveCategoryLabel(canonical) || canonical),
        isSubcategory: isSub,
        parentCategoryLabel: parentGroup ? parentGroup.label : null,
        spentBank: 0,
        spentMeal: 0,
        spent: 0,
        period: 'monthly',
        periodAmount: 0,
        allowance: 0,
        monthCap: 0,
        limit: 0,
        hasLimit: false,
        periodIndex: 1,
        periodCount: 1,
      };
    }
    rows[canonical].spentBank += bank;
    rows[canonical].spentMeal += meal;
    rows[canonical].spent = rows[canonical].spentBank + rows[canonical].spentMeal;
  };

  Object.entries(spentBankMap).forEach(([cat, spent]) => addSpent(cat, Number(spent) || 0, 0));
  Object.entries(spentMealMap).forEach(([cat, spent]) => addSpent(cat, 0, Number(spent) || 0));

  budgets.forEach((b) => {
    const rawCat = String(b.category || '');
    if (!rawCat) return;
    const cat = canonicalBudgetCategory(rawCat) || rawCat;
    const isSub = isSubcategory(cat);
    const period = normalizeBudgetPeriod(b.period);
    const periodAmount = Number(b.limit) || 0;
    const started = startedPeriods(period, ym, asOf);
    const count = periodCount(period, ym);
    const earned = allowance(periodAmount, period, ym, asOf);
    const cap = monthCap(periodAmount, period, ym);
    const parentGroup = isSub ? getParentCategory(cat) : null;

    if (!rows[cat]) {
      rows[cat] = {
        id: String(b.id || cat),
        category: cat,
        categoryLabel: isSub ? translateCategory(cat) : (BASE_KEY_TO_LABEL[cat] || resolveCategoryLabel(cat) || cat),
        isSubcategory: isSub,
        parentCategoryLabel: parentGroup ? parentGroup.label : null,
        spentBank: spentBankMap[cat] || 0,
        spentMeal: spentMealMap[cat] || 0,
        spent: (spentBankMap[cat] || 0) + (spentMealMap[cat] || 0),
        period,
        periodAmount,
        allowance: earned,
        monthCap: cap,
        limit: earned,
        hasLimit: true,
        periodIndex: started,
        periodCount: count,
      };
    } else {
      rows[cat].id = String(b.id || cat);
      rows[cat].period = period;
      rows[cat].periodAmount = periodAmount;
      rows[cat].allowance = earned;
      rows[cat].monthCap = cap;
      rows[cat].limit = earned;
      rows[cat].hasLimit = true;
      rows[cat].periodIndex = started;
      rows[cat].periodCount = count;
      rows[cat].isSubcategory = isSub;
      rows[cat].parentCategoryLabel = parentGroup ? parentGroup.label : null;
      if (isSub) {
        rows[cat].categoryLabel = translateCategory(cat);
      }
    }
  });

  return Object.values(rows)
    .filter((row) => row.hasLimit) // Show only categories with defined budget
    .map((row) => {
      const spent = Number(row.spent.toFixed(2));
      const spentBank = Number(row.spentBank.toFixed(2));
      const spentMeal = Number(row.spentMeal.toFixed(2));
      const limit = Number((row.limit || 0).toFixed(2));
      const categoryLabel = row.categoryLabel || (row.isSubcategory ? translateCategory(row.category) : (BASE_KEY_TO_LABEL[row.category] || resolveCategoryLabel(row.category) || row.category));
      const subs = !row.isSubcategory ? subSpend[row.category] : null;
      const subcategories = subs
        ? Object.entries(subs)
            .map(([label, s]) => ({ label, spent: Number(s.toFixed(2)) }))
            .sort((a, b) => b.spent - a.spent)
        : [];

      return {
        ...row,
        categoryLabel,
        spent,
        spentBank,
        spentMeal,
        allowance: Number((row.allowance || 0).toFixed(2)),
        monthCap: Number((row.monthCap || 0).toFixed(2)),
        periodAmount: Number((row.periodAmount || 0).toFixed(2)),
        limit,
        percent: limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0,
        subcategories,
      };
    })
    .sort((a, b) => {
      const aOver = a.hasLimit && a.spent > a.limit;
      const bOver = b.hasLimit && b.spent > b.limit;
      if (aOver !== bOver) return aOver ? -1 : 1;
      return b.spent - a.spent;
    });
}
