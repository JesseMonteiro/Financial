// Category translation dictionary for Pluggy API categories
const CATEGORY_TRANSLATIONS = {
  'Groceries': 'Supermercado & Alimentação',
  'Eating out': 'Restaurantes & Bares',
  'Food delivery': 'Delivery de Comida',
  'Cinema, theater and concerts': 'Cinema, Teatro & Shows',
  'Parking': 'Estacionamento',
  'Shopping': 'Compras & Lojas',
  'Services': 'Serviços',
  'Tickets': 'Ingressos & Eventos',
  'Digital services': 'Serviços Digitais',
  'Telecommunications': 'Telefone & Internet',
  'Car rental': 'Aluguel de Carros',
  'Automotive': 'Automóvel',
  'Gas stations': 'Postos de Combustível',
  'Vehicle maintenance': 'Manutenção Veicular',
  'Taxi and ride-hailing': 'Uber / Táxi / Transporte',
  'Healthcare': 'Saúde & Medicina',
  'Dentist': 'Odontologia',
  'Pharmacy': 'Farmácia & Drogaria',
  'Optometry': 'Ótica & Visão',
  'Gyms and fitness centers': 'Academias & Fitness',
  'Wellness and fitness': 'Bem-estar & Fitness',
  'Houseware': 'Utilidades Domésticas',
  'Rent': 'Aluguel',
  'Clothing': 'Vestuário & Roupas',
  'Gaming': 'Games & Entretenimento',
  'Transfers': 'Transferências',
  'Credit card payment': 'Pagamento de Fatura',
  'Bank fees': 'Tarifas Bancárias',
  'Salary': 'Salário & Renda',
  'Investments': 'Investimentos',
  'Other': 'Outros',
};

export function translateCategory(category) {
  if (!category) return 'Geral';
  return CATEGORY_TRANSLATIONS[category] || category;
}

export function allTranslations() {
  return CATEGORY_TRANSLATIONS;
}

export const DEFAULT_PURCHASE_CATEGORIES = [
  { key: 'Food', label: 'Alimentação', color: '#f97316', sortOrder: 0 },
  { key: 'Groceries', label: 'Supermercado', color: '#fb923c', sortOrder: 1 },
  { key: 'Rent', label: 'Aluguel / Habitação', color: '#a855f7', sortOrder: 2 },
  { key: 'Utilities', label: 'Contas de Consumo (Água, Luz)', color: '#c084fc', sortOrder: 3 },
  { key: 'Transport', label: 'Transporte', color: '#0ea5e9', sortOrder: 4 },
  { key: 'Entertainment', label: 'Lazer / Entretenimento', color: '#ec4899', sortOrder: 5 },
  { key: 'Health', label: 'Saúde', color: '#10b981', sortOrder: 6 },
  { key: 'Education', label: 'Educação', color: '#eab308', sortOrder: 7 },
  { key: 'Other', label: 'Outros', color: '#64748b', sortOrder: 8 },
];

const PURCHASE_CATEGORY_KEYS = new Set(DEFAULT_PURCHASE_CATEGORIES.map((c) => c.key));

/** Lucide icon name per purchase category key (mirrors iOS SF Symbols). */
export const CATEGORY_ICON_NAMES = {
  Food: 'utensils',
  Groceries: 'shopping-cart',
  Rent: 'home',
  Utilities: 'zap',
  Transport: 'car',
  Entertainment: 'ticket',
  Health: 'heart-pulse',
  Education: 'graduation-cap',
  Other: 'circle-ellipsis',
};

const PLUGGY_TO_KIND = {
  'Eating out': 'Food',
  'Food delivery': 'Food',
  Groceries: 'Groceries',
  Houseware: 'Groceries',
  Rent: 'Rent',
  Telecommunications: 'Utilities',
  Services: 'Utilities',
  'Digital services': 'Utilities',
  Parking: 'Transport',
  'Car rental': 'Transport',
  Automotive: 'Transport',
  'Gas stations': 'Transport',
  'Vehicle maintenance': 'Transport',
  'Taxi and ride-hailing': 'Transport',
  'Cinema, theater and concerts': 'Entertainment',
  Tickets: 'Entertainment',
  Shopping: 'Entertainment',
  Clothing: 'Entertainment',
  Gaming: 'Entertainment',
  Healthcare: 'Health',
  Dentist: 'Health',
  Pharmacy: 'Health',
  Optometry: 'Health',
  'Gyms and fitness centers': 'Health',
  'Wellness and fitness': 'Health',
  Other: 'Other',
  Transfers: 'Other',
  'Credit card payment': 'Other',
  'Bank fees': 'Other',
  Salary: 'Other',
  Investments: 'Other',
};

