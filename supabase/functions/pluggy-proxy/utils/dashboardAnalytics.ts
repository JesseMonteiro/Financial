/**
 * Dashboard analytics — port of src/utils/analytics.js + calculations.js (subset).
 */
import { isBillPayment } from "../creditBillPeriod.ts";

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  // Pluggy Level 1 Base Categories
  Income: "Renda",
  "Food and drinks": "Alimentação",
  "Comida e bebidas": "Alimentação",
  Groceries: "Supermercados",
  Housing: "Habitação",
  Transportation: "Transporte",
  Services: "Serviços",
  Shopping: "Compras",
  Healthcare: "Saúde",
  Education: "Educação",
  Leisure: "Lazer",
  "Digital services": "Serviços digitais",
  Travel: "Viagens",
  Investments: "Investimentos",
  Transfers: "Transferências",
  "Same person transfer": "Transferência entre mesma pessoa",
  "Loans and Financing": "Empréstimos e Financiamentos",
  "Bank fees": "Taxas bancárias",
  Taxes: "Impostos",
  Insurance: "Seguro",
  Donations: "Doações",
  Gambling: "Jogos de azar",
  "Legal obligations": "Obrigações legais",
  Other: "Outros",

  // Level 2 / Level 3 & Subcategories
  Salary: "Salário",
  Retirement: "Aposentadoria",
  "Entrepreneurial activities": "Atividades empreendedoras",
  "Government aid": "Auxílio governamental",
  "Non-recurring income": "Renda não recorrente",
  "Late payment and overdraft costs": "Custos de atraso e cheque especial",
  "Interests charged": "Juros cobrados",
  Loans: "Empréstimos",
  Financing: "Financiamento",
  "Real estate financing": "Financiamento imobiliário",
  "Vehicle Financing": "Financiamento de veículos",
  "Student loan": "Empréstimo estudantil",
  "Automatic investment": "Investimento automático",
  "Fixed income": "Renda fixa",
  "Mutual funds": "Fundos mútuos",
  "Variable income": "Renda variável",
  Margin: "Margem",
  "Proceeds interests and dividends": "Juros e dividendos",
  Pension: "Pensão",
  "Same person transfer - Cash": "Transferência mesma pessoa - Dinheiro",
  "Same person transfer - PIX": "Transferência mesma pessoa - PIX",
  "Same person transfer - TED": "Transferência mesma pessoa - TED",
  "Transfer - Bank slip (Boleto)": "Transferência - Boleto",
  "Transfer - Cash": "Transferência - Dinheiro",
  "Transfer - Check": "Transferência - Cheque",
  "Transfer - DOC": "Transferência - DOC",
  "Transfer - Foreign exchange": "Transferência - Câmbio",
  "Transfer - Internal": "Transferência - Interna",
  "Transfer - PIX": "Transferência - PIX",
  "Transfer - TED": "Transferência - TED",
  "Credit card payment": "Pagamento de Fatura",
  "Third-party transfers": "Transferências de terceiros",
  "Blocked balances": "Saldos bloqueados",
  Alimony: "Pensão alimentícia",
  Telecommunications: "Telecomunicações",
  Internet: "Internet",
  Mobile: "Celular / Telefonia",
  TV: "TV por assinatura",
  "Online Courses": "Cursos online",
  University: "Universidade",
  School: "Escola",
  Kindergarten: "Jardim de infância",
  "Wellness and fitness": "Bem-estar e fitness",
  "Gyms and fitness centers": "Academias e fitness",
  "Sports practice": "Prática de esportes",
  Wellness: "Bem-estar",
  Tickets: "Ingressos",
  "Stadiums and arenas": "Estádios e arenas",
  "Landmarks and museums": "Monumentos e museus",
  "Cinema, theater and concerts": "Cinema, teatro e shows",
  "Online shopping": "Compras online",
  Electronics: "Eletrônicos",
  "Pet supplies and vet": "Pets e veterinário",
  Clothing: "Vestuário e roupas",
  "Kids and toys": "Crianças e brinquedos",
  Bookstore: "Livraria",
  "Sports goods": "Artigos esportivos",
  "Office Supplies": "Materiais de escritório",
  Cashback: "Cashback",
  Gaming: "Jogos",
  "Video streaming": "Streaming de vídeo",
  "Music streaming": "Streaming de música",
  "Eating out": "Restaurantes e bares",
  "Food delivery": "Delivery de comida",
  "Airport and airlines": "Aeroporto e passagens aéreas",
  Accommodation: "Hospedagem",
  "Mileage programs": "Programas de milhas",
  "Bus tickets": "Passagens de ônibus",
  Lottery: "Loteria",
  "Online bet": "Aposta online",
  "Income taxes": "Impostos sobre renda",
  "Taxes on investments": "Impostos sobre investimentos",
  "Tax on financial operations": "IOF",
  "Account fees": "Tarifas de conta",
  "Wire transfer fees and ATM fees": "Tarifas de transferência e saques",
  "Credit card fees": "Tarifas de cartão",
  Rent: "Aluguel",
  Houseware: "Utilidades domésticas",
  "Urban land and building tax": "IPTU",
  Utilities: "Contas de consumo (Água, Luz, Gás)",
  Water: "Água",
  Electricity: "Energia elétrica",
  Gas: "Gás",
  Dentist: "Dentista",
  Pharmacy: "Farmácia",
  Optometry: "Ótica",
  "Hospital clinics and labs": "Hospitais e laboratórios",
  "Taxi and ride-hailing": "Táxi e carros de aplicativo",
  "Public transportation": "Transporte público",
  "Car rental": "Aluguel de carros",
  Bicycle: "Bicicleta",
  Automotive: "Automotivo",
  "Gas stations": "Postos de combustível",
  Parking: "Estacionamento",
  "Tolls and in-vehicle payment": "Pedágios",
  "Vehicle ownership taxes and fees": "IPVA e taxas de veículo",
  "Vehicle maintenance": "Manutenção veicular",
  "Traffic tickets": "Multas de trânsito",
  "Life insurance": "Seguro de vida",
  "Home Insurance": "Seguro residencial",
  "Health insurance": "Seguro de saúde",
  "Vehicle insurance": "Seguro de veículos",

  // Legacy mappings for backwards-compatibility
  Food: "Alimentação",
  Transport: "Transporte",
  Health: "Saúde",
  Entertainment: "Lazer / Entretenimento",
};

