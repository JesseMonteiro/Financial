import { isExpenseTx } from './analytics';
import { buildCreditCardBills, formatDueMonthShort } from './creditBillPeriod';
import { detectSubscriptions } from './subscriptions';
import { translateCategory } from './categories';

const FREQ_LABEL = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  yearly: 'Anual',
};

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** How far back unpaid credit bills may stay listed as overdue (days). */
const CREDIT_OVERDUE_LOOKBACK_DAYS = 93;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toIsoDay(value) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\(\d+\/\d+\)\s*/g, ' ')
    .replace(/\s*\(recorrente\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Robust paid flag (boolean, string, or paidAt timestamp). */
export function isTxPaid(t) {
  if (!t) return false;
  if (t.isPaid === true || t.isPaid === 1 || t.isPaid === 'true') return true;
  if (t.paidAt) return true;
  return false;
}

/**
 * @param {object} card
 */
export function describeCreditCard(card = {}) {
  const name = card.name || card.marketingName || 'Cartão de crédito';
  const bank =
    card.connectorName ||
    card._connector ||
    card.bankName ||
    card.institutionName ||
    '';
  const digits = String(card.number || card.creditData?.number || '').replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : '';
  return { name, bank, last4 };
}

/**
 * Days from today (0 = today). Negative = past.
 * @param {string} isoDate
 * @param {Date} [now]
 */
export function daysUntil(isoDate, now = new Date()) {
  const d = startOfDay(isoDate);
  const n = startOfDay(now);
  return Math.round((d - n) / (1000 * 60 * 60 * 24));
}

/**
 * @param {{ isPaid?: boolean, date: string }} item
 * @param {Date} [now]
 * @returns {'paid' | 'overdue' | 'due'}
 */
export function resolveAgendaStatus(item, now = new Date()) {
  if (item.isPaid) return 'paid';
  const days = daysUntil(item.date, now);
  if (days < 0) return 'overdue';
  return 'due';
}

/**
 * Rolling month keys around today for the calendar strip.
 * @param {Date} [now]
 * @param {{ before?: number, after?: number }} [opts]
 */
export function buildAgendaMonthKeys(now = new Date(), { before = 2, after = 3 } = {}) {
  const keys = [];
  for (let i = -before; i <= after; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    keys.push({
      ym,
      label: MONTHS_PT[d.getMonth()],
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      isCurrent:
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(),
    });
  }
  return keys;
}

/**
 * Build unified bill/agenda items for a date window.
 *
 * @param {object} opts
 * @param {object[]} [opts.transactions]
 * @param {object[]} [opts.creditCards]
 * @param {string[]} [opts.creditIds]
 * @param {(ids: string[]) => { transactions?: object[], bills?: object[] }} [opts.getMerged]
 * @param {object[]} [opts.loans]
 * @param {object[]} [opts.expenseSources] — bank + card txs for subscription detection
 * @param {number} [opts.pastDays=100]
 * @param {number} [opts.futureDays=120]
 * @param {Date} [opts.now]
 */
export function buildAgendaItems({
  transactions = [],
  creditCards = [],
  creditIds = [],
  getMerged,
  loans = [],
  expenseSources,
  pastDays = 100,
  futureDays = 120,
  now = new Date(),
} = {}) {
  const today = startOfDay(now);
  const from = new Date(today);
  from.setDate(from.getDate() - pastDays);
  const to = new Date(today);
  to.setDate(to.getDate() + futureDays);

  const inWindow = (iso) => {
    const d = startOfDay(iso);
    return d >= from && d <= to;
  };

  /** Unpaid past items stay visible even outside pastDays (still overdue). */
  const shouldInclude = (iso, isPaid) => {
    if (!iso) return false;
    const d = startOfDay(iso);
    if (d > to) return false;
    if (d >= from) return true;
    return !isPaid && d < today;
  };

  const items = [];
  const manualNameByDay = new Map(); // `${day}|${normName}` → isPaid

  // Manual expenses (contas lançadas pelo usuário) — source of truth for paid status
  transactions
    .filter((t) => t.isManual && isExpenseTx(t))
    .forEach((t) => {
      const date = toIsoDay(t.date);
      const isPaid = isTxPaid(t);
      const title = t.originalDescription || t.description || 'Despesa manual';
      const norm = normalizeName(title);
      if (date && norm) manualNameByDay.set(`${date}|${norm}`, isPaid);

      if (!shouldInclude(date, isPaid)) return;
      items.push({
        id: `manual_${t.id}`,
        date,
        title,
        amount: Math.abs(Number(t.amount) || 0),
        type: 'manual',
        meta: `Despesa manual · ${translateCategory(t.category)}`,
        isPaid,
        sourceId: t.id,
        category: t.category,
      });
    });

  // Credit card bills — one row per card (name + bank)
  if (creditCards.length && typeof getMerged === 'function') {
    try {
      const { transactions: cardTxs, bills: officialBills } = getMerged(creditIds);

      creditCards.forEach((card) => {
        const cardId = card.id;
        const scopedTxs = (cardTxs || []).filter((t) => !t.accountId || t.accountId === cardId);
        const scopedBills = (officialBills || []).filter((b) => !b.accountId || b.accountId === cardId);
        const built = buildCreditCardBills({
          transactions: scopedTxs,
          officialBills: scopedBills,
          creditCards: [card],
          selectedCardId: cardId,
        });
        const { name, bank, last4 } = describeCreditCard(card);

        Object.entries(built.bills || {}).forEach(([dueYm, bill]) => {
          const date = bill.dueDate ? toIsoDay(bill.dueDate) : `${dueYm}-10`;
          let isPaid = Boolean(bill.isPaid);
          const amount = Math.abs(Number(bill.total || 0));
          if (amount <= 0) return;

          if (!isPaid && bill.type === 'PAST') {
            const ageDays = -daysUntil(date, now);
            if (ageDays > CREDIT_OVERDUE_LOOKBACK_DAYS) isPaid = true;
          }

          if (!shouldInclude(date, isPaid)) return;

          const dueLabel = formatDueMonthShort(dueYm, date);
          const bankPart = bank || 'Banco conectado';
          const finalPart = last4 ? ` · final ${last4}` : '';
          const metaParts = [bankPart + finalPart, `vence ${dueLabel}`];
          if (bill.type === 'CURRENT_OPEN') metaParts.push('em aberto');
          else if (bill.type === 'FUTURE') metaParts.push('projetada');

          items.push({
            id: `bill_${cardId}_${dueYm}`,
            date,
            title: `Fatura · ${name}`,
            amount,
            type: 'bill',
            meta: metaParts.join(' · '),
            isPaid,
            cardId,
            cardName: name,
            bankName: bank,
            last4,
            dueMonthKey: dueYm,
          });
        });
      });
    } catch {
      /* incomplete credit data */
    }
  }

  // Loans
  (loans || []).forEach((loan) => {
    const date = toIsoDay(loan.dueDate || loan.nextPaymentDate);
    if (!date) return;
    const isPaid = Boolean(loan.isPaid);
    if (!shouldInclude(date, isPaid)) return;
    items.push({
      id: `loan_${loan.id}`,
      date,
      title: loan.name || 'Empréstimo',
      amount: Math.abs(Number(loan.installmentAmount || loan.paymentAmount || 0)),
      type: 'loan',
      meta: 'Parcela de empréstimo',
      isPaid,
    });
  });

  // Detected subscriptions from bank/card only — never re-add manuals
  // (manuals already appear above with correct isPaid; Rent→Utilidades was
  // duplicating Aluguel/Condomínio as always-unpaid "subscriptions").
  const bankSources = (expenseSources || transactions).filter((t) => !t.isManual);
  detectSubscriptions(bankSources).forEach((sub) => {
    if (sub.isManual) return;
    const date = toIsoDay(sub.nextDate);
    if (!date || !inWindow(date)) return;

    const norm = normalizeName(sub.name);
    const manualKey = `${date}|${norm}`;
    if (manualNameByDay.has(manualKey)) return;

    // Also skip if any recurring manual series shares this name
    const coveredByManualSeries = transactions.some((t) => {
      if (!t.isManual || !t.isRecurring) return false;
      return normalizeName(t.originalDescription || t.description) === norm;
    });
    if (coveredByManualSeries) return;

    items.push({
      id: `sub_${sub.id}`,
      date,
      title: sub.name,
      amount: Math.abs(Number(sub.amount) || 0),
      type: 'subscription',
      meta: sub.subscriptionKindLabel || FREQ_LABEL[sub.frequency] || 'Assinatura',
      isPaid: false,
    });
  });

  return items
    .map((item) => ({
      ...item,
      status: resolveAgendaStatus(item, now),
      days: daysUntil(item.date, now),
      monthKey: String(item.date || '').slice(0, 7),
    }))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return b.amount - a.amount;
    });
}

