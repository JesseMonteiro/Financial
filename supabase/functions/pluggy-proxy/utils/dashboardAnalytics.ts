/**
 * Dashboard analytics — port of src/utils/analytics.js + calculations.js (subset).
 */
import { isBillPayment } from "../creditBillPeriod.ts";

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  Groceries: "Supermercado & Alimentação",
  "Eating out": "Restaurantes & Bares",
  "Food delivery": "Delivery de Comida",
  "Cinema, theater and concerts": "Cinema, Teatro & Shows",
  Parking: "Estacionamento",
  Shopping: "Compras & Lojas",
  Services: "Serviços",
  Tickets: "Ingressos & Eventos",
  "Digital services": "Serviços Digitais",
  Telecommunications: "Telefone & Internet",
  "Car rental": "Aluguel de Carros",
  Automotive: "Automóvel",
  "Gas stations": "Postos de Combustível",
  "Vehicle maintenance": "Manutenção Veicular",
  "Taxi and ride-hailing": "Uber / Táxi / Transporte",
  Healthcare: "Saúde & Medicina",
  Dentist: "Odontologia",
  Pharmacy: "Farmácia & Drogaria",
  Optometry: "Ótica & Visão",
  "Gyms and fitness centers": "Academias & Fitness",
  "Wellness and fitness": "Bem-estar & Fitness",
  Houseware: "Utilidades Domésticas",
  Rent: "Aluguel",
  Clothing: "Vestuário & Roupas",
  Gaming: "Games & Entretenimento",
  Transfers: "Transferências",
  "Credit card payment": "Pagamento de Fatura",
  "Bank fees": "Tarifas Bancárias",
  Salary: "Salário & Renda",
  Investments: "Investimentos",
  Other: "Outros",
};

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "#f97316",
  Supermercado: "#fb923c",
  Restaurantes: "#ea580c",
  Transporte: "#0ea5e9",
  "Uber/Táxi": "#38bdf8",
  Combustível: "#0284c7",
  Moradia: "#8b5cf6",
  Aluguel: "#a855f7",
  Saúde: "#10b981",
  Farmácia: "#34d399",
  Educação: "#eab308",
  Lazer: "#ec4899",
  Vestuário: "#14b8a6",
  Serviços: "#3b82f6",
  Investimentos: "#84cc16",
  Salário: "#16a34a",
  Outros: "#64748b",
};

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function translateCategory(category: unknown): string {
  if (!category) return "Geral";
  const key = String(category);
  return CATEGORY_TRANSLATIONS[key] || key;
}

export function getCategoryColor(categoryName: string): string {
  if (!categoryName) return CATEGORY_COLORS["Outros"];
  if (CATEGORY_COLORS[categoryName]) return CATEGORY_COLORS[categoryName];
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (categoryName.includes(k) || k.includes(categoryName.split(" ")[0] || "")) return v;
  }
  return "#6366f1";
}

export function ymFromDate(date: unknown): string | null {
  if (!date) return null;
  const raw = String(date);
  if (raw.length >= 7) return raw.slice(0, 7);
  return null;
}

export function currentYm(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string): string {
  if (!ym) return "";
  const [, m] = ym.split("-");
  return MONTHS_SHORT[Number(m) - 1] || ym;
}

export function lastNMonths(n = 6, endYm = currentYm()): string[] {
  const [y0, m0] = endYm.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let y = y0;
    let m = m0 - i;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

export function isExpenseTx(tx: AnyRec): boolean {
  if (!tx || isBillPayment(tx)) return false;
  if (tx.type === "CREDIT" || tx.type === "CREDIT_INCOME") return false;
  return Number(tx.amount) < 0 || tx.type === "DEBIT";
}

export function isIncomeTx(tx: AnyRec): boolean {
  if (!tx || isBillPayment(tx)) return false;
  if (tx.type === "DEBIT") return false;
  return Number(tx.amount) > 0 || tx.type === "CREDIT" || tx.type === "CREDIT_INCOME";
}

function totalReservedBalances(accounts: AnyRec[] = []): number {
  let sum = 0;
  for (const a of accounts) {
    if (String(a.type).toUpperCase() !== "BANK") continue;
    const raw = a.bankData?.reservedBalances;
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      const amounts = Array.isArray(item?.availableAmounts) ? item.availableAmounts : [];
      for (const entry of amounts) {
        if (typeof entry?.amount === "number") sum += entry.amount;
      }
    }
  }
  return sum;
}