export function allTranslations(): Record<string, string> {
  return CATEGORY_TRANSLATIONS;
}

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "#f97316",
  Supermercados: "#fb923c",
  Supermercado: "#fb923c",
  "Restaurantes e bares": "#ea580c",
  Restaurantes: "#ea580c",
  Transporte: "#0ea5e9",
  "Táxi e carros de aplicativo": "#38bdf8",
  "Uber/Táxi": "#38bdf8",
  "Postos de combustível": "#0284c7",
  Combustível: "#0284c7",
  Habitação: "#8b5cf6",
  Moradia: "#8b5cf6",
  Aluguel: "#a855f7",
  Saúde: "#10b981",
  Farmácia: "#34d399",
  Educação: "#eab308",
  Lazer: "#ec4899",
  "Vestuário e roupas": "#14b8a6",
  Vestuário: "#14b8a6",
  Serviços: "#3b82f6",
  "Serviços digitais": "#6366f1",
  Investimentos: "#84cc16",
  Salário: "#16a34a",
  Compras: "#ec4899",
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

function installmentNumberOf(tx: AnyRec): number {
  const n = Number(tx?.creditCardMetadata?.installmentNumber ?? tx?.currentInstallment ?? 0);
  if (Number.isFinite(n) && n > 0) return n;
  // Fallback when Pluggy only embeds N/M in the merchant description.
  const desc = String(tx?.description || "");
  const match = desc.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (!match) return 0;
  const num = Number(match[1]);
  const total = Number(match[2]);
  if (total >= 2 && num >= 1 && num <= total) return num;
  return 0;
}

