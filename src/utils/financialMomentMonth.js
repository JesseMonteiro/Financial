import {
  buildCreditCardBills,
  isBillPayment,
  isBillSettled,
  sumCycleCharges,
  resolveOfficialBillTotal,
  MONTHS_PT,
  ymAdd,
} from './creditBillPeriod.js';
import { resolveConnectorProfile } from './creditConnectors/profiles.js';
import { resolveMonthSalary } from './monthSalary.js';
import { automaticDebitsForMonth, isAutomaticDebitPending } from './analytics.js';

/** Build rolling 12-month list centered around today (−6 … +5). */
export function buildFinancialMomentMonthList(baseDate = new Date()) {
  const list = [];
  for (let i = -6; i <= 5; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    list.push({
      ym,
      label: `${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return list;
}

/**
 * Amount for one card in a due-month — never use outstanding balance.
 */
export function cardBillAmountForMonth({
  card,
  ym,
  cardBills = [],
  cardTransactions = [],
  creditBillPeriod,
}) {
  const cardId = String(card.id || '');
  const openKey = String(
    creditBillPeriod?.openByAccount?.[String(cardId)]
      || creditBillPeriod?.openByAccount?.[cardId]
      || creditBillPeriod?.openDueKey
      || ''
  );
  const rawMatchingBill = cardBills.find(
    (b) =>
      String(b.accountId || b.account_id || '') === cardId &&
      String(b.dueDate || b.due_date || '').startsWith(ym)
  );
  const matchingBill = rawMatchingBill
    ? {
        ...rawMatchingBill,
        accountId: rawMatchingBill.accountId || rawMatchingBill.account_id,
        dueDate: rawMatchingBill.dueDate || rawMatchingBill.due_date,
        totalAmount:
          rawMatchingBill.totalAmount != null
            ? rawMatchingBill.totalAmount
            : rawMatchingBill.total_amount,
        isPaid:
          rawMatchingBill.isPaid != null
            ? rawMatchingBill.isPaid
            : rawMatchingBill.is_paid,
      }
    : null;
  const periodBill = creditBillPeriod?.bills?.[ym];
  const scoped = (periodBill?.items || []).filter(
    (t) => (!t.accountId || String(t.accountId) === cardId) && !isBillPayment(t)
  );

  if (matchingBill) {
    const profile = resolveConnectorProfile({ account: card });
    const chargeSumMode = profile.chargeSumMode || 'signed_net';
    let amount = resolveOfficialBillTotal(matchingBill, scoped, {
      chargeSumMode,
      liftOfficialToCycleCharges: Boolean(profile.liftOfficialToCycleCharges),
      includeProjectedInOfficialTotal: profile.includeProjectedInOfficialTotal !== false,
      ignoreUnbackedOfficial: Boolean(openKey) && ym > openKey,
    });
    // Future leftover official totals (Inter 50.67 with 0 txs) must not hide
    // pending/projected cycle charges for that due month.
    if (openKey && ym > openKey) {
      const cycleAmount = sumCycleCharges(scoped, {
        includeProjected: true,
        chargeSumMode,
      });
      if (cycleAmount > amount + 0.05) amount = cycleAmount;
    }
    if (!(amount <= 0.05 && openKey && ym > openKey)) {
      let isPaid =
        matchingBill.isPaid === true ||
        matchingBill.status === 'PAID' ||
        isBillSettled(matchingBill, {
          transactions: cardTransactions.filter(
            (t) => !t.accountId || String(t.accountId) === cardId
          ),
          officialBills: cardBills.filter(
            (b) => String(b.accountId || b.account_id || '') === cardId
          ),
          forecastToDueOffset: creditBillPeriod?.forecastToDueOffset || 0,
        });
      if (!isPaid && openKey) {
        const unpaidCutoff = ymAdd(openKey, -2);
        if (ym < unpaidCutoff) isPaid = true;
      }
      return {
        amount,
        dueDate: matchingBill.dueDate || matchingBill.due_date,
        isPaid,
        isFallback: false,
      };
    }
  }

  if (!periodBill) return null;

  const includeProjected = !openKey || ym >= openKey;
  const amount = sumCycleCharges(scoped, { includeProjected });
  if (amount <= 0) return null;

  const isPaid = Boolean(openKey) && ym < openKey;

  return {
    amount,
    dueDate: periodBill.dueDate || `${ym}-10`,
    isPaid,
    isFallback: true,
  };
}

/**
 * Pure month aggregation for Momento Financeiro (solo or joint).
 * @param {object} opts
 * @param {string} opts.selectedMonth YYYY-MM
 * @param {number} [opts.salary] Pre-resolved salary total (use for joint sum)
 * @param {Record<string, number>} [opts.salaries] Solo salary map (ignored if salary provided)
 * @param {Array} opts.receivables
 * @param {Array} opts.transactions All txs including manuals
 * @param {Array} opts.creditCards
 * @param {Array} opts.cardBills
 * @param {Array} opts.cardTransactions
 * @param {string[]} opts.bankAccountIds
 * @param {Record<string, string>} [opts.bankAccountNameById]
 * @param {object} [opts.creditBillPeriod] Optional prebuilt; otherwise computed
 */
export function computeFinancialMomentMonth({
  selectedMonth,
  salary: salaryOverride,
  salaries = {},
  receivables = [],
  transactions = [],
  creditCards = [],
  cardBills = [],
  cardTransactions = [],
  bankAccountIds = [],
  bankAccountNameById = {},
  creditBillPeriod: periodIn,
}) {
  if (!selectedMonth) return null;

  const normalizedCardBills = cardBills.map((b) => ({
    ...b,
    accountId: b.accountId || b.account_id,
    dueDate: b.dueDate || b.due_date,
    totalAmount: b.totalAmount != null ? b.totalAmount : b.total_amount,
    isPaid: b.isPaid != null ? b.isPaid : b.is_paid,
  }));

  const creditBillPeriod =
    periodIn ||
    buildCreditCardBills({
      transactions: cardTransactions,
      officialBills: normalizedCardBills,
      creditCards,
      selectedCardId: 'all',
    });

  const salary =
    salaryOverride != null
      ? Number(salaryOverride) || 0
      : resolveMonthSalary(salaries, selectedMonth);

  const activeReceivables = [];
  let receivablesTotal = 0;

  receivables.forEach((r) => {
    (r.installmentHistory || r.installment_history || []).forEach((inst) => {
      const due = String(inst.dueDate || inst.due_date || '');
      if (due.startsWith(selectedMonth)) {
        activeReceivables.push({
          id: r.id,
          personName: r.personName || r.person_name,
          personColor: r.personColor || r.person_color,
          description: r.description,
          amount: Number(inst.amount) || 0,
          installmentNumber: inst.installmentNumber ?? inst.installment_number,
          totalInstallments: r.installments ?? r.total_installments,
          paidAt: inst.paidAt || inst.paid_at || null,
          ownerUserId: r.ownerUserId || r.owner_user_id || r.userId || r.user_id,
          ownerLabel: r.ownerLabel || r.owner_label,
        });
        receivablesTotal += Number(inst.amount) || 0;
      }
    });
  });

  const entriesTotal = salary + receivablesTotal;

  const activeBills = [];
  let creditCardsTotal = 0;

  creditCards.forEach((card) => {
    const cardId = String(card.id || '');
    // Per-card period so joint settlement matches solo Momento for the same card.
    const cardPeriod = buildCreditCardBills({
      transactions: cardTransactions.filter(
        (t) => !t.accountId || String(t.accountId) === cardId
      ),
      officialBills: normalizedCardBills.filter(
        (b) => String(b.accountId || b.account_id || '') === cardId
      ),
      creditCards: [card],
      selectedCardId: card.id,
    });
    const bill = cardBillAmountForMonth({
      card,
      ym: selectedMonth,
      cardBills: normalizedCardBills,
      cardTransactions,
      creditBillPeriod: cardPeriod,
    });
    if (!bill) return;
    activeBills.push({
      cardId: card.id,
      cardName: card.name || card.account_name || card.accountName || 'Cartão',
      dueDate: bill.dueDate,
      amount: bill.amount,
      isPaid: bill.isPaid,
      isFallback: bill.isFallback,
      ownerUserId: card.ownerUserId || card.owner_user_id || card.userId || card.user_id,
      ownerLabel: card.ownerLabel || card.owner_label,
    });
    creditCardsTotal += bill.amount;
  });

  const isManualTx = (t) => t.isManual === true || t.is_manual === true;
  const txDateStr = (t) => String(t.date || t.dueDate || t.due_date || '');
  const isTxPaid = (t) => t.isPaid === true || t.is_paid === true;

  const activeManual = transactions.filter(
    (t) => isManualTx(t) && txDateStr(t).startsWith(selectedMonth)
  );
  const manualExpensesTotal = activeManual.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

  const activeAutomaticDebits = automaticDebitsForMonth(transactions, selectedMonth, {
    bankAccountIds,
  }).map((t) => ({
    ...t,
    accountName: bankAccountNameById[t.accountId] || 'Conta conectada',
    amountAbs: Math.abs(Number(t.amount) || 0),
    isPending: isAutomaticDebitPending(t),
  }));
  const automaticDebitsTotal = activeAutomaticDebits.reduce((s, t) => s + t.amountAbs, 0);

  const unpaidBills = activeBills.filter((b) => !b.isPaid);
  const unpaidManual = activeManual.filter((t) => !isTxPaid(t));
  const unpaidAutomaticDebits = activeAutomaticDebits.filter((t) => t.isPending);
  const unpaidCreditTotal = unpaidBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const unpaidManualTotal = unpaidManual.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const unpaidAutomaticDebitsTotal = unpaidAutomaticDebits.reduce((s, t) => s + t.amountAbs, 0);
  const accountsPayableTotal = unpaidCreditTotal + unpaidManualTotal + unpaidAutomaticDebitsTotal;

  const expensesTotal = creditCardsTotal + manualExpensesTotal + automaticDebitsTotal;
  const netBalance = entriesTotal - expensesTotal;

  return {
    salary,
    activeReceivables,
    receivablesTotal,
    entriesTotal,
    activeBills,
    creditCardsTotal,
    activeManual,
    manualExpensesTotal,
    activeAutomaticDebits,
    automaticDebitsTotal,
    unpaidBills,
    unpaidManual,
    unpaidAutomaticDebits,
    unpaidCreditTotal,
    unpaidManualTotal,
    unpaidAutomaticDebitsTotal,
    accountsPayableTotal,
    expensesTotal,
    netBalance,
    creditBillPeriod,
  };
}

/**
 * Net status per month for the chip strip.
 * @param {object} opts same shape as compute + monthList + optional resolveSalary(ym)=>number
 */
export function computeFinancialMomentMonthsStatus({
  monthList = [],
  salaries = {},
  resolveSalary,
  receivables = [],
  transactions = [],
  creditCards = [],
  cardBills = [],
  cardTransactions = [],
  bankAccountIds = [],
  creditBillPeriod: periodIn,
  skipWhileLoading = false,
}) {
  const statuses = {};
  if (skipWhileLoading) return statuses;

  const normalizedCardBills = cardBills.map((b) => ({
    ...b,
    accountId: b.accountId || b.account_id,
    dueDate: b.dueDate || b.due_date,
    totalAmount: b.totalAmount != null ? b.totalAmount : b.total_amount,
    isPaid: b.isPaid != null ? b.isPaid : b.is_paid,
  }));

  // One period per card: mixing every joint card into a single buildCreditCardBills
  // collides installment series and drops future projections (iOS surplus too high).
  const periodByCardId = new Map();
  for (const card of creditCards) {
    const cardId = String(card.id || '');
    if (!cardId || periodByCardId.has(cardId)) continue;
    periodByCardId.set(
      cardId,
      buildCreditCardBills({
        transactions: cardTransactions.filter(
          (t) => !t.accountId || String(t.accountId) === cardId
        ),
        officialBills: normalizedCardBills.filter(
          (b) => String(b.accountId || b.account_id || '') === cardId
        ),
        creditCards: [card],
        selectedCardId: card.id,
      })
    );
  }
  const sharedPeriod =
    periodIn ||
    buildCreditCardBills({
      transactions: cardTransactions,
      officialBills: normalizedCardBills,
      creditCards,
      selectedCardId: 'all',
    });

  monthList.forEach((m) => {
    const ym = m.ym;
    const salary =
      typeof resolveSalary === 'function'
        ? resolveSalary(ym)
        : resolveMonthSalary(salaries, ym);

    let receivablesTotal = 0;
    receivables.forEach((r) => {
      (r.installmentHistory || r.installment_history || []).forEach((inst) => {
        const due = inst.dueDate || inst.due_date || '';
        if (String(due).startsWith(ym)) {
          receivablesTotal += Number(inst.amount) || 0;
        }
      });
    });

    const entriesTotal = salary + receivablesTotal;

    let creditCardsTotal = 0;
    creditCards.forEach((card) => {
      const cardId = String(card.id || '');
      const bill = cardBillAmountForMonth({
        card,
        ym,
        cardBills: normalizedCardBills,
        cardTransactions,
        creditBillPeriod: periodByCardId.get(cardId) || sharedPeriod,
      });
      if (bill) creditCardsTotal += bill.amount;
    });

    const manualExpensesTotal = transactions
      .filter((t) => (t.isManual === true || t.is_manual === true) && String(t.date || t.dueDate || t.due_date || '').startsWith(ym))
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

    const automaticDebitsTotal = automaticDebitsForMonth(transactions, ym, {
      bankAccountIds,
    }).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

    const expensesTotal = creditCardsTotal + manualExpensesTotal + automaticDebitsTotal;
    const netVal = entriesTotal - expensesTotal;

    statuses[ym] = {
      isPositive: netVal >= 0,
      net: netVal,
    };
  });

  return statuses;
}