export const MANUAL_CATEGORY_OPTIONS = DEFAULT_PURCHASE_CATEGORIES.map((c) => ({
  value: c.key,
  label: c.label,
}));

export function sortPurchaseCategories(categories = []) {
  return [...categories].sort((a, b) => {
    const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (order !== 0) return order;
    return String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR');
  });
}

export function userCategoryOptions(categories = []) {
  const source = Array.isArray(categories) && categories.length
    ? categories
    : DEFAULT_PURCHASE_CATEGORIES;
  return sortPurchaseCategories(source).map((c) => ({
    value: c.key,
    label: c.label,
    color: c.color,
  }));
}

export function resolveCategoryLabel(key, categories = []) {
  if (!key) return 'Geral';
  const match = userCategoryOptions(categories).find((opt) => opt.value === key);
  if (match) return match.label;
  return translateCategory(key);
}

export function resolveCategoryColor(key, categories = []) {
  if (!key) return null;
  const list = Array.isArray(categories) ? categories : [];
  const match = list.find((c) => c.key === key);
  if (match?.color) return match.color;
  const def = DEFAULT_PURCHASE_CATEGORIES.find((c) => c.key === key);
  if (def?.color) return def.color;
  const kind = resolveCategoryKind(key);
  if (kind) {
    const byKind = DEFAULT_PURCHASE_CATEGORIES.find((c) => c.key === kind);
    if (byKind?.color) return byKind.color;
  }
  return null;
}

/** Maps purchase / Pluggy category keys onto the closed default set. */
export function resolveCategoryKind(raw) {
  if (!raw) return null;
  const key = String(raw).trim();
  if (!key) return null;
  if (PURCHASE_CATEGORY_KEYS.has(key)) return key;
  return PLUGGY_TO_KIND[key] || null;
}

/** Lucide icon name aligned with iOS SF Symbols per category. */
export function getCategoryIconName(raw) {
  const kind = resolveCategoryKind(raw) || 'Other';
  return CATEGORY_ICON_NAMES[kind] || CATEGORY_ICON_NAMES.Other;
}

/** Hex tint for a category key (defaults when custom color missing). */
export function getCategoryTint(raw, categories = []) {
  return resolveCategoryColor(raw, categories)
    || DEFAULT_PURCHASE_CATEGORIES.find((c) => c.key === (resolveCategoryKind(raw) || 'Other'))?.color
    || '#64748b';
}

export function slugifyCategoryKey(label, existingKeys = []) {
  const words = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let base = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('') || 'Category';
  if (/^[0-9]/.test(base)) base = `Cat${base}`;
  const used = new Set((existingKeys || []).map((k) => String(k).toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let i = 2;
  while (used.has(`${base}${i}`.toLowerCase())) i += 1;
  return `${base}${i}`;
}

export function pluggyCategoryOptions(categories = []) {
  const list = Array.isArray(categories) ? categories : [];
  const leaves = list.filter((c) => c?.parentId);
  const source = leaves.length ? leaves : list;
  return source
    .map((c) => ({
      value: String(c.id || ''),
      label: c.descriptionTranslated || translateCategory(c.description) || c.description || String(c.id || ''),
    }))
    .filter((opt) => opt.value)
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

export function selectedCategoryValue(item, options = []) {
  const ids = new Set((options || []).map((opt) => opt.value));
  const preferred = item?.categoryId || item?.categoryKey || '';
  if (preferred && ids.has(preferred)) return preferred;
  const label = String(
    item?.metadata?.find((row) => row.label === 'Categoria')?.value
      || item?.category
      || ''
  ).trim().toLowerCase();
  if (label) {
    const byLabel = options.find((opt) => String(opt.label).toLowerCase() === label);
    if (byLabel) return byLabel.value;
  }
  return preferred;
}
