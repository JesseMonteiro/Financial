/**
 * receivables.js — Pure domain utilities for receivables (Valores a Receber)
 * 
 * Handles aggregation, grouping, 24-month continuous projections, sorting, and metrics.
 */

export const CONTINUOUS_PROJECTION_MONTHS = 24;

/**
 * Extracts up to two initials from a person's name.
 * @param {string} [name='']
 * @returns {string}
 */
export function getInitials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Extracts the ISO date key (YYYY-MM-DD) from an installment's due date.
 * @param {object} installment
 * @returns {string}
 */
export function dueKey(installment) {
  return String(installment?.dueDate || '').slice(0, 10);
}

/**
 * Finds the earliest unpaid due date from an installment history list.
 * @param {Array<object>} [installmentHistory=[]]
 * @returns {string|null}
 */
export function nextPendingDue(installmentHistory = []) {
  const pending = (installmentHistory || [])
    .filter((i) => !i.paidAt)
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  return pending[0]?.dueDate || null;
}

/**
 * Computes a sort key that puts entries with pending dues first (by earliest due date)
 * and settled entries at the end (by their last due date).
 * @param {object} rec
 * @returns {string}
 */
export function receivableSortKey(rec) {
  if (!rec) return '2';
  const pending = nextPendingDue(rec.installmentHistory);
  if (pending) return `0_${String(pending).slice(0, 10)}`;

  const lastDue = (rec.installmentHistory || [])
    .map(dueKey)
    .filter(Boolean)
    .sort()
    .pop();
  return `1_${lastDue || '9999-12-31'}`;
}

/**
 * Sorts an array of receivables according to their due status.
 * @param {Array<object>} [list=[]]
 * @returns {Array<object>}
 */
export function sortReceivablesByDue(list = []) {
  return [...list].sort((a, b) => receivableSortKey(a).localeCompare(receivableSortKey(b)));
}

/**
 * Calculates the effective total nominal amount of a receivable.
 * For continuous monthly items, projects 24 months.
 * For fixed items, returns the nominal total amount.
 * @param {object} rec
 * @returns {number}
 */
export function receivableEffectiveTotal(rec) {
  if (!rec) return 0;
  if (rec.isContinuous) {
    const monthly = rec.installmentHistory?.[0]?.amount ?? rec.originalTotalAmount ?? rec.totalAmount ?? 0;
    return Number(monthly) * CONTINUOUS_PROJECTION_MONTHS;
  }
  return Number(rec.totalAmount || 0);
}

/**
 * Computes progress stats (paid count, total count, paid amount, total amount, and percentage).
 * @param {object} rec
 * @returns {{ paidCount: number, totalCount: number, paidAmount: number, totalAmount: number, pct: number }}
 */
export function receivableProgress(rec) {
  if (!rec) return { paidCount: 0, totalCount: 0, paidAmount: 0, totalAmount: 0, pct: 0 };
  const history = rec.installmentHistory || [];
  const paidCount = history.filter((i) => i.paidAt).length;
  const totalCount = history.length;
  const paidAmount = history
    .filter((i) => i.paidAt)
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalAmount = receivableEffectiveTotal(rec);
  const pct = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

  return {
    paidCount,
    totalCount,
    paidAmount,
    totalAmount,
    pct,
  };
}

/**
 * Generates an installment history array for a receivable.
 * Supports both fixed-installment plans and continuous (24-month projected) recurrence.
 * 
 * @param {object} params
 * @param {number} params.totalAmount
 * @param {number} [params.installments=1]
 * @param {string} [params.firstDueDate] - YYYY-MM-DD
 * @param {boolean} [params.isContinuous=false]
 * @param {Array<object>} [params.existingHistory=[]]
 * @returns {Array<object>}
 */
