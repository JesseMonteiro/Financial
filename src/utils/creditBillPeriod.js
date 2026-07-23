/**
 * Canonical credit-card bill period helpers.
 *
 * Pluggy `billForecastDate` semantics differ by connector:
 * - Nubank / Mercado Pago: forecast month === due month (offset 0)
 * - Santander (typical): forecast month === due month − 1 (offset 1)
 *
 * We always index UI buckets by **due month** (YYYY-MM of bill.dueDate).
 */

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

export function formatDueMonthShort(dueYm) {
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

function isBillSettled(bill) {
  if (!bill) return false;
  const paid = (bill.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const total = Number(bill.totalAmount) || 0;
  if ((bill.payments || []).length === 0) return false;
  // Allow small rounding differences
  return paid >= total - 0.05;
}

/**
 * Due month of the currently open (or next) bill.
 */
export function resolveOpenDueMonthKey({
  transactions = [],
  officialBills = [],
  forecastToDueOffset = 0,
  today = new Date(),
} = {}) {
  const pendingDueMonths = new Set();
  for (const t of transactions) {
    if (t.status !== 'PENDING') continue;
    if (isBillPayment(t)) continue;
    const due = getDueMonthKey(t, officialBills, forecastToDueOffset);
    if (due && due !== 'Outros') pendingDueMonths.add(due);
  }
  const pendingSorted = [...pendingDueMonths].sort();
  if (pendingSorted.length) return pendingSorted[0];

  const todayIso = today.toISOString().slice(0, 10);
  const unpaidFuture = officialBills
    .filter((b) => b.dueDate && !isBillSettled(b) && String(b.dueDate).slice(0, 10) >= todayIso)
    .map((b) => ymFromIso(b.dueDate))
    .filter(Boolean)
    .sort();
  if (unpaidFuture.length) return unpaidFuture[0];

  const latestDue = officialBills
    .map((b) => ymFromIso(b.dueDate))
    .filter(Boolean)
    .sort()
    .at(-1);
  if (latestDue) return ymAdd(latestDue, 1);

  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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

  const dueKeyForTx = (t) => {
    const offset = offsetForAccount(t.accountId, transactions, officialBills, offsetCache);
    return getDueMonthKey(t, billMap, offset);
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
        dueDate: key === 'Outros' ? null : `${key}-10`,
      };
    }
    map[key].items.push(t);
  }

  // Open due: earliest among per-card open keys (when consolidating)
  const accountIds = [
    ...new Set([
      ...creditCards.map((c) => c.id),
      ...transactions.map((t) => t.accountId).filter(Boolean),
    ]),
  ];
  const openByAccount = {};
  for (const accountId of accountIds) {
    const offset = offsetForAccount(accountId, transactions, officialBills, offsetCache);
    openByAccount[accountId] = resolveOpenDueMonthKey({
      transactions: transactions.filter((t) => t.accountId === accountId),
      officialBills: officialBills.filter((b) => b.accountId === accountId),
      forecastToDueOffset: offset,
      today,
    });
  }
  const openCandidates = Object.values(openByAccount);
  const openDueKey = (openCandidates.length
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

  if (!map[openDueKey]) {
    map[openDueKey] = {
      dueMonthKey: openDueKey,
      items: [],
      total: 0,
      dueDate: `${openDueKey}-10`,
    };
  }

  // Project installments using per-tx due keys
  const openItems = map[openDueKey]?.items || [];
  const installmentsSource = [
    ...openItems.filter((t) => !t.isProjected),
    ...transactions.filter(
      (t) =>
        t.status === 'PENDING' &&
        t.creditCardMetadata?.totalInstallments &&
        t.creditCardMetadata?.installmentNumber < t.creditCardMetadata.totalInstallments
    ),
  ];
  const seenInst = new Set();
  for (const t of installmentsSource) {
    if (seenInst.has(t.id)) continue;
    seenInst.add(t.id);
    const meta = t.creditCardMetadata;
    if (!meta?.totalInstallments || !meta?.installmentNumber) continue;
    if (meta.installmentNumber >= meta.totalInstallments) continue;
    const baseDue = dueKeyForTx(t);
    if (!baseDue || baseDue === 'Outros') continue;
    const remaining = meta.totalInstallments - meta.installmentNumber;
    for (let step = 1; step <= remaining; step++) {
      const futureDue = ymAdd(baseDue, step);
      if (!map[futureDue]) {
        map[futureDue] = {
          dueMonthKey: futureDue,
          items: [],
          total: 0,
          dueDate: `${futureDue}-10`,
        };
      }
      const projId = `proj_${t.id}_${futureDue}`;
      if (map[futureDue].items.some((e) => e.id === projId)) continue;
      map[futureDue].items.push({
        ...t,
        id: projId,
        description: `${t.description} (Parcela ${meta.installmentNumber + step}/${meta.totalInstallments})`,
        currentInstallment: meta.installmentNumber + step,
        totalInstallmentsCount: meta.totalInstallments,
        isProjected: true,
        date: `${futureDue}-10T00:00:00.000Z`,
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
    let dueDate = bucket.dueDate || `${dueYm}-10`;

    const cardsForTotals = activeCards.length ? activeCards : [{ id: null }];

    for (const card of cardsForTotals) {
      const official = officialBills.find(
        (b) =>
          (!card.id || b.accountId === card.id) &&
          ymFromIso(b.dueDate) === dueYm
      );

      if (official) {
        totalAmount += Number(official.totalAmount) || 0;
        hasOfficial = true;
        dueDate = String(official.dueDate).slice(0, 10);
        if (!isBillSettled(official)) isPaid = false;
      } else if (dueYm === (openByAccount[card.id] || openDueKey) && card.id) {
        // Open cycle without official bill: Pluggy account.balance is the source of truth
        const cardAcc = creditCards.find((c) => c.id === card.id);
        if (cardAcc && cardAcc.balance != null) {
          totalAmount += Math.abs(Number(cardAcc.balance) || 0);
          isPaid = false;
        } else {
          const cardTxs = bucket.items.filter(
            (t) => t.accountId === card.id && !isBillPayment(t) && !t.isProjected
          );
          totalAmount += cardTxs.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
          if (totalAmount > 0) isPaid = false;
        }
      } else if (dueYm === openDueKey && !card.id) {
        const cardTxs = bucket.items.filter(
          (t) => !isBillPayment(t) && !t.isProjected
        );
        totalAmount += cardTxs.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
        if (totalAmount > 0) isPaid = false;
      } else {
        const cardTxs = bucket.items.filter(
          (t) =>
            (!card.id || t.accountId === card.id) &&
            !isBillPayment(t) &&
            (dueYm > openDueKey ? true : !t.isProjected)
        );
        const sumTxs = cardTxs.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
        totalAmount += sumTxs;
        if (sumTxs > 0 && dueYm <= openDueKey) isPaid = false;
      }
    }

    if (!activeCards.length && !hasOfficial) {
      totalAmount = bucket.items
        .filter((t) => !isBillPayment(t) && !t.isProjected)
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
      if (totalAmount > 0 && dueYm <= openDueKey) isPaid = false;
    }

    let type = 'PAST';
    if (dueYm === openDueKey) type = 'CURRENT_OPEN';
    else if (dueYm > openDueKey) type = 'FUTURE';

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

  return {
    openDueKey: built.openDueKey,
    openTitle: formatDueMonthTitle(built.openDueKey),
    openTotal: Math.abs(Number(card.balance) || Number(open?.total) || 0),
    openDueDate: open?.dueDate || `${built.openDueKey}-10`,
    openItemCount: (open?.items || []).filter((t) => !t.isProjected && !isBillPayment(t)).length,
    lastPaidKey: lastPaidKey || null,
    lastPaidTitle: lastPaidKey ? formatDueMonthTitle(lastPaidKey) : null,
    lastPaidTotal: lastPaid ? lastPaid.total : null,
    lastPaidDueDate: lastPaid?.dueDate || null,
    creditLimit: card.creditData?.creditLimit ?? null,
    availableLimit: card.creditData?.availableCreditLimit ?? null,
    forecastToDueOffset: built.forecastToDueOffset,
  };
}
