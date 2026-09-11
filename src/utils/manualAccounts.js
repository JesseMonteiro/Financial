/**
 * Hydrate a `manual_accounts` row into the same shape used for Pluggy accounts.
 */

export function hydrateManualAccount(row = {}) {
  const type = row.type === 'CREDIT' ? 'CREDIT' : 'BANK';
  const institution = row.institutionName || row.institution_name || '';
  const billAmount = Number(row.billAmount ?? row.bill_amount);
  const safeBill = Number.isFinite(billAmount) ? billAmount : 0;
  const rawBalance = Number(row.balance);
  const bankBalance = Number.isFinite(rawBalance) ? rawBalance : 0;
  const balance = type === 'CREDIT' ? safeBill : bankBalance;
  const dueDayRaw = row.billDueDay ?? row.bill_due_day;
  const dueDay = dueDayRaw == null || dueDayRaw === '' ? null : Number(dueDayRaw);
  const creditLimit = Number(row.creditLimit ?? row.credit_limit) || 0;
  const name = row.name || (type === 'CREDIT' ? 'Cartão manual' : 'Conta manual');

  return {
    id: row.id,
    itemId: null,
    type,
    name,
    originalName: name,
    number: row.number || '',
    balance,
    marketingName: institution,
    updatedAt: row.updatedAt || row.updated_at || null,
    isManual: true,
    pairId: row.pairId || row.pair_id || null,
    billAmount: type === 'CREDIT' ? (Number.isFinite(billAmount) ? billAmount : null) : null,
    billDueDay: Number.isFinite(dueDay) ? dueDay : null,
    userId: row.userId || row.user_id || null,
    ownerUserId: row.ownerUserId || row.userId || row.user_id || null,
    ownerLabel: row.ownerLabel || null,
    bankData: type === 'BANK' ? { institutionName: institution || 'Manual' } : undefined,
    creditData:
      type === 'CREDIT'
        ? {
            institutionName: institution || 'Manual',
            creditLimit,
            availableCreditLimit: creditLimit > 0 ? Math.max(0, creditLimit - safeBill) : 0,
          }
        : undefined,
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Next due YYYY-MM-DD from a day-of-month (1–31). If today is past that day, use next month. */
export function nextDueDateFromDay(dueDay, today = new Date()) {
  const day = Math.min(31, Math.max(1, Number(dueDay) || 10));
  let year = today.getFullYear();
  let month = today.getMonth();
  if (today.getDate() > day) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  const clamped = Math.min(day, lastDayOfMonth(year, month));
  return `${year}-${pad2(month + 1)}-${pad2(clamped)}`;
}

export function previousYearMonth(ym) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return ym;
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${pad2(m - 1)}`;
}

/** Synthetic Pluggy-like official bill for a manual credit card. */
export function syntheticManualBill(card, today = new Date()) {
  if (!card?.id) return null;
  const dueDate = nextDueDateFromDay(card.billDueDay, today);
  const total = Number(card.billAmount ?? card.balance) || 0;
  return {
    id: `manual-bill-${card.id}-${dueDate.slice(0, 7)}`,
    accountId: card.id,
    dueDate,
    totalAmount: total,
    isManual: true,
  };
}

export function toManualAccountRow(acc, userId) {
  const type = acc.type === 'CREDIT' ? 'CREDIT' : 'BANK';
  return {
    id: acc.id,
    user_id: userId,
    type,
    name: acc.name,
    institution_name: acc.institutionName
      || acc.bankData?.institutionName
      || acc.creditData?.institutionName
      || '',
    number: acc.number || null,
    balance: type === 'BANK' ? Number(acc.balance) || 0 : 0,
    bill_amount: type === 'CREDIT' ? (acc.billAmount == null ? Number(acc.balance) || 0 : Number(acc.billAmount) || 0) : null,
    bill_due_day: type === 'CREDIT' && acc.billDueDay != null ? Number(acc.billDueDay) : null,
    credit_limit: type === 'CREDIT' ? (Number(acc.creditLimit ?? acc.creditData?.creditLimit) || null) : null,
    pair_id: acc.pairId || null,
    updated_at: new Date().toISOString(),
  };
}

export function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function manualSeriesLength(txData = {}) {
  const isRecurring = Boolean(txData.isRecurring);
  const isContinuous = isRecurring && Boolean(txData.isContinuous);
  if (!isRecurring) return 1;
  if (isContinuous) return 24;
  return Math.max(1, parseInt(txData.occurrences, 10) || 12);
}

/**
 * Parcelada (>1) splits `total` across occurrences. Single/recurring-continuous
 * keep the same amount on every occurrence.
 */
export function splitManualTotal(total, txData = {}) {
  const n = manualSeriesLength(txData);
  const abs = Math.abs(Number(total) || 0);
  const isRecurring = Boolean(txData.isRecurring);
  const isContinuous = isRecurring && Boolean(txData.isContinuous);
  if (!isRecurring || isContinuous || n <= 1) {
    return Array.from({ length: n }, () => roundMoney(abs));
  }
  const per = roundMoney(abs / n);
  const parts = Array.from({ length: n }, () => per);
  parts[n - 1] = roundMoney(abs - per * (n - 1));
  return parts;
}

export function previewInstallmentSplit(total, txData = {}) {
  const isRecurring = Boolean(txData.isRecurring);
  const isContinuous = isRecurring && Boolean(txData.isContinuous);
  if (!isRecurring || isContinuous) return null;
  const parts = splitManualTotal(total, txData);
  if (parts.length <= 1) return null;
  const per = parts[0];
  const last = parts[parts.length - 1];
  return {
    count: parts.length,
    per,
    last,
    lastDiffers: Math.abs(last - per) > 0.001,
  };
}

export function totalFromStoredInstallments(installments = [], { isRecurring, isContinuous } = {}) {
  const amounts = installments.map((t) => Math.abs(Number(t.amount) || 0));
  if (!amounts.length) return 0;
  if (isRecurring && !isContinuous && amounts.length > 1) {
    return roundMoney(amounts.reduce((sum, value) => sum + value, 0));
  }
  return roundMoney(amounts[0]);
}