export function generateReceivableInstallments({
  totalAmount = 0,
  installments = 1,
  firstDueDate,
  isContinuous = false,
  existingHistory = [],
} = {}) {
  const count = isContinuous
    ? CONTINUOUS_PROJECTION_MONTHS
    : Math.max(1, parseInt(installments, 10) || 1);
  const numAmount = Number(totalAmount) || 0;
  const installmentAmount = isContinuous ? numAmount : (numAmount / count);
  const startDateStr = firstDueDate || new Date().toISOString().slice(0, 10);

  return Array.from({ length: count }, (_, i) => {
    const dueDate = new Date(`${startDateStr}T12:00:00.000Z`);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + i);
    const existingInst = existingHistory?.find((inst) => inst.installmentNumber === i + 1);
    return {
      installmentNumber: i + 1,
      amount: installmentAmount,
      dueDate: dueDate.toISOString().slice(0, 10),
      paidAt: existingInst ? existingInst.paidAt : null,
    };
  });
}

/**
 * Computes pending, paid, total and percentage values for a single person's receivables.
 * @param {Array<object>} [receivables=[]]
 * @returns {{ pending: number, paid: number, total: number, pct: number }}
 */
export function personReceivableTotals(receivables = []) {
  let pending = 0;
  let paid = 0;

  (receivables || []).forEach((r) => {
    (r.installmentHistory || []).forEach((i) => {
      const amt = Number(i.amount) || 0;
      if (i.paidAt) {
        paid += amt;
      } else {
        pending += amt;
      }
    });
  });

  const total = pending + paid;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;
  return { pending, paid, total, pct };
}

/**
 * Aggregates high-level KPI metrics across all receivables.
 * @param {Array<object>} [receivables=[]]
 * @returns {{ totalToReceive: number, totalReceived: number, numPeople: number, nextDueDate: string|null }}
 */
export function summarizeReceivables(receivables = []) {
  let totalToReceive = 0;
  let totalReceived = 0;
  const peopleSet = new Set();
  let nextDueDate = null;

  (receivables || []).forEach((r) => {
    if (r.personName) {
      peopleSet.add(r.personName.trim().toLowerCase());
    }

    (r.installmentHistory || []).forEach((inst) => {
      const amt = Number(inst.amount) || 0;
      if (inst.paidAt) {
        totalReceived += amt;
      } else {
        totalToReceive += amt;
      }
    });

    const due = nextPendingDue(r.installmentHistory);
    if (due) {
      if (!nextDueDate || due < nextDueDate) {
        nextDueDate = due;
      }
    }
  });

  return {
    totalToReceive,
    totalReceived,
    numPeople: peopleSet.size,
    nextDueDate,
  };
}

/**
 * Groups receivables by person name, sorting each person's list and ordering the groups
 * by earliest pending due date.
 * 
 * @param {Array<object>} [receivables=[]]
 * @returns {Array<{ personName: string, personColor: string, receivables: Array<object> }>}
 */
export function groupReceivablesByPerson(receivables = []) {
  const map = {};

  (receivables || []).forEach((r) => {
    const key = r.personName || 'Sem Nome';
    if (!map[key]) {
      map[key] = {
        personName: key,
        personColor: r.personColor || '#6366f1',
        receivables: [],
      };
    }
    map[key].receivables.push(r);
  });

  const groups = Object.values(map);
  groups.forEach((g) => {
    g.receivables = sortReceivablesByDue(g.receivables);
  });

  return groups.sort((a, b) => {
    const keyA = a.receivables[0] ? receivableSortKey(a.receivables[0]) : '2';
    const keyB = b.receivables[0] ? receivableSortKey(b.receivables[0]) : '2';
    return keyA.localeCompare(keyB) || a.personName.localeCompare(b.personName);
  });
}

/**
 * Computes total reimbursements received in a given year-month (YYYY-MM).
 * @param {Array<object>} [receivables=[]]
 * @param {string} ym - YYYY-MM
 * @returns {number}
 */
export function reimbursementsReceivedInMonth(receivables = [], ym) {
  if (!ym) return 0;
  return (receivables || []).reduce((total, r) => {
    const monthPaid = (r.installmentHistory || [])
      .filter((i) => i.paidAt && String(i.paidAt).slice(0, 7) === ym)
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    return total + monthPaid;
  }, 0);
}