function purchaseDay(tx: AnyRec): string {
  const pd = String(tx?.creditCardMetadata?.purchaseDate || tx?.purchaseDate || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(pd)) return pd;
  return String(tx?.date || "").slice(0, 10);
}

function categoryIsNonPurchase(tx: AnyRec): boolean {
  const cat = String(tx?.category || "").toLowerCase();
  return (
    cat.includes("credit card payment") ||
    cat === "transfers" ||
    cat.includes("salary") ||
    cat.includes("investments") ||
    cat.includes("loan")
  );
}

function isCreditCardTx(tx: AnyRec, creditAccountIds: Set<string> = new Set()): boolean {
  const accountId = String(tx?.accountId || tx?.account_id || "");
  if (accountId && creditAccountIds.has(accountId)) return true;
  if (tx?.creditCardMetadata && typeof tx.creditCardMetadata === "object") return true;
  const accType = String(tx?.accountType || tx?.account?.type || "").toUpperCase();
  return accType === "CREDIT";
}

function isNonPurchaseOperation(tx: AnyRec): boolean {
  const op = String(tx?.operationType || "").toUpperCase();
  return (
    op === "CONVENIO_ARRECADACAO" ||
    op === "TRANSFER" ||
    op === "TRANSFER_SAME_ACCOUNT" ||
    op === "PIX" ||
    op === "TED" ||
    op === "TEF" ||
    op === "DOC" ||
    op === "BOLETO" ||
    op === "BOLETO_PAYMENT" ||
    op === "SLIP" ||
    op === "TAX"
  );
}

function isBankRailDescription(description: unknown): boolean {
  const d = String(description || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!d) return false;
  return (
    d.includes("PIX ENVIADO") ||
    d.includes("TRANSFERENCIA") ||
    d === "TED" ||
    d.startsWith("TED ") ||
    d.startsWith("TED-") ||
    d.startsWith("DOC ") ||
    d.includes("PAGAMENTO BOLETO") ||
    d.includes("PAGTO BOLETO") ||
    d.includes("PAGAMENTO CONTA") ||
    d.includes("PAGTO CONTA")
  );
}

