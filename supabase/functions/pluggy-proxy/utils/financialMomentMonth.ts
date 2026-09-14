/**
 * Pure month aggregation for Momento Financeiro (port of src/utils/financialMomentMonth.js).
 */
import {
  buildCreditCardBills,
  isBillPayment,
  isBillSettled,
  sumCycleCharges,
  resolveOfficialBillTotal,
} from "../creditBillPeriod.ts";
import { automaticDebitsForMonth, isAutomaticDebitPending } from "./analytics.ts";
import { resolveMonthSalary } from "./monthSalary.ts";

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

export interface FinancialMomentMonthOptions {
  selectedMonth: string;
  salary?: number;
  salaries?: Record<string, number>;
  receivables?: AnyRec[];
  transactions?: AnyRec[];
  creditCards?: AnyRec[];
  cardBills?: AnyRec[];
  cardTransactions?: AnyRec[];
  bankAccountIds?: string[];
  bankAccountNameById?: Record<string, string>;
  creditBillPeriod?: AnyRec;
}

export function buildFinancialMomentMonthList(baseDate = new Date()) {
  const MONTHS_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  const list = [];
  for (let i = -6; i <= 5; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    list.push({
      ym,
      label: `${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return list;
}

export function cardBillAmountForMonth({
  card,
  ym,
  cardBills = [],
  cardTransactions = [],
  creditBillPeriod,
}: {
  card: AnyRec;
  ym: string;
  cardBills?: AnyRec[];
  cardTransactions?: AnyRec[];
  creditBillPeriod?: AnyRec;
}) {
  const matchingBill = cardBills.find(
    (b) =>
      (b.accountId === card.id || b.account_id === card.id) &&
      String(b.dueDate || b.due_date || "").startsWith(ym),
  );
  const periodBill = creditBillPeriod?.bills?.[ym];
  const scoped = (periodBill?.items || []).filter(
    (t: AnyRec) =>
      (!t.accountId || t.accountId === card.id) && !isBillPayment(t),
  );

  if (matchingBill) {
    const amount = resolveOfficialBillTotal(matchingBill, scoped, {
      chargeSumMode: "signed_net",
      liftOfficialToCycleCharges: false,
      includeProjectedInOfficialTotal: true,
      ignoreUnbackedOfficial: Boolean(creditBillPeriod?.openDueKey) &&
        ym > creditBillPeriod.openDueKey,
    });
    if (amount <= 0.05 && creditBillPeriod?.openDueKey && ym > creditBillPeriod.openDueKey) {
      return null;
    }
    return {
      amount,
      dueDate: String(matchingBill.dueDate || matchingBill.due_date || `${ym}-10`),
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

export function computeFinancialMomentMonth(opts: FinancialMomentMonthOptions) {
  const {
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
  } = opts;

  if (!selectedMonth) return null;

  const creditBillPeriod = periodIn ||
    buildCreditCardBills({
      transactions: cardTransactions,
      officialBills: cardBills,
      creditCards,
      selectedCardId: "all",
    });

  const salary = salaryOverride != null
    ? Number(salaryOverride) || 0
    : resolveMonthSalary(salaries, selectedMonth);

  const activeReceivables: AnyRec[] = [];
  let receivablesTotal = 0;

  receivables.forEach((r) => {
    const history = r.installmentHistory || r.installment_history || [];
    history.forEach((inst: AnyRec) => {
      const due = String(inst.dueDate || inst.due_date || "");
      if (due.startsWith(selectedMonth)) {
        activeReceivables.push({
          personName: r.personName || r.person_name || "",
          personColor: r.personColor || r.person_color || "#6366f1",
          description: r.description || "",
          amount: Number(inst.amount) || 0,
          installmentNumber: Number(inst.installmentNumber || inst.installment_number) || 1,
          totalInstallments: Number(r.installments) || 1,
          paidAt: inst.paidAt || inst.paid_at || null,
          isPaid: Boolean(inst.paidAt || inst.paid_at),
          ownerUserId: r.ownerUserId || r.userId || r.user_id,
          ownerLabel: r.ownerLabel || r.owner_label,
        });
        receivablesTotal += Number(inst.amount) || 0;
      }
    });
  });

  const entriesTotal = salary + receivablesTotal;

  const activeBills: AnyRec[] = [];
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
      cardId: card.id,
      cardName: card.name || card.marketingName || "Cartão",
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
    (t) =>
      (t.isManual === true || t.is_manual === true) &&
      String(t.date || "").startsWith(selectedMonth),
  );
  const manualExpensesTotal = activeManual.reduce(
    (s, t) => s + Math.abs(Number(t.amount) || 0),
    0,
  );

  const activeAutomaticDebits = automaticDebitsForMonth(
    transactions,
    selectedMonth,
    { bankAccountIds },
  ).map((t) => ({
    ...t,
    id: String(t.id || ""),
    description: String(t.description || "Débito automático"),
    accountId: String(t.accountId || ""),
    accountName: bankAccountNameById[String(t.accountId || "")] || "Conta conectada",
    amountAbs: Math.abs(Number(t.amount) || 0),
    isPending: isAutomaticDebitPending(t),
  }));
  const automaticDebitsTotal = activeAutomaticDebits.reduce(
    (s, t) => s + t.amountAbs,
    0,
  );

  const unpaidBills = activeBills.filter((b) => !b.isPaid);
  const unpaidManual = activeManual.filter(
    (t) => !(t.isPaid === true || t.is_paid === true),
  );
  const unpaidAutomaticDebits = activeAutomaticDebits.filter((t) => t.isPending);
  const unpaidCreditTotal = unpaidBills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const unpaidManualTotal = unpaidManual.reduce(
    (s, t) => s + Math.abs(Number(t.amount) || 0),
    0,
  );
  const unpaidAutomaticDebitsTotal = unpaidAutomaticDebits.reduce(
    (s, t) => s + t.amountAbs,
    0,
  );
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

/** Net status per month for the chip strip (web parity). */
export function computeFinancialMomentMonthsStatus(opts: {
  monthList?: { ym: string }[];
  salaries?: Record<string, number>;
  receivables?: AnyRec[];
  transactions?: AnyRec[];
  creditCards?: AnyRec[];
  cardBills?: AnyRec[];
  cardTransactions?: AnyRec[];
  bankAccountIds?: string[];
  creditBillPeriod?: AnyRec;
}): Record<string, { isPositive: boolean; net: number }> {
  const {
    monthList = [],
    salaries = {},
    receivables = [],
    transactions = [],
    creditCards = [],
    cardBills = [],
    cardTransactions = [],
    bankAccountIds = [],
    creditBillPeriod: periodIn,
  } = opts;

  const statuses: Record<string, { isPositive: boolean; net: number }> = {};
  const creditBillPeriod = periodIn ||
    buildCreditCardBills({
      transactions: cardTransactions,
      officialBills: cardBills,
      creditCards,
      selectedCardId: "all",
    });

  for (const m of monthList) {
    const ym = m.ym;
    const salary = resolveMonthSalary(salaries, ym);

    let receivablesTotal = 0;
    receivables.forEach((r) => {
      const history = r.installmentHistory || r.installment_history || [];
      history.forEach((inst: AnyRec) => {
        const due = String(inst.dueDate || inst.due_date || "");
        if (due.startsWith(ym)) receivablesTotal += Number(inst.amount) || 0;
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
      .filter((t) =>
        (t.isManual === true || t.is_manual === true) &&
        String(t.date || "").startsWith(ym)
      )
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

    const automaticDebitsTotal = automaticDebitsForMonth(transactions, ym, {
      bankAccountIds,
    }).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

    const expensesTotal = creditCardsTotal + manualExpensesTotal + automaticDebitsTotal;
    const netVal = entriesTotal - expensesTotal;
    statuses[ym] = { isPositive: netVal >= 0, net: netVal };
  }

  return statuses;
}
