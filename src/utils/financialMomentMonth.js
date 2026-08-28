import {
  buildCreditCardBills,
  isBillPayment,
  isBillSettled,
  sumCycleCharges,
  resolveOfficialBillTotal,
  MONTHS_PT,
} from './creditBillPeriod';
import { resolveConnectorProfile } from './creditConnectors/profiles';
import { resolveMonthSalary } from './monthSalary';
import { automaticDebitsForMonth, isAutomaticDebitPending } from './analytics';

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
  const matchingBill = cardBills.find(
    (b) => b.accountId === card.id && String(b.dueDate || '').startsWith(ym)
  );
  const periodBill = creditBillPeriod?.bills?.[ym];
  const scoped = (periodBill?.items || []).filter(
    (t) => (!t.accountId || t.accountId === card.id) && !isBillPayment(t)
  );

  if (matchingBill) {
    const profile = resolveConnectorProfile({ account: card });
    const amount = resolveOfficialBillTotal(matchingBill, scoped, {
      chargeSumMode: profile.chargeSumMode || 'signed_net',
      liftOfficialToCycleCharges: Boolean(profile.liftOfficialToCycleCharges),
    });
    return {
      amount,
      dueDate: matchingBill.dueDate,
      isPaid: isBillSettled(matchingBill, {
        transactions: cardTransactions,
        officialBills: cardBills,
        forecastToDueOffset: creditBillPeriod?.forecastToDueOffset || 0,
      }),
      isFallback: false,
    };
  }

  if (!periodBill) return null;

  const openKey = creditBillPeriod.openDueKey;
  const includeProjected = ym >= openKey;
  const amount = sumCycleCharges(scoped, { includeProjected });
  if (amount <= 0) return null;

  return {
    amount,
    dueDate: periodBill.dueDate || `${ym}-10`,
    isPaid: false,
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

  const creditBillPeriod =
    periodIn ||
    buildCreditCardBills({
      transactions: cardTransactions,
      officialBills: cardBills,
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
    (r.installmentHistory || []).forEach((inst) => {
      if ((inst.dueDate || '').startsWith(selectedMonth)) {
        activeReceivables.push({
          personName: r.personName,
          personColor: r.personColor,
          description: r.description,
          amount: inst.amount,
          installmentNumber: inst.installmentNumber,
          totalInstallments: r.installments,
          paidAt: inst.paidAt,
          ownerUserId: r.ownerUserId || r.userId,
          ownerLabel: r.ownerLabel,
        });
        receivablesTotal += inst.amount;
      }
    });
  });

  const entriesTotal = salary + receivablesTotal;

  const activeBills = [];
  let creditCardsTotal = 0;

  creditCards.forEach((card) => {
    const bill = cardBillAmountForMonth({
      card,
      ym: selectedMonth,
      cardBills,
      cardTransactions,
      creditBillPeriod,
    });
    if (!bill) return;
    activeBills.push({
      cardName: card.name,
      dueDate: bill.dueDate,
      amount: bill.amount,
      isPaid: bill.isPaid,
      isFallback: bill.isFallback,
      ownerUserId: card.ownerUserId,
      ownerLabel: card.ownerLabel,
    });
    creditCardsTotal += bill.amount;
  });

  const activeManual = transactions.filter(
    (t) => t.isManual === true && t.date?.startsWith(selectedMonth)
  );
  const manualExpensesTotal = activeManual.reduce((s, t) => s + Math.abs(t.amount), 0);

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
  const unpaidManual = activeManual.filter((t) => !t.isPaid);
  const unpaidAutomaticDebits = activeAutomaticDebits.filter((t) => t.isPending);
  const unpaidCreditTotal = unpaidBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const unpaidManualTotal = unpaidManual.reduce((s, t) => s + Math.abs(t.amount), 0);
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

  const creditBillPeriod =
    periodIn ||
    buildCreditCardBills({
      transactions: cardTransactions,
      officialBills: cardBills,
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
      (r.installmentHistory || []).forEach((inst) => {
        if ((inst.dueDate || '').startsWith(ym)) {
          receivablesTotal += inst.amount;
        }
      });
    });

    const entriesTotal = salary + receivablesTotal;

    let creditCardsTotal = 0;
    creditCards.forEach((card) => {
      const bill = cardBillAmountForMonth({
        card,
        ym,
        cardBills,
        cardTransactions,
        creditBillPeriod,
      });
      if (bill) creditCardsTotal += bill.amount;
    });

    const manualExpensesTotal = transactions
      .filter((t) => t.isManual === true && t.date?.startsWith(ym))
      .reduce((s, t) => s + Math.abs(t.amount), 0);

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