export function calculateNetWorth(
  accounts: AnyRec[] = [],
  investments: AnyRec[] = [],
  loans: AnyRec[] = [],
) {
  let bankBalance = 0;
  for (const a of accounts) {
    if (String(a.type).toUpperCase() !== "BANK") continue;
    bankBalance += Number(a.balance) || 0;
  }

  const reservedFromAccounts = totalReservedBalances(accounts);
  const reservedFromInvestments = investments.reduce((sum, inv) => {
    if (!inv?.isReservedBalance) return sum;
    return sum + (Number(inv.balance || inv.amount) || 0);
  }, 0);
  const hasReservedInvestments = investments.some((inv) => inv?.isReservedBalance);
  const reservedBalance = hasReservedInvestments ? reservedFromInvestments : reservedFromAccounts;
  const reservedNotInInvestments = hasReservedInvestments ? 0 : reservedFromAccounts;

  const creditDebt = accounts.reduce((acc, a) => {
    if (String(a.type).toUpperCase() === "CREDIT") return acc + Math.abs(Number(a.balance) || 0);
    return acc;
  }, 0);

  const investmentTotal =
    investments.reduce((acc, i) => acc + (Number(i.balance || i.amount) || 0), 0) +
    reservedNotInInvestments;

  const loansTotal = loans.reduce((acc, l) => acc + (Number(l.balance) || 0), 0);
  const totalAssets = bankBalance + investmentTotal;
  const totalLiabilities = creditDebt + loansTotal;

  return {
    netWorth: totalAssets - totalLiabilities,
    totalAssets,
    totalLiabilities,
    bankBalance,
    reservedBalance,
    investmentTotal,
    creditDebt,
    loansTotal,
  };
}

export function buildIncomeExpenseSeries(
  transactions: AnyRec[] = [],
  monthsCount = 6,
  endYm = currentYm(),
) {
  const months = lastNMonths(monthsCount, endYm);
  return months.map((ym) => {
    let receita = 0;
    let despesa = 0;
    transactions.forEach((t) => {
      if (ymFromDate(t.date) !== ym) return;
      if (isIncomeTx(t)) receita += Math.abs(Number(t.amount) || 0);
      else if (isExpenseTx(t)) despesa += Math.abs(Number(t.amount) || 0);
    });
    return {
      month: monthLabel(ym),
      ym,
      receita: Number(receita.toFixed(2)),
      despesa: Number(despesa.toFixed(2)),
      net: Number((receita - despesa).toFixed(2)),
    };
  });
}

export function buildNetWorthSeries(
  transactions: AnyRec[] = [],
  accounts: AnyRec[] = [],
  investments: AnyRec[] = [],
  loans: AnyRec[] = [],
  monthsCount = 6,
  endYm = currentYm(),
) {
  const months = lastNMonths(monthsCount, endYm);
  const flows = buildIncomeExpenseSeries(transactions, monthsCount, endYm);
  const { netWorth } = calculateNetWorth(accounts, investments, loans);
  const byYm = Object.fromEntries(flows.map((f) => [f.ym, f.net]));

  const values: Record<string, number> = {};
  values[endYm] = netWorth;
  for (let i = months.length - 2; i >= 0; i--) {
    const ym = months[i];
    const nextYm = months[i + 1];
    values[ym] = Number((values[nextYm] - (byYm[nextYm] || 0)).toFixed(2));
  }

  return months.map((ym) => ({
    month: monthLabel(ym),
    ym,
    value: values[ym] ?? 0,
  }));
}

export function monthCashflow(transactions: AnyRec[] = [], ym = currentYm()) {
  let income = 0;
  let expense = 0;
  transactions.forEach((t) => {
    if (ymFromDate(t.date) !== ym) return;
    if (isIncomeTx(t)) income += Math.abs(Number(t.amount) || 0);
    else if (isExpenseTx(t)) expense += Math.abs(Number(t.amount) || 0);
  });
  const net = income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : null;
  return {
    ym,
    income: Number(income.toFixed(2)),
    expense: Number(expense.toFixed(2)),
    net: Number(net.toFixed(2)),
    savingsRate: savingsRate == null ? null : Number(savingsRate.toFixed(1)),
  };
}

