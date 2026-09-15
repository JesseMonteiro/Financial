/** Period-aware budget allowance — keep in sync with src/utils/budgetPeriod.js */

export const BUDGET_PERIODS = ["daily", "weekly", "biweekly", "monthly"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function normalizeBudgetPeriod(period: unknown): BudgetPeriod {
  return BUDGET_PERIODS.includes(period as BudgetPeriod) ? period as BudgetPeriod : "monthly";
}

export function daysInMonth(ym: string): number {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

export function lastDayOfMonth(ym: string): string {
  return `${ym}-${pad2(daysInMonth(ym))}`;
}

export function periodCount(period: unknown, ym: string): number {
  const p = normalizeBudgetPeriod(period);
  if (p === "daily") return daysInMonth(ym);
  if (p === "weekly") return 4;
  if (p === "biweekly") return 2;
  return 1;
}

export function asOfForBudgetMonth(ym: string, today = todayISO()): string {
  const asOf = String(today || todayISO()).slice(0, 10);
  const todayYm = asOf.slice(0, 7);
  if (ym && ym < todayYm) return lastDayOfMonth(ym);
  if (ym && ym > todayYm) return `${ym}-01`;
  return asOf;
}

export function startedPeriods(period: unknown, ym: string, asOfDate: string): number {
  const p = normalizeBudgetPeriod(period);
  const count = periodCount(p, ym);
  const asOf = String(asOfDate || "").slice(0, 10);
  if (!asOf || !ym) return 0;
  const asOfYm = asOf.slice(0, 7);
  if (asOfYm < ym) return 0;
  if (asOfYm > ym) return count;
  const day = Number(asOf.slice(8, 10)) || 1;
  if (p === "daily") return Math.min(count, Math.max(1, day));
  if (p === "weekly") {
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    return 4;
  }
  if (p === "biweekly") return day <= 15 ? 1 : 2;
  return 1;
}

export function allowance(amount: number, period: unknown, ym: string, asOfDate: string): number {
  return Number(((Number(amount) || 0) * startedPeriods(period, ym, asOfDate)).toFixed(2));
}

export function monthCap(amount: number, period: unknown, ym: string): number {
  return Number(((Number(amount) || 0) * periodCount(period, ym)).toFixed(2));
}

export type BudgetInput = {
  id?: string;
  category: string;
  limit: number;
  period?: string;
};

export type BudgetRow = {
  id: string;
  category: string;
  spentBank: number;
  spentMeal: number;
  spent: number;
  period: BudgetPeriod;
  periodAmount: number;
  allowance: number;
  monthCap: number;
  limit: number;
  hasLimit: boolean;
  periodIndex: number;
  periodCount: number;
  percent: number;
};

export function mergeBudgetRows(opts: {
  spentBankMap?: Record<string, number>;
  spentMealMap?: Record<string, number>;
  budgets?: BudgetInput[];
  ym: string;
  asOfDate?: string;
}): BudgetRow[] {
  const spentBankMap = opts.spentBankMap || {};
  const spentMealMap = opts.spentMealMap || {};
  const budgets = opts.budgets || [];
  const ym = opts.ym;
  const asOf = opts.asOfDate || asOfForBudgetMonth(ym);
  const rows: Record<string, Omit<BudgetRow, "percent">> = {};

  const addSpent = (cat: string, bank: number, meal: number) => {
    if (!cat) return;
    if (!rows[cat]) {
      rows[cat] = {
        id: cat,
        category: cat,
        spentBank: 0,
        spentMeal: 0,
        spent: 0,
        period: "monthly",
        periodAmount: 0,
        allowance: 0,
        monthCap: 0,
        limit: 0,
        hasLimit: false,
        periodIndex: 1,
        periodCount: 1,
      };
    }
    rows[cat].spentBank += bank;
    rows[cat].spentMeal += meal;
    rows[cat].spent = rows[cat].spentBank + rows[cat].spentMeal;
  };

  Object.entries(spentBankMap).forEach(([cat, spent]) => addSpent(cat, Number(spent) || 0, 0));
  Object.entries(spentMealMap).forEach(([cat, spent]) => addSpent(cat, 0, Number(spent) || 0));

  budgets.forEach((b) => {
    const cat = String(b.category || "");
    if (!cat) return;
    const period = normalizeBudgetPeriod(b.period);
    const periodAmount = Number(b.limit) || 0;
    const started = startedPeriods(period, ym, asOf);
    const count = periodCount(period, ym);
    const earned = allowance(periodAmount, period, ym, asOf);
    const cap = monthCap(periodAmount, period, ym);
    if (!rows[cat]) addSpent(cat, 0, 0);
    rows[cat].id = String(b.id || cat);
    rows[cat].period = period;
    rows[cat].periodAmount = periodAmount;
    rows[cat].allowance = earned;
    rows[cat].monthCap = cap;
    rows[cat].limit = earned;
    rows[cat].hasLimit = true;
    rows[cat].periodIndex = started;
    rows[cat].periodCount = count;
  });

  return Object.values(rows)
    .map((row) => {
      const spent = Number(row.spent.toFixed(2));
      const spentBank = Number(row.spentBank.toFixed(2));
      const spentMeal = Number(row.spentMeal.toFixed(2));
      const limit = Number((row.limit || 0).toFixed(2));
      return {
        ...row,
        spent,
        spentBank,
        spentMeal,
        allowance: Number((row.allowance || 0).toFixed(2)),
        monthCap: Number((row.monthCap || 0).toFixed(2)),
        periodAmount: Number((row.periodAmount || 0).toFixed(2)),
        limit,
        percent: limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0,
      };
    })
    .sort((a, b) => {
      const aOver = a.hasLimit && a.spent > a.limit;
      const bOver = b.hasLimit && b.spent > b.limit;
      if (aOver !== bOver) return aOver ? -1 : 1;
      return b.spent - a.spent;
    });
}
