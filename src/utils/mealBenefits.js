/** VA/VR balance engine — credits after startsOn minus purchases. */

export const MEAL_KIND_LABELS = {
  VA: 'Vale Alimentação',
  VR: 'Vale Refeição',
};

export const MEAL_DEFAULT_CATEGORY = {
  VA: 'Supermercado & Alimentação',
  VR: 'Restaurantes & Bares',
};

export const MEAL_CATEGORY_OPTIONS = [
  'Supermercado & Alimentação',
  'Restaurantes & Bares',
  'Delivery de Comida',
];

export function defaultMealCategoryForKind(kind) {
  return kind === 'VR' ? MEAL_DEFAULT_CATEGORY.VR : MEAL_DEFAULT_CATEGORY.VA;
}

export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${pad2(m)}-${pad2(last)}`;
}

function clampDay(year, monthIndex, day) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const n = Number(day) || 1;
  return Math.min(Math.max(1, n), last);
}

function creditISO(year, monthIndex, creditDay) {
  const day = clampDay(year, monthIndex, creditDay);
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function normalizeMealBenefit(row = {}) {
  return {
    id: row.id,
    userId: row.userId || row.user_id,
    kind: row.kind === 'VR' ? 'VR' : 'VA',
    label: row.label || '',
    monthlyAmount: Number(row.monthlyAmount ?? row.monthly_amount) || 0,
    creditDay: Number(row.creditDay ?? row.credit_day) || 1,
    startsOn: String(row.startsOn || row.starts_on || '').slice(0, 10),
    openingBalance: Number(row.openingBalance ?? row.opening_balance) || 0,
    showInMoment: Boolean(row.showInMoment ?? row.show_in_moment),
    ownerUserId: row.ownerUserId || row.owner_user_id || row.userId || row.user_id,
    ownerLabel: row.ownerLabel || row.owner_label || null,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at,
  };
}

export function normalizeMealPurchase(row = {}) {
  return {
    id: row.id,
    userId: row.userId || row.user_id,
    benefitId: row.benefitId || row.benefit_id,
    amount: Number(row.amount) || 0,
    purchasedAt: String(row.purchasedAt || row.purchased_at || '').slice(0, 10),
    description: row.description || '',
    category: String(row.category || '').trim(),
    ownerUserId: row.ownerUserId || row.owner_user_id || row.userId || row.user_id,
    ownerLabel: row.ownerLabel || row.owner_label || null,
    createdAt: row.createdAt || row.created_at,
  };
}

export function displayBenefitLabel(benefit) {
  const normalized = benefit.kind ? benefit : normalizeMealBenefit(benefit);
  const fallback = MEAL_KIND_LABELS[normalized.kind] || 'Benefício';
  return (normalized.label || '').trim() || fallback;
}

export function visibleOnMoment(benefits = []) {
  return benefits
    .map(normalizeMealBenefit)
    .filter((b) => b.showInMoment);
}

function creditDatesThrough(startsOn, creditDay, asOfDate) {
  if (!startsOn || !asOfDate) return [];
  const dates = [];
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

export function remainingAsOf(benefit, purchases = [], asOfDate = todayISO()) {
  const b = normalizeMealBenefit(benefit);
  const asOf = String(asOfDate || todayISO()).slice(0, 10);
  const credits = creditDatesThrough(b.startsOn, b.creditDay, asOf).length;
  const spent = purchases
    .map(normalizeMealPurchase)
    .filter((p) => p.benefitId === b.id && p.purchasedAt && p.purchasedAt <= asOf)
    .reduce((sum, p) => sum + p.amount, 0);
  return b.openingBalance + credits * b.monthlyAmount - spent;
}

export function asOfForMonth(ym, today = todayISO()) {
  const todayYm = String(today).slice(0, 7);
  if (ym && ym < todayYm) return lastDayOfMonth(ym);
  return String(today).slice(0, 10);
}

export function monthSnapshot(benefit, purchases = [], ym, today = todayISO()) {
  const b = normalizeMealBenefit(benefit);
  const asOf = asOfForMonth(ym, today);
  const [y, m] = String(ym || '').split('-').map(Number);
  const creditDate = y && m ? creditISO(y, m - 1, b.creditDay) : '';
  const monthCredit = creditDate && creditDate >= b.startsOn && creditDate <= asOf
    ? b.monthlyAmount
    : 0;
  const monthSpent = purchases
    .map(normalizeMealPurchase)
    .filter((p) => p.benefitId === b.id && p.purchasedAt.startsWith(ym))
    .reduce((sum, p) => sum + p.amount, 0);
  return {
    remaining: remainingAsOf(b, purchases, asOf),
    monthCredit,
    monthSpent,
    creditDay: b.creditDay,
    creditDate,
  };
}

export function nextCreditDate(benefit, fromDate = todayISO()) {
  const b = normalizeMealBenefit(benefit);
  const from = String(fromDate).slice(0, 10);
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  if (!y || !m) return null;
  for (let i = 0; i < 24; i += 1) {
    const iso = creditISO(y, m - 1, b.creditDay);
    if (iso >= b.startsOn && iso > from) return iso;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return null;
}

export function mealSpendByCategory(benefits = [], purchases = [], ym) {
  const month = String(ym || '').slice(0, 7);
  if (!month) return {};
  const byId = {};
  benefits.map(normalizeMealBenefit).forEach((b) => {
    if (b.id) byId[b.id] = b;
  });
  const map = {};
  purchases.map(normalizeMealPurchase).forEach((p) => {
    if (!p.purchasedAt.startsWith(month)) return;
    const benefit = byId[p.benefitId];
    const category = p.category || defaultMealCategoryForKind(benefit?.kind);
    if (!category) return;
    map[category] = (map[category] || 0) + p.amount;
  });
  return map;
}

export function momentItemsFor(benefits = [], purchases = [], ym, today = todayISO()) {
  return visibleOnMoment(benefits).map((benefit) => {
    const snap = monthSnapshot(benefit, purchases, ym, today);
    return {
      id: benefit.id,
      kind: benefit.kind,
      label: displayBenefitLabel(benefit),
      remaining: snap.remaining,
      monthCredit: snap.monthCredit,
      monthSpent: snap.monthSpent,
      creditDay: benefit.creditDay,
      ownerUserId: benefit.ownerUserId,
      ownerLabel: benefit.ownerLabel,
    };
  });
}