export function monthOverMonth(transactions: AnyRec[] = [], ym = currentYm()) {
  const [y, m] = ym.split("-").map(Number);
  let pm = m - 1;
  let py = y;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  const prevYm = `${py}-${String(pm).padStart(2, "0")}`;
  const current = monthCashflow(transactions, ym);
  const previous = monthCashflow(transactions, prevYm);

  const expenseDelta =
    previous.expense > 0
      ? ((current.expense - previous.expense) / previous.expense) * 100
      : current.expense > 0
      ? 100
      : 0;

  const byCat = (targetYm: string) => {
    const map: Record<string, number> = {};
    transactions.forEach((t) => {
      if (!isExpenseTx(t) || ymFromDate(t.date) !== targetYm) return;
      const cat = translateCategory(t.category);
      map[cat] = (map[cat] || 0) + Math.abs(Number(t.amount) || 0);
    });
    return map;
  };

  const curCats = byCat(ym);
  const prevCats = byCat(prevYm);
  const catDeltas = Object.keys({ ...curCats, ...prevCats })
    .map((cat) => {
      const cur = curCats[cat] || 0;
      const prev = prevCats[cat] || 0;
      const deltaPct = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
      return {
        category: cat,
        current: cur,
        previous: prev,
        deltaPct: Number(deltaPct.toFixed(1)),
        delta: cur - prev,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    current,
    previous,
    expenseDeltaPct: Number(expenseDelta.toFixed(1)),
    topCategoryDeltas: catDeltas.slice(0, 5),
  };
}

export function expensesByCategory(
  transactions: AnyRec[] = [],
  { limit = 7, ym }: { limit?: number; ym?: string } = {},
) {
  const map: Record<string, number> = {};
  transactions.forEach((t) => {
    if (!isExpenseTx(t)) return;
    if (ym && ymFromDate(t.date) !== ym) return;
    const cat = translateCategory(t.category);
    map[cat] = (map[cat] || 0) + Math.abs(Number(t.amount) || 0);
  });
  return Object.entries(map)
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
      color: getCategoryColor(name),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function weekBounds(now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 6);
  prevStart.setHours(0, 0, 0, 0);
  return {
    thisWeek: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
    lastWeek: { from: prevStart.toISOString().slice(0, 10), to: prevEnd.toISOString().slice(0, 10) },
  };
}

export function weeklyRecap(transactions: AnyRec[] = [], now = new Date()) {
  const { thisWeek, lastWeek } = weekBounds(now);
  const sumExpenses = (from: string, to: string) => {
    let total = 0;
    const cats: Record<string, number> = {};
    transactions.forEach((t) => {
      if (!isExpenseTx(t)) return;
      const d = String(t.date).slice(0, 10);
      if (d < from || d > to) return;
      const amt = Math.abs(Number(t.amount) || 0);
      total += amt;
      const cat = translateCategory(t.category);
      cats[cat] = (cats[cat] || 0) + amt;
    });
    const topCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    return {
      total: Number(total.toFixed(2)),
      topCategory: topCategory
        ? { name: topCategory[0], value: Number(topCategory[1].toFixed(2)) }
        : null,
    };
  };

  const current = sumExpenses(thisWeek.from, thisWeek.to);
  const previous = sumExpenses(lastWeek.from, lastWeek.to);
  const deltaPct =
    previous.total > 0
      ? Number((((current.total - previous.total) / previous.total) * 100).toFixed(1))
      : current.total > 0
      ? 100
      : 0;

  return { current, previous, deltaPct };
}

export function buildInsights(transactions: AnyRec[] = [], ym = currentYm()) {
  const insights: { id: string; type: string; text: string }[] = [];
  const mom = monthOverMonth(transactions, ym);
  const recap = weeklyRecap(transactions);
  const flow = mom.current;

  if (flow.savingsRate != null) {
    insights.push({
      id: "savings",
      type: flow.savingsRate >= 20 ? "positive" : flow.savingsRate >= 0 ? "neutral" : "warning",
      text:
        flow.savingsRate >= 0
          ? `Taxa de poupança de ${flow.savingsRate.toFixed(0)}% este mês.`
          : `Despesas superaram receitas em ${Math.abs(flow.savingsRate).toFixed(0)}% este mês.`,
    });
  }

  if (mom.expenseDeltaPct !== 0) {
    const up = mom.expenseDeltaPct > 0;
    insights.push({
      id: "mom",
      type: up ? "warning" : "positive",
      text: up
        ? `Gastos ${mom.expenseDeltaPct.toFixed(0)}% acima do mês anterior.`
        : `Gastos ${Math.abs(mom.expenseDeltaPct).toFixed(0)}% abaixo do mês anterior.`,
    });
  }

  const spike = mom.topCategoryDeltas.find((c) => c.previous > 0 && c.deltaPct >= 25);
  if (spike) {
    insights.push({
      id: "cat-spike",
      type: "warning",
      text: `Você gastou ${spike.deltaPct.toFixed(0)}% a mais em ${spike.category} este mês.`,
    });
  }

  if (recap.current.topCategory) {
    const v = recap.current.topCategory.value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    insights.push({
      id: "week-top",
      type: "neutral",
      text: `Na última semana, a maior categoria foi ${recap.current.topCategory.name} (${v}).`,
    });
  }

  return insights.slice(0, 4);
}

export function buildBudgetCategories(
  transactions: AnyRec[] = [],
  budgets: { category: string; limit: number }[] = [],
  ym = currentYm(),
) {
  const map: Record<string, number> = {};
  transactions.forEach((t) => {
    if (!isExpenseTx(t)) return;
    if (ymFromDate(t.date) !== ym) return;
    const catLabel = translateCategory(t.category);
    map[catLabel] = (map[catLabel] || 0) + Math.abs(Number(t.amount) || 0);
  });

  return Object.entries(map)
    .map(([category, spent]) => {
      const existing = budgets.find((b) => b.category === category);
      const limit = existing ? Number(existing.limit) : Math.max(1000, Math.ceil(spent * 1.25));
      const percent = Math.min(100, Math.round((spent / limit) * 100));
      return {
        category,
        spent: Number(spent.toFixed(2)),
        limit,
        percent,
        color: getCategoryColor(category),
      };
    })
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6);
}
