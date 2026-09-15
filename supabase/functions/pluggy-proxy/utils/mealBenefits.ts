/** VA/VR balance engine — keep in sync with src/utils/mealBenefits.js */

export type AnyRec = Record<string, unknown>;

export type MealBenefitMomentItem = {
  id: string;
  kind: string;
  label: string;
  remaining: number;
  monthCredit: number;
  monthSpent: number;
  creditDay: number;
  ownerLabel: string | null;
};

const KIND_LABELS: Record<string, string> = {
  VA: "Vale Alimentação",
  VR: "Vale Refeição",
};

export const MEAL_DEFAULT_CATEGORY: Record<string, string> = {
  VA: "Supermercado & Alimentação",
  VR: "Restaurantes & Bares",
};

export function defaultMealCategoryForKind(kind?: string): string {
  return kind === "VR" ? MEAL_DEFAULT_CATEGORY.VR : MEAL_DEFAULT_CATEGORY.VA;
}

function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = String(ym).split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${pad2(m)}-${pad2(last)}`;
}

function clampDay(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const n = Number(day) || 1;
  return Math.min(Math.max(1, n), last);
}

function creditISO(year: number, monthIndex: number, creditDay: number): string {
  const day = clampDay(year, monthIndex, creditDay);
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function normalizeMealBenefit(row: AnyRec = {}) {
  return {
    id: String(row.id || ""),
    kind: row.kind === "VR" ? "VR" : "VA",
    label: String(row.label || ""),
    monthlyAmount: Number(row.monthlyAmount ?? row.monthly_amount) || 0,
    creditDay: Number(row.creditDay ?? row.credit_day) || 1,
    startsOn: String(row.startsOn || row.starts_on || "").slice(0, 10),
    openingBalance: Number(row.openingBalance ?? row.opening_balance) || 0,
    showInMoment: Boolean(row.showInMoment ?? row.show_in_moment),
    ownerLabel: row.ownerLabel
      ? String(row.ownerLabel)
      : (row.owner_label ? String(row.owner_label) : null),
  };
}

export function normalizeMealPurchase(row: AnyRec = {}) {
  return {
    id: String(row.id || ""),
    benefitId: String(row.benefitId || row.benefit_id || ""),
    amount: Number(row.amount) || 0,
    purchasedAt: String(row.purchasedAt || row.purchased_at || "").slice(0, 10),
    category: String(row.category || "").trim(),
  };
}

function displayLabel(benefit: ReturnType<typeof normalizeMealBenefit>): string {
  const fallback = KIND_LABELS[benefit.kind] || "Benefício";
  return (benefit.label || "").trim() || fallback;
}

function creditDatesThrough(startsOn: string, creditDay: number, asOfDate: string): string[] {
  if (!startsOn || !asOfDate) return [];
  const dates: string[] = [];
  let y = Number(startsOn.slice(0, 4));
  let m = Number(startsOn.slice(5, 7));
  const endY = Number(asOfDate.slice(0, 4));
  const endM = Number(asOfDate.slice(5, 7));
  if (!y || !m || !endY || !endM) return [];

  while (y < endY || (y === endY && m <= endM)) {
    const iso = creditISO(y, m - 1, creditDay);
    if (iso >= startsOn && iso <= asOfDate) dates.push(iso);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return dates;
}

function remainingAsOf(
  benefit: ReturnType<typeof normalizeMealBenefit>,
  purchases: ReturnType<typeof normalizeMealPurchase>[],
  asOfDate: string,
): number {
  const credits = creditDatesThrough(benefit.startsOn, benefit.creditDay, asOfDate).length;
  const spent = purchases
    .filter((p) => p.benefitId === benefit.id && p.purchasedAt && p.purchasedAt <= asOfDate)
    .reduce((sum, p) => sum + p.amount, 0);
  return benefit.openingBalance + credits * benefit.monthlyAmount - spent;
}

function asOfForMonth(ym: string, today = todayISO()): string {
  const todayYm = today.slice(0, 7);
  if (ym && ym < todayYm) return lastDayOfMonth(ym);
  return today;
}

export function momentItemsFor(
  benefits: AnyRec[] = [],
  purchases: AnyRec[] = [],
  ym: string,
  today = todayISO(),
): MealBenefitMomentItem[] {
  const normalizedPurchases = purchases.map(normalizeMealPurchase);
  return benefits
    .map(normalizeMealBenefit)
    .filter((b) => b.showInMoment && b.id)
    .map((benefit) => {
      const asOf = asOfForMonth(ym, today);
      const [y, m] = String(ym || "").split("-").map(Number);
      const creditDate = y && m ? creditISO(y, m - 1, benefit.creditDay) : "";
      const monthCredit = creditDate && creditDate >= benefit.startsOn && creditDate <= asOf
        ? benefit.monthlyAmount
        : 0;
      const monthSpent = normalizedPurchases
        .filter((p) => p.benefitId === benefit.id && p.purchasedAt.startsWith(ym))
        .reduce((sum, p) => sum + p.amount, 0);
      return {
        id: benefit.id,
        kind: benefit.kind,
        label: displayLabel(benefit),
        remaining: remainingAsOf(benefit, normalizedPurchases, asOf),
        monthCredit,
        monthSpent,
        creditDay: benefit.creditDay,
        ownerLabel: benefit.ownerLabel,
      };
    });
}

export function mealSpendByCategory(
  benefits: AnyRec[] = [],
  purchases: AnyRec[] = [],
  ym: string,
): Record<string, number> {
  const month = String(ym || "").slice(0, 7);
  if (!month) return {};
  const byId: Record<string, ReturnType<typeof normalizeMealBenefit>> = {};
  benefits.map(normalizeMealBenefit).forEach((b) => {
    if (b.id) byId[b.id] = b;
  });
  const map: Record<string, number> = {};
  purchases.map(normalizeMealPurchase).forEach((p) => {
    if (!p.purchasedAt.startsWith(month)) return;
    const benefit = byId[p.benefitId];
    const category = p.category || defaultMealCategoryForKind(benefit?.kind);
    if (!category) return;
    map[category] = (map[category] || 0) + p.amount;
  });
  return map;
}