function purchaseIdentity(tx: AnyRec): string {
  const iso = purchaseDay(tx);
  const desc = String(tx?.description || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const total = Math.abs(
    Number(tx?.creditCardMetadata?.totalAmount ?? tx?.totalAmount ?? tx?.amount) || 0,
  );
  return `${iso}|${desc}|${total.toFixed(2)}`;
}

/** New credit-card purchases only — no bank rails, bills, income, or later installments. */
export function isNewPurchaseTx(
  tx: AnyRec,
  creditAccountIds: Set<string> = new Set(),
): boolean {
  if (!tx || tx.isProjected) return false;
  if (!isCreditCardTx(tx, creditAccountIds)) return false;
  if (!isExpenseTx(tx)) return false;
  if (categoryIsNonPurchase(tx)) return false;
  if (isNonPurchaseOperation(tx)) return false;
  if (isBankRailDescription(tx?.description)) return false;
  if (installmentNumberOf(tx) > 1) return false;
  return true;
}

/** Inclusive window length for the home “últimas compras” carousel. */
export const RECENT_CREDIT_PURCHASE_DAYS = 15;

export function saoPauloDateKey(now: Date = new Date()): string {
  const sp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return sp.format(now);
}

/** First calendar day of an inclusive `days`-long window ending today (SP). */
export function recentPurchaseWindowStart(
  days: number = RECENT_CREDIT_PURCHASE_DAYS,
  now: Date = new Date(),
): string {
  const today = saoPauloDateKey(now);
  const [ty, tm, td] = today.split("-").map(Number);
  const utc = new Date(Date.UTC(ty, tm - 1, td - (Math.max(1, days) - 1)));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

export function purchaseDayOf(tx: AnyRec): string {
  return purchaseDay(tx);
}

/**
 * Home “Últimas Transações”: only what already happened.
 * Drops app-projected installments, future-dated rows (SP), and later parcels
 * of the same purchase (N/M with N > 1) so a parcelado compra appears once.
 * Sorted newest → oldest.
 */
export function buildRecentExecutedTransactions(
  transactions: AnyRec[] = [],
  opts: {
    limit?: number;
    now?: Date;
    formatRelativeDate?: (iso: string) => string;
    translateCategory?: (raw: unknown) => string;
    isIncome?: (tx: AnyRec) => boolean;
  } = {},
): AnyRec[] {
  const limit = opts.limit ?? 5;
  const now = opts.now ?? new Date();
  const today = saoPauloDateKey(now);
  const rel = opts.formatRelativeDate ?? ((iso: string) => iso);
  const cat = opts.translateCategory ?? ((raw: unknown) => String(raw || ""));
  const income = opts.isIncome ?? isIncomeTx;

  const seenIds = new Set<string>();
  const seenPurchases = new Set<string>();
  const rows: AnyRec[] = [];

  for (const tx of transactions) {
    if (!tx || tx.isProjected) continue;
    // Later installments of the same purchase are not separate “transactions”
    // on the home card — only the original charge (or non-installment row).
    if (installmentNumberOf(tx) > 1) continue;
    const day = String(tx.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (day > today) continue;

    const id = String(tx.id || "");
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    const identity = purchaseIdentity(tx);
    if (identity) {
      if (seenPurchases.has(identity)) continue;
      seenPurchases.add(identity);
    }
    rows.push(tx);
  }

  rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  return rows.slice(0, limit).map((tx) => {
    const amount = Number(tx.amount) || 0;
    const day = String(tx.date || "").slice(0, 10);
    const isCredit = income(tx);
    return {
      id: String(tx.id || `${tx.accountId}-${day}-${amount}`),
      description: String(tx.description || "Lançamento"),
      category: cat(tx.category),
      categoryId: tx.categoryId ? String(tx.categoryId) : null,
      date: day,
      dateRelative: rel(day),
      amount: Math.abs(amount),
      isCredit,
      isPending: String(tx.status || "").toUpperCase() === "PENDING",
    };
  });
}

/**
 * Latest credit-card purchases in the last `days` (by purchase date, SP calendar).
 * Sorted newest → oldest. Uses the same purchase rules as daily spend.
 */
export function buildRecentCreditPurchases(
  transactions: AnyRec[] = [],
  creditAccountIds: Set<string> = new Set(),
  opts: {
    days?: number;
    limit?: number;
    now?: Date;
    accountNameById?: Map<string, string>;
    formatRelativeDate?: (iso: string) => string;
    translateCategory?: (raw: unknown) => string;
  } = {},
): AnyRec[] {
  const days = opts.days ?? RECENT_CREDIT_PURCHASE_DAYS;
  const limit = opts.limit ?? 24;
  const now = opts.now ?? new Date();
  const from = recentPurchaseWindowStart(days, now);
  const today = saoPauloDateKey(now);
  const accountNameById = opts.accountNameById ?? new Map<string, string>();
  const rel = opts.formatRelativeDate ?? ((iso: string) => iso);
  const cat = opts.translateCategory ?? ((raw: unknown) => String(raw || ""));

  const seenIds = new Set<string>();
  const seenPurchases = new Set<string>();
  const rows: { day: string; tx: AnyRec }[] = [];

  for (const tx of transactions) {
    const id = String(tx?.id || "");
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    if (!isNewPurchaseTx(tx, creditAccountIds)) continue;
    const day = purchaseDay(tx);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (day < from || day > today) continue;
    const identity = purchaseIdentity(tx);
    if (identity) {
      if (seenPurchases.has(identity)) continue;
      seenPurchases.add(identity);
    }
    rows.push({ day, tx });
  }

  rows.sort((a, b) => {
    const byDay = b.day.localeCompare(a.day);
    if (byDay !== 0) return byDay;
    return String(b.tx.id || "").localeCompare(String(a.tx.id || ""));
  });

  return rows.slice(0, limit).map(({ day, tx }) => {
    const amount = Math.abs(Number(tx.amount) || 0);
    const accountId = String(tx.accountId || tx.account_id || "");
    return {
      id: String(tx.id || `${accountId}-${day}-${amount}`),
      description: String(tx.description || "Compra"),
      category: cat(tx.category),
      categoryId: tx.categoryId ? String(tx.categoryId) : null,
      date: day,
      dateRelative: rel(day),
      amount,
      isCredit: false,
      isPending: String(tx.status || "").toUpperCase() === "PENDING",
      accountId: accountId || null,
      accountName: accountNameById.get(accountId) || null,
    };
  });
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

/** Last `days` of new-purchase totals (YYYY-MM-DD in America/Sao_Paulo). */
export function buildDailySpend(
  transactions: AnyRec[] = [],
  days = 30,
  now = new Date(),
  creditAccountIds: Set<string> = new Set(),
): {
  date: string;
  amount: number;
  maxPurchase: number;
  topPurchaseDescription?: string | null;
  topPurchaseCategory?: string | null;
  topPurchaseAmount?: number | null;
  topPurchaseId?: string | null;
}[] {
  interface DailyRecord {
    amount: number;
    maxPurchase: number;
    topPurchaseDescription?: string;
    topPurchaseCategory?: string;
    topPurchaseAmount?: number;
    topPurchaseId?: string;
  }
  const byDay = new Map<string, DailyRecord>();
  const seenIds = new Set<string>();
  const seenPurchases = new Set<string>();
  for (const t of transactions) {
    const id = String(t?.id || "");
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    if (!isNewPurchaseTx(t, creditAccountIds)) continue;
    const iso = purchaseDay(t);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const identity = purchaseIdentity(t);
    if (identity && seenPurchases.has(identity)) continue;
    if (identity) seenPurchases.add(identity);
    const abs = Math.abs(Number(t.amount) || 0);
    const cur = byDay.get(iso) || { amount: 0, maxPurchase: 0 };
    cur.amount += abs;
    if (abs > cur.maxPurchase || !cur.topPurchaseDescription) {
      cur.maxPurchase = abs;
      cur.topPurchaseDescription = String(t.description || "");
      cur.topPurchaseCategory = String(t.category || "");
      cur.topPurchaseAmount = abs;
      cur.topPurchaseId = id;
    }
    byDay.set(iso, cur);
  }

  const sp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [ty, tm, td] = sp.format(now).split("-").map(Number);
  const out: {
    date: string;
    amount: number;
    maxPurchase: number;
    topPurchaseDescription?: string | null;
    topPurchaseCategory?: string | null;
    topPurchaseAmount?: number | null;
    topPurchaseId?: string | null;
  }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const utc = new Date(Date.UTC(ty, tm - 1, td - i));
    const key = `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
    const row = byDay.get(key);
    out.push({
      date: key,
      amount: Number((row?.amount || 0).toFixed(2)),
      maxPurchase: Number((row?.maxPurchase || 0).toFixed(2)),
      topPurchaseDescription: row?.topPurchaseDescription || null,
      topPurchaseCategory: row?.topPurchaseCategory || null,
      topPurchaseAmount: row?.topPurchaseAmount ? Number(row.topPurchaseAmount.toFixed(2)) : null,
      topPurchaseId: row?.topPurchaseId || null,
    });
  }
  return out;
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
