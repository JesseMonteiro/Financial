/**
 * Pure month aggregation for Momento Financeiro (port of src/utils/financialMomentMonth.js).
 */
import {
  buildCreditCardBills,
  isBillPayment,
  isBillSettled,
  sumCycleCharges,
  resolveOfficialBillTotal,
  ymAdd,
} from "../creditBillPeriod.ts";
import { resolveConnectorProfile } from "../creditConnectors/profiles.ts";
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
  /** Prebuilt per-card periods (joint). Mixing every member's cards into one
   *  buildCreditCardBills collides installment projection and drops ~future bills. */
  periodByCardId?: Map<string, AnyRec>;
  /**
   * When true, reuse one shared creditBillPeriod for every card.
   * Unsafe for joint (installment series collide). Solo may use it only as fallback.
   */
  preferSharedCreditPeriod?: boolean;
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
  const cardId = String(card.id || "");
  const openKey = String(
    creditBillPeriod?.openByAccount?.[String(cardId)]
      || creditBillPeriod?.openByAccount?.[cardId]
      || creditBillPeriod?.openDueKey
      || "",
  );
  const matchingBill = cardBills.find(
    (b) =>
      String(b.accountId || b.account_id || "") === cardId &&
      String(b.dueDate || b.due_date || "").startsWith(ym),
  );
  const periodBill = creditBillPeriod?.bills?.[ym];
  const scoped = (periodBill?.items || []).filter(
    (t: AnyRec) =>
      (!t.accountId || String(t.accountId) === cardId) && !isBillPayment(t),
  );

  if (matchingBill) {
    const profile = resolveConnectorProfile({ account: card });
    const chargeSumMode = profile.chargeSumMode || "signed_net";
    let amount = resolveOfficialBillTotal(matchingBill, scoped, {
      chargeSumMode,
      liftOfficialToCycleCharges: Boolean(profile.liftOfficialToCycleCharges),
      includeProjectedInOfficialTotal: profile.includeProjectedInOfficialTotal !== false,
      ignoreUnbackedOfficial: Boolean(openKey) && ym > openKey,
    });
    if (openKey && ym > openKey) {
      const cycleAmount = sumCycleCharges(scoped, {
        includeProjected: true,
        chargeSumMode,
      });
      if (cycleAmount > amount + 0.05) amount = cycleAmount;
    }
    if (!(amount <= 0.05 && openKey && ym > openKey)) {
      let isPaid = isBillSettled(matchingBill, {
        transactions: cardTransactions.filter(
          (t: AnyRec) => !t.accountId || String(t.accountId) === cardId,
        ),
        officialBills: cardBills.filter(
          (b: AnyRec) => String(b.accountId || b.account_id || "") === cardId,
        ),
        forecastToDueOffset: creditBillPeriod?.forecastToDueOffset || 0,
      });
      if (!isPaid && openKey) {
        const unpaidCutoff = ymAdd(openKey, -2);
        if (ym < unpaidCutoff) isPaid = true;
      }
      return {
        amount,
        dueDate: String(matchingBill.dueDate || matchingBill.due_date || `${ym}-10`),
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

/** One `buildCreditCardBills` per card — required for joint (and matches web chips). */
export function buildCreditBillPeriodByCardId(
  creditCards: AnyRec[] = [],
  cardTransactions: AnyRec[] = [],
  cardBills: AnyRec[] = [],
): Map<string, AnyRec> {
  const periodByCardId = new Map<string, AnyRec>();
  for (const card of creditCards) {
    const cardId = String(card.id || "");
    if (!cardId || periodByCardId.has(cardId)) continue;
    periodByCardId.set(
      cardId,
      buildCreditCardBills({
        transactions: cardTransactions.filter(
          (t: AnyRec) => !t.accountId || String(t.accountId) === cardId,
        ),
        officialBills: cardBills.filter(
          (b: AnyRec) => String(b.accountId || b.account_id || "") === cardId,
        ),
        creditCards: [card],
        selectedCardId: card.id,
      }),
    );
  }
  return periodByCardId;
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
    periodByCardId: periodByCardIdIn,
    preferSharedCreditPeriod = false,
  } = opts;

  if (!selectedMonth) return null;

  const periodByCardId = periodByCardIdIn && periodByCardIdIn.size
    ? periodByCardIdIn
    : (preferSharedCreditPeriod
      ? new Map<string, AnyRec>()
      : buildCreditBillPeriodByCardId(creditCards, cardTransactions, cardBills));

  const creditBillPeriod = periodIn ||
    (preferSharedCreditPeriod || periodByCardId.size === 0
      ? buildCreditCardBills({
        transactions: cardTransactions,
        officialBills: cardBills,
        creditCards,
        selectedCardId: "all",
      })
      : undefined);

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
    const cardId = String(card.id || "");
    const cardPeriod = periodByCardId.get(cardId) || creditBillPeriod;
    const bill = cardBillAmountForMonth({
      card,
      ym: selectedMonth,
      cardBills,
      cardTransactions,
      creditBillPeriod: cardPeriod,
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

/** Net status per month for the chip strip (web parity — one period per card). */
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
  periodByCardId?: Map<string, AnyRec>;
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
    periodByCardId: periodByCardIdIn,
  } = opts;

  const statuses: Record<string, { isPositive: boolean; net: number }> = {};

  const periodByCardId = periodByCardIdIn && periodByCardIdIn.size
    ? periodByCardIdIn
    : buildCreditBillPeriodByCardId(creditCards, cardTransactions, cardBills);
  const sharedPeriod = periodIn;

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
      const cardId = String(card.id || "");
      const bill = cardBillAmountForMonth({
        card,
        ym,
        cardBills,
        cardTransactions,
        creditBillPeriod: periodByCardId.get(cardId) || sharedPeriod,
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