/**
 * Group agenda items by ISO date.
 * @param {ReturnType<typeof buildAgendaItems>} items
 */
export function groupAgendaByDate(items = []) {
  const map = new Map();
  items.forEach((item) => {
    if (!map.has(item.date)) map.set(item.date, []);
    map.get(item.date).push(item);
  });
  return [...map.entries()].map(([date, dayItems]) => ({
    date,
    items: dayItems,
    totalDue: dayItems.filter((i) => !i.isPaid).reduce((s, i) => s + i.amount, 0),
    totalPaid: dayItems.filter((i) => i.isPaid).reduce((s, i) => s + i.amount, 0),
    hasOverdue: dayItems.some((i) => i.status === 'overdue'),
  }));
}

/**
 * Summarize items for one YYYY-MM month.
 * @param {ReturnType<typeof buildAgendaItems>} items
 * @param {string} ym
 */
export function summarizeAgendaMonth(items = [], ym) {
  const monthItems = items.filter((i) => i.monthKey === ym || String(i.date || '').startsWith(ym));
  const unpaid = monthItems.filter((i) => !i.isPaid);
  const overdue = unpaid.filter((i) => i.status === 'overdue');
  const paid = monthItems.filter((i) => i.isPaid);
  const daysWithItems = new Set(monthItems.map((i) => i.date));
  return {
    ym,
    items: monthItems,
    count: monthItems.length,
    unpaidCount: unpaid.length,
    overdueCount: overdue.length,
    paidCount: paid.length,
    unpaidTotal: unpaid.reduce((s, i) => s + i.amount, 0),
    paidTotal: paid.reduce((s, i) => s + i.amount, 0),
    daysWithItems,
  };
}

