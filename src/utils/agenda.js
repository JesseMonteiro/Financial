import { isExpenseTx } from './analytics';
import { buildCreditCardBills, formatDueMonthShort } from './creditBillPeriod';
import { detectSubscriptions } from './subscriptions';

const FREQ_LABEL = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  yearly: 'Anual',
};

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
 * Build unified bill/agenda items for a date window.
 *
 * @param {object} opts
 * @param {object[]} [opts.transactions]
 * @param {object[]} [opts.creditCards]
 * @param {string[]} [opts.creditIds]
 * @param {(ids: string[]) => { transactions?: object[], bills?: object[] }} [opts.getMerged]
 * @param {object[]} [opts.loans]
 * @param {object[]} [opts.expenseSources] — bank + card txs for subscription detection
 * @param {number} [opts.pastDays=30]
 * @param {number} [opts.futureDays=60]
 * @param {Date} [opts.now]
 */
export function buildAgendaItems({
  transactions = [],
  creditCards = [],
  creditIds = [],
  getMerged,
  loans = [],
  expenseSources,
  pastDays = 30,
  futureDays = 60,
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

  // Manual expenses (contas lançadas pelo usuário)
  transactions
    .filter((t) => t.isManual && isExpenseTx(t))
    .forEach((t) => {
      const date = toIsoDay(t.date);
      const isPaid = Boolean(t.isPaid);
      if (!shouldInclude(date, isPaid)) return;
      items.push({
        id: `manual_${t.id}`,
        date,
        title: t.originalDescription || t.description || 'Despesa manual',
        amount: Math.abs(Number(t.amount) || 0),
        type: 'manual',
        meta: 'Despesa manual',
        isPaid,
        sourceId: t.id,
      });
    });

  // Credit card bills
  if (creditCards.length && typeof getMerged === 'function') {
    try {
      const { transactions: cardTxs, bills: officialBills } = getMerged(creditIds);
      const built = buildCreditCardBills({
        transactions: cardTxs,
        officialBills,
        creditCards,
        selectedCardId: 'all',
      });
      Object.entries(built.bills || {}).forEach(([dueYm, bill]) => {
        const date = bill.dueDate ? toIsoDay(bill.dueDate) : `${dueYm}-10`;
        const isPaid = Boolean(bill.isPaid);
        if (!shouldInclude(date, isPaid)) return;
        const amount = Math.abs(Number(bill.total || 0));
        if (amount <= 0 && isPaid) return;
        items.push({
          id: `bill_${dueYm}`,
          date,
          title: `Fatura cartão (${formatDueMonthShort(dueYm, date)})`,
          amount,
          type: 'bill',
          meta: 'Fatura de cartão',
          isPaid,
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

  // Detected subscriptions — upcoming charge as "a pagar"
  const sources = expenseSources || transactions;
  detectSubscriptions(sources).forEach((sub) => {
    const date = toIsoDay(sub.nextDate);
    if (!date || !inWindow(date)) return;
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
