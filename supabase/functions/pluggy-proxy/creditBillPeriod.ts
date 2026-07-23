/**
 * Canonical credit-card bill period helpers.
 *
 * Pluggy semantics differ by bank — see docs/connectors/ and
 * src/utils/creditConnectors/profiles.js.
 *
 * We always index UI buckets by **due month** (YYYY-MM of bill.dueDate).
 */

import {
  resolveConnectorProfile,
  balanceLooksLikeTotalOutstanding,
} from './creditConnectors/profiles.ts';

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** @param {string} ym YYYY-MM @param {number} n months to add (can be negative) */
export function ymAdd(ym, n) {
  if (!ym || ym === 'Outros') return ym;
  let [y, m] = ym.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function ymFromIso(iso) {
  if (!iso) return null;
  return String(iso).slice(0, 7);
}

export function formatDueMonthTitle(dueYm) {
  if (!dueYm || dueYm === 'Outros') return 'Outros Lançamentos';
  const [y, m] = dueYm.split('-').map(Number);
  return `Fatura ${MONTHS_PT[m - 1]} de ${y}`;
}

/** @param {string} dueYm @param {string} [dueDateIso] real due date when known */
export function formatDueMonthShort(dueYm, dueDateIso) {
  if (dueDateIso && String(dueDateIso).length >= 10) {
    const [y, m, d] = String(dueDateIso).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  if (!dueYm || dueYm === 'Outros') return '';
  const [y, m] = dueYm.split('-');
  return `10/${m}/${y}`;
}

export function isBillPayment(tx) {
  const d = (tx?.description || '').toUpperCase();
  return d.includes('PAGAMENTO DE FATURA') || d.includes('PAGAMENTO RECEBIDO');
}

function billMapFromList(officialBills = []) {
  const map = {};
  for (const b of officialBills) {
    if (b?.id) map[b.id] = b;
  }
  return map;
}

/** Infer due YYYY-MM-DD for a due-month from the latest official bill's day. */
export function inferDueDateForMonth(dueYm, officialBills = []) {
  if (!dueYm || dueYm === 'Outros') return null;
  const sorted = officialBills
    .filter((b) => b?.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const day = sorted.length
    ? String(sorted.at(-1).dueDate).slice(8, 10)
    : '10';
  return `${dueYm}-${day}`;
}

/**
 * Fingerprint for an installment series (dedupe real vs projected).
 * Amount is intentionally excluded — Pluggy sometimes drifts by R$ 0.01.
 */
export function installmentSeriesKey(tx) {
  const meta = tx?.creditCardMetadata || {};
  if (meta.purchaseId) return `pid:${meta.purchaseId}`;
  const total = meta.totalInstallments || tx?.totalInstallmentsCount;
  if (!total) return null;
  return `${normalizeInstallmentDesc(tx.description)}|${total}`;
}

export function normalizeInstallmentDesc(description) {
  return String(description || '')
    .replace(/\s*\(?\s*Parcela\s+\d+\s*\/\s*\d+\s*\)?\s*$/i, '')
    .replace(/\s*\d+\s*\/\s*\d+\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function installmentNumberOf(tx) {
  return (
    tx?.creditCardMetadata?.installmentNumber ||
    tx?.currentInstallment ||
    null
  );
}

export function installmentTotalOf(tx) {
  return (
    tx?.creditCardMetadata?.totalInstallments ||
    tx?.totalInstallmentsCount ||
    null
  );
}

/** True if a real (or projected) tx already represents series installment n. */
export function hasInstallmentNumber(transactions, seriesKey, n) {
  for (const t of transactions) {
    if (isBillPayment(t)) continue;
    if (installmentSeriesKey(t) !== seriesKey) continue;
    if (installmentNumberOf(t) === n) return true;
  }
  return false;
}

export function sumCycleCharges(items = [], { includeProjected = false } = {}) {
  return items
    .filter((t) => !isBillPayment(t) && (includeProjected || !t.isProjected))
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
}

/**
 * Open-bill total: never use outstanding debt disguised as balance.
 */
export function resolveOpenBillTotal(account, cycleItems = [], profile) {
  const cycleSum = sumCycleCharges(cycleItems, { includeProjected: true });
  const preferCycle =
    (profile?.openTotalSource || 'cycle_charges') === 'cycle_charges' ||
    balanceLooksLikeTotalOutstanding(account) ||
    profile?.balanceMeaning === 'total_outstanding';

  if (preferCycle && cycleSum > 0) return cycleSum;
  if (account?.balance != null && !preferCycle) {
    return Math.abs(Number(account.balance) || 0);
  }
  if (cycleSum > 0) return cycleSum;
  // Last resort: only if balance is NOT total outstanding
  if (account?.balance != null && !balanceLooksLikeTotalOutstanding(account)) {
    return Math.abs(Number(account.balance) || 0);
  }
  return cycleSum;
}

/**
 * Infer how many months to add to billForecastDate to get due YYYY-MM.
 * Prefers transaction pairs (forecast + billId); falls back to close vs due on bills.
 * @returns {0|1}
 */
export function inferForecastToDueOffset(transactions = [], officialBills = []) {
  const billMap = billMapFromList(officialBills);
  let eqDue = 0;
  let eqDueMinus1 = 0;

  for (const t of transactions) {
    const fc = t.creditCardMetadata?.billForecastDate;
    const billId = t.creditCardMetadata?.billId || t.billId;
    if (!fc || !billId) continue;
    const bill = billMap[billId];
    if (!bill?.dueDate) continue;
    const dueYm = ymFromIso(bill.dueDate);
    if (fc === dueYm) eqDue += 1;
    if (fc === ymAdd(dueYm, -1)) eqDueMinus1 += 1;
  }

  if (eqDue + eqDueMinus1 > 0) {
    return eqDue >= eqDueMinus1 ? 0 : 1;
  }

  let sameMonth = 0;
  let diffMonth = 0;
  for (const b of officialBills) {
    const dueYm = ymFromIso(b.dueDate);
    const closeYm = ymFromIso(b.billClosingDate);
    if (!dueYm || !closeYm) continue;
    if (dueYm === closeYm) sameMonth += 1;
    else diffMonth += 1;
  }
  if (sameMonth + diffMonth > 0) {
    return sameMonth >= diffMonth ? 0 : 1;
  }

  // Safer default for BR retail cards (Nubank-like): forecast == due
  return 0;
}

/**
 * Canonical due-month key (YYYY-MM) for a credit-card transaction.
 */
export function getDueMonthKey(tx, officialBills = [], forecastToDueOffset = 0) {
  const billMap = Array.isArray(officialBills)
    ? billMapFromList(officialBills)
    : officialBills;

  const billId = tx.creditCardMetadata?.billId || tx.billId;
  if (billId && billMap[billId]?.dueDate) {
    return ymFromIso(billMap[billId].dueDate);
  }

  const fc = tx.creditCardMetadata?.billForecastDate;
  if (fc) return ymAdd(fc, forecastToDueOffset);

  if (tx.date) {
    // Last resort: treat posted month as due month when offset is 0;
    // when offset is 1 (Santander-like), purchase month ≈ forecast ≈ due−1.
    return forecastToDueOffset === 0
      ? ymFromIso(tx.date)
      : ymAdd(ymFromIso(tx.date), 1);
  }

  return 'Outros';
}

/**
 * Settled when payments[] cover the total, OR a payment tx on a later cycle
 * matches the bill total (Nubank often posts payment on the *next* statement).
 */
export function isBillSettled(bill, opts = {}) {
  if (!bill) return false;
  const total = Number(bill.totalAmount) || 0;
  const payments = bill.payments || [];
  if (payments.length) {
    const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (paid >= total - 0.05) return true;
  }

  const { transactions = [], officialBills = [], forecastToDueOffset = 0 } = opts;
  if (!total || !transactions.length) return false;

  const dueYm = ymFromIso(bill.dueDate);
  if (!dueYm) return false;
  const billDueDate = String(bill.dueDate).slice(0, 10);
  const billMap = billMapFromList(officialBills);
  const nextYm = ymAdd(dueYm, 1);

  for (const t of transactions) {
    if (!isBillPayment(t)) continue;
    const amt = Math.abs(Number(t.amount) || 0);
    if (Math.abs(amt - total) > 0.05) continue;
    const tDue = getDueMonthKey(t, billMap, forecastToDueOffset);
    const tDate = String(t.date || '').slice(0, 10);
    if (tDue === nextYm || tDue > dueYm || (tDate && tDate >= billDueDate)) {
      return true;
    }
  }
  return false;
}

/**
 * Due month of the currently open (or next) bill.
 *
 * When official bills exist, never reopen a cycle Pluggy already listed —
 * PENDING that maps into a closed due month is ignored (stale forecast).
 * Open = earliest PENDING after latest official due, else latestOfficial + 1.
 */
export function resolveOpenDueMonthKey({
  transactions = [],
  officialBills = [],
  forecastToDueOffset = 0,
  today = new Date(),
} = {}) {
  const billMap = billMapFromList(officialBills);
  const todayIso = today.toISOString().slice(0, 10);
  const settleOpts = { transactions, officialBills, forecastToDueOffset };

  const sortedBillDues = officialBills
    .map((b) => ymFromIso(b.dueDate))
    .filter(Boolean)
    .sort();
  const latestOfficialDue = sortedBillDues.at(-1) || null;

  // Rare: unpaid official bill still current (dueDate >= today)
  const unpaidOfficial = officialBills
    .filter(
      (b) =>
        b.dueDate &&
        !isBillSettled(b, settleOpts) &&
        String(b.dueDate).slice(0, 10) >= todayIso
    )
    .map((b) => ymFromIso(b.dueDate))
    .filter(Boolean)
    .sort();
  if (unpaidOfficial.length) return unpaidOfficial[0];

  const pendingDueMonths = new Set();
  for (const t of transactions) {
    if (t.status !== 'PENDING') continue;
    if (isBillPayment(t)) continue;
    const due = getDueMonthKey(t, billMap, forecastToDueOffset);
    if (!due || due === 'Outros') continue;
    // Never reopen a cycle Pluggy already closed as an official bill
    if (latestOfficialDue && due <= latestOfficialDue) continue;
    pendingDueMonths.add(due);
  }
  const pendingSorted = [...pendingDueMonths].sort();
  if (pendingSorted.length) return pendingSorted[0];

  if (latestOfficialDue) return ymAdd(latestOfficialDue, 1);

  // No official bills: any PENDING, then calendar month
  for (const t of transactions) {
    if (t.status !== 'PENDING' || isBillPayment(t)) continue;
    const due = getDueMonthKey(t, billMap, forecastToDueOffset);
    if (due && due !== 'Outros') pendingDueMonths.add(due);
  }
  const anyPending = [...pendingDueMonths].sort();
  if (anyPending.length) return anyPending[0];

  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * If open key still points at a settled official bill, advance to next month.
 */
export function ensureOpenNotSettled(openDueKey, officialBills, settleOpts) {
  let key = openDueKey;
  for (let i = 0; i < 24; i++) {
    const official = officialBills.find((b) => ymFromIso(b.dueDate) === key);
    if (!official || !isBillSettled(official, settleOpts)) return key;
    key = ymAdd(key, 1);
  }
  return key;
}

function offsetForAccount(accountId, transactions, officialBills, cache) {
  if (cache[accountId] != null) return cache[accountId];
  const txs = transactions.filter((t) => !accountId || t.accountId === accountId);
  const bills = officialBills.filter((b) => !accountId || b.accountId === accountId);
  const offset = inferForecastToDueOffset(txs.length ? txs : transactions, bills.length ? bills : officialBills);
  cache[accountId || '__all__'] = offset;
  return offset;
}

export function buildCreditCardBills({
  transactions = [],
  officialBills = [],
  creditCards = [],
  selectedCardId = 'all',
  today = new Date(),
} = {}) {
  const billMap = billMapFromList(officialBills);
  const offsetCache = {};
  const globalOffset = inferForecastToDueOffset(transactions, officialBills);

  // Open due first — needed to remap stale PENDING out of closed cycles
  const accountIds = [
    ...new Set([
      ...creditCards.map((c) => c.id),
      ...transactions.map((t) => t.accountId).filter(Boolean),
    ]),
  ];
  const openByAccount = {};
  const latestOfficialByAccount = {};
  for (const accountId of accountIds) {
    const offset = offsetForAccount(accountId, transactions, officialBills, offsetCache);
    const acctBills = officialBills.filter((b) => b.accountId === accountId);
    const acctTxs = transactions.filter((t) => t.accountId === accountId);
    const settleOpts = {
      transactions: acctTxs,
      officialBills: acctBills,
      forecastToDueOffset: offset,
    };
    let openKey = resolveOpenDueMonthKey({
      transactions: acctTxs,
      officialBills: acctBills,
      forecastToDueOffset: offset,
      today,
    });
    openKey = ensureOpenNotSettled(openKey, acctBills, settleOpts);
    openByAccount[accountId] = openKey;
    latestOfficialByAccount[accountId] =
      acctBills
        .map((b) => ymFromIso(b.dueDate))
        .filter(Boolean)
        .sort()
        .at(-1) || null;
  }
  const openCandidates = Object.values(openByAccount);
  let openDueKey = (openCandidates.length
    ? openCandidates
    : [
        resolveOpenDueMonthKey({
          transactions,
          officialBills,
          forecastToDueOffset: globalOffset,
          today,
        }),
      ]
  ).sort()[0];
  openDueKey = ensureOpenNotSettled(openDueKey, officialBills, {
    transactions,
    officialBills,
    forecastToDueOffset: globalOffset,
  });

  const dueKeyForTx = (t) => {
    const offset = offsetForAccount(t.accountId, transactions, officialBills, offsetCache);
    let key = getDueMonthKey(t, billMap, offset);
    const openForCard = openByAccount[t.accountId] || openDueKey;
    const latestOfficial = latestOfficialByAccount[t.accountId];
    // PENDING without billId that still map into a closed official cycle
    // belong to the open bill (wrong/stale billForecastDate from Pluggy)
    if (
      t.status === 'PENDING' &&
      !isBillPayment(t) &&
      !(t.creditCardMetadata?.billId || t.billId) &&
      latestOfficial &&
      key &&
      key !== 'Outros' &&
      key <= latestOfficial &&
      openForCard
    ) {
      return openForCard;
    }
    return key;
  };

  const map = {};

  // Seed buckets from official bills
  for (const b of officialBills) {
    const dueYm = ymFromIso(b.dueDate);
    if (!dueYm) continue;
    if (!map[dueYm]) {
      map[dueYm] = {
        dueMonthKey: dueYm,
        items: [],
        total: 0,
        dueDate: String(b.dueDate).slice(0, 10),
      };
    } else if (b.dueDate) {
      map[dueYm].dueDate = String(b.dueDate).slice(0, 10);
    }
  }

  // Group transactions by due month (per-account offset)
  for (const t of transactions) {
    const key = dueKeyForTx(t);
    if (!map[key]) {
      map[key] = {
        dueMonthKey: key,
        items: [],
        total: 0,
        dueDate: key === 'Outros' ? null : inferDueDateForMonth(key, officialBills),
      };
    }
    map[key].items.push(t);
  }

  if (!map[openDueKey]) {
    map[openDueKey] = {
      dueMonthKey: openDueKey,
      items: [],
      total: 0,
      dueDate: inferDueDateForMonth(openDueKey, officialBills),
    };
  }

  // Project missing installments only (never duplicate real N/M; never invent past cycles)
  const series = new Map();
  for (const t of transactions) {
    if (t.isProjected || isBillPayment(t)) continue;
    const total = installmentTotalOf(t);
    const num = installmentNumberOf(t);
    if (!total || !num) continue;
    const key = installmentSeriesKey(t);
    if (!key) continue;
    const due = dueKeyForTx(t);
    if (!due || due === 'Outros') continue;
    let entry = series.get(key);
    if (!entry) {
      entry = {
        total,
        maxNum: 0,
        maxDue: due,
        sample: t,
        accountId: t.accountId,
      };
      series.set(key, entry);
    }
    if (num >= entry.maxNum) {
      entry.maxNum = num;
      entry.maxDue = due;
      entry.sample = t;
    }
  }

  for (const [seriesKey, entry] of series) {
    const { total, maxNum, maxDue, sample, accountId } = entry;
    const openFor = openByAccount[accountId] || openDueKey;
    for (let n = maxNum + 1; n <= total; n++) {
      if (hasInstallmentNumber(transactions, seriesKey, n)) continue;
      const futureDue = ymAdd(maxDue, n - maxNum);
      // Do not project into already-closed cycles
      if (futureDue < openFor) continue;
      if (!map[futureDue]) {
        map[futureDue] = {
          dueMonthKey: futureDue,
          items: [],
          total: 0,
          dueDate: inferDueDateForMonth(futureDue, officialBills),
        };
      }
      if (hasInstallmentNumber(map[futureDue].items, seriesKey, n)) continue;
      const baseDesc = normalizeInstallmentDesc(sample.description);
      map[futureDue].items.push({
        ...sample,
        id: `proj_${sample.id}_${n}`,
        description: `${baseDesc} (Parcela ${n}/${total})`,
        creditCardMetadata: {
          ...(sample.creditCardMetadata || {}),
          installmentNumber: n,
          totalInstallments: total,
        },
        currentInstallment: n,
        totalInstallmentsCount: total,
        isProjected: true,
        status: 'PENDING',
        date: `${inferDueDateForMonth(futureDue, officialBills)}T00:00:00.000Z`,
      });
    }
  }

  const sortedDueKeys = Object.keys(map).filter((k) => k !== 'Outros').sort();

  const activeCards =
    selectedCardId === 'all'
      ? creditCards
      : creditCards.filter((c) => c.id === selectedCardId);

  const bills = {};
  for (const dueYm of sortedDueKeys) {
    const bucket = map[dueYm];
    let totalAmount = 0;
    let isPaid = true;
    let hasOfficial = false;
    let dueDate = bucket.dueDate || inferDueDateForMonth(dueYm, officialBills);

    const cardsForTotals = activeCards.length ? activeCards : [{ id: null }];

    for (const card of cardsForTotals) {
      const cardAcc = card.id ? creditCards.find((c) => c.id === card.id) : null;
      const profile = resolveConnectorProfile({
        account: cardAcc,
        connectorName: cardAcc?.connectorName || cardAcc?._connector,
        connectorId: cardAcc?.connectorId || cardAcc?._connectorId,
      });
      const official = officialBills.find(
        (b) =>
          (!card.id || b.accountId === card.id) &&
          ymFromIso(b.dueDate) === dueYm
      );

      const scopedItems = bucket.items.filter(
        (t) => !card.id || !t.accountId || t.accountId === card.id
      );

      if (official) {
        totalAmount += Number(official.totalAmount) || 0;
        hasOfficial = true;
        dueDate = String(official.dueDate).slice(0, 10);
        if (
          !isBillSettled(official, {
            transactions,
            officialBills,
            forecastToDueOffset: globalOffset,
          })
        ) {
          isPaid = false;
        }
      } else if (dueYm === (openByAccount[card.id] || openDueKey)) {
        const openTotal = resolveOpenBillTotal(cardAcc, scopedItems, profile);
        totalAmount += openTotal;
        if (openTotal > 0) isPaid = false;
      } else {
        // Past without official, or future: sum cycle charges (+ projections for future)
        const includeProjected = dueYm > openDueKey;
        const sumTxs = sumCycleCharges(scopedItems, { includeProjected });
        totalAmount += sumTxs;
        if (sumTxs > 0 && dueYm <= openDueKey) isPaid = false;
      }
    }

    if (!activeCards.length && !hasOfficial) {
      totalAmount = sumCycleCharges(bucket.items, {
        includeProjected: dueYm > openDueKey || dueYm === openDueKey,
      });
      if (totalAmount > 0 && dueYm <= openDueKey) isPaid = false;
    }

    let type = 'PAST';
    if (dueYm === openDueKey) type = 'CURRENT_OPEN';
    else if (dueYm > openDueKey) type = 'FUTURE';

    // Settled official bill can never be "Em Aberto"
    if (type === 'CURRENT_OPEN' && hasOfficial && isPaid) {
      type = 'PAST';
    }

    bills[dueYm] = {
      dueMonthKey: dueYm,
      monthKey: dueYm,
      items: bucket.items,
      total: totalAmount,
      dueDate,
      isPaid: type === 'FUTURE' ? false : isPaid,
      type,
      hasOfficial,
    };
  }

  return {
    forecastToDueOffset: globalOffset,
    openDueKey,
    sortedDueKeys,
    bills,
  };
}

/**
 * Compact open/last-paid summary for a single credit card (Telegram, KPIs).
 */
export function summarizeCardOpenBill(card, transactions = [], officialBills = []) {
  const txs = (transactions || []).map((t) => ({
    ...t,
    accountId: t.accountId || card.id,
  }));
  const bills = (officialBills || []).map((b) => ({
    ...b,
    accountId: b.accountId || card.id,
  }));

  const built = buildCreditCardBills({
    transactions: txs,
    officialBills: bills,
    creditCards: [card],
    selectedCardId: card.id,
  });

  const open = built.bills[built.openDueKey];
  const lastPaidKey = [...built.sortedDueKeys]
    .reverse()
    .find((k) => built.bills[k]?.isPaid && built.bills[k]?.type === 'PAST');
  const lastPaid = lastPaidKey ? built.bills[lastPaidKey] : null;
  const profile = resolveConnectorProfile({ account: card });

  return {
    openDueKey: built.openDueKey,
    openTitle: formatDueMonthTitle(built.openDueKey),
    openTotal: resolveOpenBillTotal(card, open?.items || [], profile),
    openDueDate: open?.dueDate || inferDueDateForMonth(built.openDueKey, bills),
    openItemCount: (open?.items || []).filter((t) => !t.isProjected && !isBillPayment(t)).length,
    lastPaidKey: lastPaidKey || null,
    lastPaidTitle: lastPaidKey ? formatDueMonthTitle(lastPaidKey) : null,
    lastPaidTotal: lastPaid ? lastPaid.total : null,
    lastPaidDueDate: lastPaid?.dueDate || null,
    creditLimit: card.creditData?.creditLimit ?? null,
    availableLimit: card.creditData?.availableCreditLimit ?? null,
    forecastToDueOffset: built.forecastToDueOffset,
    connectorProfileId: profile.id,
  };
}