/**
 * Calendar cells for a month (weeks start on Sunday, matching pt-BR common UI).
 * @param {string} ym YYYY-MM
 * @param {ReturnType<typeof buildAgendaItems>} items
 */
export function buildMonthCalendarCells(ym, items = []) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startPad = first.getDay(); // 0=Sun
  const byDay = new Map();
  items
    .filter((i) => String(i.date || '').startsWith(ym))
    .forEach((i) => {
      const day = Number(String(i.date).slice(8, 10));
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(i);
    });

  const cells = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ key: `pad-${i}`, empty: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayItems = byDay.get(day) || [];
    const iso = `${ym}-${String(day).padStart(2, '0')}`;
    cells.push({
      key: iso,
      empty: false,
      day,
      date: iso,
      items: dayItems,
      hasOverdue: dayItems.some((i) => i.status === 'overdue'),
      hasUnpaid: dayItems.some((i) => !i.isPaid),
      hasPaid: dayItems.some((i) => i.isPaid),
      unpaidTotal: dayItems.filter((i) => !i.isPaid).reduce((s, i) => s + i.amount, 0),
    });
  }
  return cells;
}

export function summarizeAgenda(items = []) {
  const unpaid = items.filter((i) => !i.isPaid);
  const overdue = unpaid.filter((i) => i.status === 'overdue');
  const dueSoon = unpaid.filter((i) => i.status === 'due' && i.days <= 7);
  return {
    total: items.length,
    unpaidCount: unpaid.length,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    unpaidTotal: unpaid.reduce((s, i) => s + i.amount, 0),
    overdueTotal: overdue.reduce((s, i) => s + i.amount, 0),
    paidCount: items.filter((i) => i.isPaid).length,
  };
}
