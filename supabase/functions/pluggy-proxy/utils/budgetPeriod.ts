/** Period-aware budget allowance — keep in sync with src/utils/budgetPeriod.js */
import { translateCategory } from "./dashboardAnalytics.ts";

export const BUDGET_PERIODS = ["daily", "weekly", "biweekly", "monthly"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

/** Categories that should be excluded from budget by default (transfers, income, etc.) */
export const BUDGET_EXCLUDED_CATEGORIES = [
  'Transferências',
  'Pagamento de Fatura',
  'Tarifas Bancárias',
  'Salário & Renda',
  'Investimentos',
  // Pluggy categories in English (before translation)
  'Transfers',
  'Credit card payment',
  'Bank fees',
  'Salary',
  'Investments',
  'Cashback',
  'cashback',
  'CASHBACK',
];

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

export const BASE_KEY_TO_LABEL: Record<string, string> = {
  "Food and drinks": "Alimentação",
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
  Income: "Renda",
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
};

export const BASE_KEYS = new Set(Object.keys(BASE_KEY_TO_LABEL));

const SUBCATEGORY_TO_BASE_KEY: Record<string, string> = {
  // Food and drinks
  "Eating out": "Food and drinks",
  "Food delivery": "Food and drinks",
  Food: "Food and drinks",
  "Comida e bebidas": "Food and drinks",
  // Housing
  Rent: "Housing",
  Houseware: "Housing",
  Utilities: "Housing",
  Water: "Housing",
  Electricity: "Housing",
  Gas: "Housing",
  "Urban land and building tax": "Housing",
  // Transportation
  "Taxi and ride-hailing": "Transportation",
  Parking: "Transportation",
  "Car rental": "Transportation",
  Automotive: "Transportation",
  "Gas stations": "Transportation",
  "Vehicle maintenance": "Transportation",
  "Public transportation": "Transportation",
  Bicycle: "Transportation",
  "Tolls and in-vehicle payment": "Transportation",
  "Vehicle ownership taxes and fees": "Transportation",
  "Traffic tickets": "Transportation",
  Transport: "Transportation",
  // Services
  Telecommunications: "Services",
  Internet: "Services",
  Mobile: "Services",
  TV: "Services",
  "Gyms and fitness centers": "Services",
  "Wellness and fitness": "Services",
  "Sports practice": "Services",
  Wellness: "Services",
  // Shopping
  "Online shopping": "Shopping",
  Electronics: "Shopping",
  "Pet supplies and vet": "Shopping",
  Clothing: "Shopping",
  "Kids and toys": "Shopping",
  Bookstore: "Shopping",
  "Sports goods": "Shopping",
  "Office Supplies": "Shopping",
  Cashback: "Shopping",
  // Healthcare
  Dentist: "Healthcare",
  Pharmacy: "Healthcare",
  Optometry: "Healthcare",
  "Hospital clinics and labs": "Healthcare",
  Health: "Healthcare",
  // Education
  "Online Courses": "Education",
  University: "Education",
  School: "Education",
  Kindergarten: "Education",
  // Leisure
  "Cinema, theater and concerts": "Leisure",
  Tickets: "Leisure",
  "Stadiums and arenas": "Leisure",
  "Landmarks and museums": "Leisure",
  Entertainment: "Leisure",
  // Digital services
  Gaming: "Digital services",
  "Video streaming": "Digital services",
  "Music streaming": "Digital services",
  // Travel
  "Airport and airlines": "Travel",
  Accommodation: "Travel",
  "Mileage programs": "Travel",
  "Bus tickets": "Travel",
  // Income
  Salary: "Income",
  Retirement: "Income",
  "Entrepreneurial activities": "Income",
  "Government aid": "Income",
  "Non-recurring income": "Income",
  // Investments
  "Automatic investment": "Investments",
  "Fixed income": "Investments",
  "Mutual funds": "Investments",
  "Variable income": "Investments",
  Margin: "Investments",
  "Proceeds interests and dividends": "Investments",
  Pension: "Investments",
  // Transfers
  "Transfer - Bank slip (Boleto)": "Transfers",
  "Transfer - Cash": "Transfers",
  "Transfer - Check": "Transfers",
  "Transfer - DOC": "Transfers",
  "Transfer - Foreign exchange": "Transfers",
  "Transfer - Internal": "Transfers",
  "Transfer - PIX": "Transfers",
  "Transfer - TED": "Transfers",
  "Credit card payment": "Transfers",
  "Third-party transfers": "Transfers",
  // Same person transfer
  "Same person transfer - Cash": "Same person transfer",
  "Same person transfer - PIX": "Same person transfer",
  "Same person transfer - TED": "Same person transfer",
  // Loans and Financing
  "Late payment and overdraft costs": "Loans and Financing",
  "Interests charged": "Loans and Financing",
  Loans: "Loans and Financing",
  Financing: "Loans and Financing",
  "Real estate financing": "Loans and Financing",
  "Vehicle Financing": "Loans and Financing",
  "Student loan": "Loans and Financing",
  // Bank fees
  "Account fees": "Bank fees",
  "Wire transfer fees and ATM fees": "Bank fees",
  "Credit card fees": "Bank fees",
  // Taxes
  "Income taxes": "Taxes",
  "Taxes on investments": "Taxes",
  "Tax on financial operations": "Taxes",
  // Insurance
  "Life insurance": "Insurance",
  "Home Insurance": "Insurance",
  "Health insurance": "Insurance",
  "Vehicle insurance": "Insurance",
  // Gambling
  Lottery: "Gambling",
  "Online bet": "Gambling",
  // Legal obligations
  "Blocked balances": "Legal obligations",
  Alimony: "Legal obligations",
};

const PT_LABEL_TO_BASE_KEY: Record<string, string> = {
  Alimentação: "Food and drinks",
  Supermercados: "Groceries",
  Habitação: "Housing",
  Transporte: "Transportation",
  Serviços: "Services",
  Compras: "Shopping",
  Saúde: "Healthcare",
  Educação: "Education",
  Lazer: "Leisure",
  "Serviços digitais": "Digital services",
  Viagens: "Travel",
  Renda: "Income",
  Investimentos: "Investments",
  Transferências: "Transfers",
  "Transferência entre mesma pessoa": "Same person transfer",
  "Empréstimos e Financiamentos": "Loans and Financing",
  "Taxas bancárias": "Bank fees",
  Impostos: "Taxes",
  Seguro: "Insurance",
  Doações: "Donations",
  "Jogos de azar": "Gambling",
  "Obrigações legais": "Legal obligations",
  Outros: "Other",
  // Granular translated labels
  "Restaurantes & Bares": "Food and drinks",
  "Restaurantes e bares": "Food and drinks",
  "Delivery de Comida": "Food and drinks",
  "Supermercado & Alimentação": "Groceries",
  Aluguel: "Housing",
  "Utilidades Domésticas": "Housing",
  "Contas de consumo (Água, Luz, Gás)": "Housing",
  "Uber / Táxi / Transporte": "Transportation",
  "Postos de Combustível": "Transportation",
  Estacionamento: "Transportation",
  "Manutenção Veicular": "Transportation",
  Automóvel: "Transportation",
  "Aluguel de Carros": "Transportation",
  "Telefone & Internet": "Services",
  Telecomunicações: "Services",
  "Academias & Fitness": "Services",
  "Bem-estar & Fitness": "Services",
  "Compras & Lojas": "Shopping",
  "Vestuário & Roupas": "Shopping",
  "Saúde & Medicina": "Healthcare",
  "Farmácia & Drogaria": "Healthcare",
  Odontologia: "Healthcare",
  "Ótica & Visão": "Healthcare",
  "Cinema, Teatro & Shows": "Leisure",
  "Ingressos & Eventos": "Leisure",
  "Games & Entretenimento": "Digital services",
  "Salário & Renda": "Income",
  "Tarifas Bancárias": "Bank fees",
  "Pagamento de Fatura": "Transfers",
};

/**
 * Resolves any category string (Pluggy raw, translated PT-BR, or base key)
 * to its Level 1 base category key for budget matching.
 */
export function resolveBudgetCategoryKey(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const trimmed = String(raw).trim();
  if (!trimmed) return "Other";
  if (BASE_KEYS.has(trimmed)) return trimmed;
  if (SUBCATEGORY_TO_BASE_KEY[trimmed]) return SUBCATEGORY_TO_BASE_KEY[trimmed];
  if (PT_LABEL_TO_BASE_KEY[trimmed]) return PT_LABEL_TO_BASE_KEY[trimmed];

  const lower = trimmed.toLowerCase();
  for (const [key, base] of Object.entries(SUBCATEGORY_TO_BASE_KEY)) {
    if (key.toLowerCase() === lower) return base;
  }
  for (const [label, base] of Object.entries(PT_LABEL_TO_BASE_KEY)) {
    if (label.toLowerCase() === lower) return base;
  }
  return trimmed;
}

export const SUBCATEGORY_TO_PARENT: Record<string, string> = {
  // Food and drinks (Alimentação)
  Groceries: "Food and drinks",
  "Eating out": "Food and drinks",
  "Food delivery": "Food and drinks",
  // Housing (Habitação)
  Rent: "Housing",
  Utilities: "Housing",
  Electricity: "Housing",
  Water: "Housing",
  Gas: "Housing",
  Houseware: "Housing",
  "Urban land and building tax": "Housing",
  // Transportation (Transporte)
  "Taxi and ride-hailing": "Transportation",
  "Gas stations": "Transportation",
  Parking: "Transportation",
  "Public transportation": "Transportation",
  "Vehicle maintenance": "Transportation",
  "Car rental": "Transportation",
  "Tolls and in-vehicle payment": "Transportation",
  "Vehicle ownership taxes and fees": "Transportation",
  "Traffic tickets": "Transportation",
  Bicycle: "Transportation",
  // Services (Serviços)
  Telecommunications: "Services",
  Internet: "Services",
  Mobile: "Services",
  TV: "Services",
  "Gyms and fitness centers": "Services",
  "Wellness and fitness": "Services",
  "Sports practice": "Services",
  // Shopping (Compras)
  "Online shopping": "Shopping",
  Clothing: "Shopping",
  Electronics: "Shopping",
  "Pet supplies and vet": "Shopping",
  "Kids and toys": "Shopping",
  Bookstore: "Shopping",
  "Sports goods": "Shopping",
  "Office Supplies": "Shopping",
  // Healthcare (Saúde)
  Pharmacy: "Healthcare",
  "Hospital clinics and labs": "Healthcare",
  Dentist: "Healthcare",
  Optometry: "Healthcare",
  // Leisure (Lazer)
  "Cinema, theater and concerts": "Leisure",
  Tickets: "Leisure",
  "Stadiums and arenas": "Leisure",
  "Landmarks and museums": "Leisure",
  // Digital services (Serviços Digitais)
  "Video streaming": "Digital services",
  "Music streaming": "Digital services",
  Gaming: "Digital services",
  // Education (Educação)
  "Online Courses": "Education",
  University: "Education",
  School: "Education",
  Kindergarten: "Education",
  // Travel (Viagens)
  "Airport and airlines": "Travel",
  Accommodation: "Travel",
  "Bus tickets": "Travel",
  "Mileage programs": "Travel",
  // Insurance (Seguro)
  "Life insurance": "Insurance",
  "Home Insurance": "Insurance",
  "Health insurance": "Insurance",
  "Vehicle insurance": "Insurance",
  // Loans and Financing (Empréstimos e Financiamentos)
  Loans: "Loans and Financing",
  Financing: "Loans and Financing",
  "Real estate financing": "Loans and Financing",
  "Vehicle Financing": "Loans and Financing",
  "Student loan": "Loans and Financing",
  "Late payment and overdraft costs": "Loans and Financing",
  "Interests charged": "Loans and Financing",
  // Gambling (Jogos de Azar)
  Lottery: "Gambling",
  "Online bet": "Gambling",
  // Legal obligations (Obrigações Legais)
  Alimony: "Legal obligations",
  "Blocked balances": "Legal obligations",
};

/**
 * Returns canonical key for budget target (preserves subcategories).
 */
export function canonicalBudgetCategory(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const trimmed = String(raw).trim();
  if (!trimmed) return "Other";
  if (SUBCATEGORY_TO_PARENT[trimmed]) return trimmed;

  for (const key of Object.keys(SUBCATEGORY_TO_PARENT)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return key;
    if (translateCategory(key).toLowerCase() === trimmed.toLowerCase()) return key;
  }

  for (const [label, baseKey] of Object.entries(PT_LABEL_TO_BASE_KEY)) {
    if (label.toLowerCase() === trimmed.toLowerCase() && SUBCATEGORY_TO_PARENT[baseKey]) {
      return baseKey;
    }
  }

  return resolveBudgetCategoryKey(trimmed);
}

export function isSubcategory(keyOrLabel: string | null | undefined): boolean {
  if (!keyOrLabel) return false;
  const canonical = canonicalBudgetCategory(keyOrLabel);
  return Boolean(SUBCATEGORY_TO_PARENT[canonical]);
}

export function getParentCategoryKey(keyOrLabel: string | null | undefined): string | null {
  if (!keyOrLabel) return null;
  const canonical = canonicalBudgetCategory(keyOrLabel);
  return SUBCATEGORY_TO_PARENT[canonical] || null;
}

export function getParentCategoryLabel(keyOrLabel: string | null | undefined): string | null {
  const parentKey = getParentCategoryKey(keyOrLabel);
  if (!parentKey) return null;
  return BASE_KEY_TO_LABEL[parentKey] || parentKey;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function normalizeBudgetPeriod(period: unknown): BudgetPeriod {
  return BUDGET_PERIODS.includes(period as BudgetPeriod) ? period as BudgetPeriod : "monthly";
}

export function daysInMonth(ym: string): number {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

export function lastDayOfMonth(ym: string): string {
  return `${ym}-${pad2(daysInMonth(ym))}`;
}

export function periodCount(period: unknown, ym: string): number {
  const p = normalizeBudgetPeriod(period);
  if (p === "daily") return daysInMonth(ym);
  if (p === "weekly") return 4;
  if (p === "biweekly") return 2;
  return 1;
}

export function asOfForBudgetMonth(ym: string, today = todayISO()): string {
  const asOf = String(today || todayISO()).slice(0, 10);
  const todayYm = asOf.slice(0, 7);
  if (ym && ym < todayYm) return lastDayOfMonth(ym);
  if (ym && ym > todayYm) return `${ym}-01`;
  return asOf;
}

export function startedPeriods(period: unknown, ym: string, asOfDate: string): number {
  const p = normalizeBudgetPeriod(period);
  const count = periodCount(p, ym);
  const asOf = String(asOfDate || "").slice(0, 10);
  if (!asOf || !ym) return 0;
  const asOfYm = asOf.slice(0, 7);
  if (asOfYm < ym) return 0;
  if (asOfYm > ym) return count;
  const day = Number(asOf.slice(8, 10)) || 1;
  if (p === "daily") return Math.min(count, Math.max(1, day));
  if (p === "weekly") {
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    return 4;
  }
  if (p === "biweekly") return day <= 15 ? 1 : 2;
  return 1;
}

export function allowance(amount: number, period: unknown, ym: string, asOfDate: string): number {
  return Number(((Number(amount) || 0) * startedPeriods(period, ym, asOfDate)).toFixed(2));
}

export function monthCap(amount: number, period: unknown, ym: string): number {
  return Number(((Number(amount) || 0) * periodCount(period, ym)).toFixed(2));
}

export type BudgetInput = {
  id?: string;
  category: string;
  limit: number;
  period?: string;
};

export type BudgetTransactionRow = {
  id: string;
  description: string;
  date: string;
  amount: number;
  isMeal: boolean;
  accountName: string;
  subCategoryLabel?: string;
};

export type BudgetRow = {
  id: string;
  category: string;
  categoryLabel: string;
  isSubcategory?: boolean;
  parentCategoryLabel?: string | null;
  spentBank: number;
  spentMeal: number;
  spent: number;
  period: BudgetPeriod;
  periodAmount: number;
  allowance: number;
  monthCap: number;
  limit: number;
  hasLimit: boolean;
  periodIndex: number;
  periodCount: number;
  percent: number;
  subcategories?: { label: string; spent: number }[];
  transactions?: BudgetTransactionRow[];
};

export function mergeBudgetRows(opts: {
  spentBankMap?: Record<string, number>;
  spentMealMap?: Record<string, number>;
  budgets?: BudgetInput[];
  ym: string;
  asOfDate?: string;
  subSpend?: Record<string, Record<string, number>>;
  txsByKey?: Record<string, BudgetTransactionRow[]>;
}): BudgetRow[] {
  const spentBankMap = opts.spentBankMap || {};
  const spentMealMap = opts.spentMealMap || {};
  const budgets = opts.budgets || [];
  const ym = opts.ym;
  const asOf = opts.asOfDate || asOfForBudgetMonth(ym);
  const subSpend = opts.subSpend || {};
  const txsByKey = opts.txsByKey || {};
  const rows: Record<string, Omit<BudgetRow, "percent">> = {};

  const addSpent = (cat: string, bank: number, meal: number) => {
    if (!cat) return;
    const canonical = canonicalBudgetCategory(cat);
    const isSub = isSubcategory(canonical);
    if (!rows[canonical]) {
      const parentLabel = isSub ? getParentCategoryLabel(canonical) : null;
      rows[canonical] = {
        id: canonical,
        category: canonical,
        categoryLabel: isSub ? translateCategory(canonical) : (BASE_KEY_TO_LABEL[canonical] || canonical),
        isSubcategory: isSub,
        parentCategoryLabel: parentLabel,
        spentBank: 0,
        spentMeal: 0,
        spent: 0,
        period: "monthly",
        periodAmount: 0,
        allowance: 0,
        monthCap: 0,
        limit: 0,
        hasLimit: false,
        periodIndex: 1,
        periodCount: 1,
      };
    }
    rows[canonical].spentBank += bank;
    rows[canonical].spentMeal += meal;
    rows[canonical].spent = rows[canonical].spentBank + rows[canonical].spentMeal;
  };

  Object.entries(spentBankMap).forEach(([cat, spent]) => addSpent(cat, Number(spent) || 0, 0));
  Object.entries(spentMealMap).forEach(([cat, spent]) => addSpent(cat, 0, Number(spent) || 0));

  budgets.forEach((b) => {
    const rawCat = String(b.category || "");
    if (!rawCat) return;
    const cat = canonicalBudgetCategory(rawCat);
    const isSub = isSubcategory(cat);
    const period = normalizeBudgetPeriod(b.period);
    const periodAmount = Number(b.limit) || 0;
    const started = startedPeriods(period, ym, asOf);
    const count = periodCount(period, ym);
    const earned = allowance(periodAmount, period, ym, asOf);
    const cap = monthCap(periodAmount, period, ym);
    const parentLabel = isSub ? getParentCategoryLabel(cat) : null;

    if (!rows[cat]) {
      rows[cat] = {
        id: String(b.id || cat),
        category: cat,
        categoryLabel: isSub ? translateCategory(cat) : (BASE_KEY_TO_LABEL[cat] || cat),
        isSubcategory: isSub,
        parentCategoryLabel: parentLabel,
        spentBank: spentBankMap[cat] || 0,
        spentMeal: spentMealMap[cat] || 0,
        spent: (spentBankMap[cat] || 0) + (spentMealMap[cat] || 0),
        period,
        periodAmount,
        allowance: earned,
        monthCap: cap,
        limit: earned,
        hasLimit: true,
        periodIndex: started,
        periodCount: count,
      };
    } else {
      rows[cat].id = String(b.id || cat);
      rows[cat].period = period;
      rows[cat].periodAmount = periodAmount;
      rows[cat].allowance = earned;
      rows[cat].monthCap = cap;
      rows[cat].limit = earned;
      rows[cat].hasLimit = true;
      rows[cat].periodIndex = started;
      rows[cat].periodCount = count;
      rows[cat].isSubcategory = isSub;
      rows[cat].parentCategoryLabel = parentLabel;
      if (isSub) {
        rows[cat].categoryLabel = translateCategory(cat);
      }
    }
  });

  return Object.values(rows)
    .filter((row) => row.hasLimit) // Show only categories with defined budget
    .map((row) => {
      const spent = Number(row.spent.toFixed(2));
      const spentBank = Number(row.spentBank.toFixed(2));
      const spentMeal = Number(row.spentMeal.toFixed(2));
      const limit = Number((row.limit || 0).toFixed(2));
      const categoryLabel = row.categoryLabel || (row.isSubcategory ? translateCategory(row.category) : (BASE_KEY_TO_LABEL[row.category] || row.category));
      const subs = !row.isSubcategory ? subSpend[row.category] : null;
      const subcategories = subs
        ? Object.entries(subs)
            .map(([label, s]) => ({ label, spent: Number(s.toFixed(2)) }))
            .sort((a, b) => b.spent - a.spent)
        : [];
      const transactions = txsByKey[row.category]
        ? [...txsByKey[row.category]].sort((a, b) => b.date.localeCompare(a.date))
        : [];

      return {
        ...row,
        categoryLabel,
        spent,
        spentBank,
        spentMeal,
        allowance: Number((row.allowance || 0).toFixed(2)),
        monthCap: Number((row.monthCap || 0).toFixed(2)),
        periodAmount: Number((row.periodAmount || 0).toFixed(2)),
        limit,
        percent: limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0,
        subcategories,
        transactions,
      };
    })
    .sort((a, b) => {
      const aOver = a.hasLimit && a.spent > a.limit;
      const bOver = b.hasLimit && b.spent > b.limit;
      if (aOver !== bOver) return aOver ? -1 : 1;
      return b.spent - a.spent;
    });
}
