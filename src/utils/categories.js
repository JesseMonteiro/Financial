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
  { key: 'Food', label: 'Alimentação', color: '#f97316', icon: 'utensils', sortOrder: 0 },
  { key: 'Groceries', label: 'Supermercado', color: '#fb923c', icon: 'cart', sortOrder: 1 },
  { key: 'Rent', label: 'Aluguel / Habitação', color: '#a855f7', icon: 'home', sortOrder: 2 },
  { key: 'Utilities', label: 'Contas de Consumo (Água, Luz)', color: '#c084fc', icon: 'bolt', sortOrder: 3 },
  { key: 'Transport', label: 'Transporte', color: '#0ea5e9', icon: 'car', sortOrder: 4 },
  { key: 'Entertainment', label: 'Lazer / Entretenimento', color: '#ec4899', icon: 'ticket', sortOrder: 5 },
  { key: 'Health', label: 'Saúde', color: '#10b981', icon: 'crosscase', sortOrder: 6 },
  { key: 'Education', label: 'Educação', color: '#eab308', icon: 'graduationcap', sortOrder: 7 },
  { key: 'Other', label: 'Outros', color: '#64748b', icon: 'ellipsis', sortOrder: 8 },
];

const PURCHASE_CATEGORY_KEYS = new Set(DEFAULT_PURCHASE_CATEGORIES.map((c) => c.key));

/** Shared icon ids (aligned with iOS CategoryIconCatalog). */
export const CATEGORY_ICON_OPTIONS = [
  { id: 'utensils', label: 'Alimentação' },
  { id: 'cart', label: 'Supermercado' },
  { id: 'bag', label: 'Sacola' },
  { id: 'cup', label: 'Café' },
  { id: 'takeout', label: 'Delivery' },
  { id: 'wineglass', label: 'Bar' },
  { id: 'home', label: 'Casa' },
  { id: 'building', label: 'Prédio' },
  { id: 'sofa', label: 'Móveis' },
  { id: 'bolt', label: 'Energia' },
  { id: 'drop', label: 'Água' },
  { id: 'flame', label: 'Gás' },
  { id: 'wifi', label: 'Internet' },
  { id: 'phone', label: 'Telefone' },
  { id: 'car', label: 'Carro' },
  { id: 'bus', label: 'Ônibus' },
  { id: 'tram', label: 'Metrô' },
  { id: 'fuelpump', label: 'Combustível' },
  { id: 'bicycle', label: 'Bicicleta' },
  { id: 'airplane', label: 'Viagem' },
  { id: 'bed', label: 'Hotel' },
  { id: 'ticket', label: 'Ingresso' },
  { id: 'film', label: 'Cinema' },
  { id: 'gamecontroller', label: 'Games' },
  { id: 'music', label: 'Música' },
  { id: 'tv', label: 'Streaming' },
  { id: 'party', label: 'Festa' },
  { id: 'heart', label: 'Saúde' },
  { id: 'crosscase', label: 'Farmácia' },
  { id: 'pills', label: 'Remédios' },
  { id: 'figure', label: 'Esporte' },
  { id: 'graduationcap', label: 'Educação' },
  { id: 'book', label: 'Livros' },
  { id: 'pencil', label: 'Estudos' },
  { id: 'briefcase', label: 'Trabalho' },
  { id: 'creditcard', label: 'Cartão' },
  { id: 'banknote', label: 'Dinheiro' },
  { id: 'chart', label: 'Investimentos' },
  { id: 'percent', label: 'Juros' },
  { id: 'gift', label: 'Presente' },
  { id: 'pawprint', label: 'Pets' },
  { id: 'tshirt', label: 'Roupas' },
  { id: 'scissors', label: 'Beleza' },
  { id: 'wrench', label: 'Serviços' },
  { id: 'hammer', label: 'Reforma' },
  { id: 'leaf', label: 'Natureza' },
  { id: 'baby', label: 'Família' },
  { id: 'stroller', label: 'Bebê' },
  { id: 'handraised', label: 'Doação' },
  { id: 'shield', label: 'Seguro' },
  { id: 'doc', label: 'Documentos' },
  { id: 'envelope', label: 'Correios' },
  { id: 'cartbadge', label: 'Compras+' },
  { id: 'storefront', label: 'Loja' },
  { id: 'tag', label: 'Etiqueta' },
  { id: 'star', label: 'Favorito' },
  { id: 'sparkles', label: 'Destaque' },
  { id: 'ellipsis', label: 'Outros' },
];

const DEFAULT_ICON_BY_KIND = {
  Food: 'utensils',
  Groceries: 'cart',
  Rent: 'home',
  Utilities: 'bolt',
  Transport: 'car',
  Entertainment: 'ticket',
  Health: 'crosscase',
  Education: 'graduationcap',
  Other: 'ellipsis',
};

/** @deprecated use DEFAULT_ICON_BY_KIND / getCategoryIconId */
export const CATEGORY_ICON_NAMES = DEFAULT_ICON_BY_KIND;

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

/** Stable icon id for a category key (honors stored `icon` on user categories). */
export function getCategoryIconId(raw, categories = []) {
  const list = Array.isArray(categories) ? categories : [];
  if (raw) {
    const match = list.find((c) => c.key === raw);
    if (match?.icon) return match.icon;
    const def = DEFAULT_PURCHASE_CATEGORIES.find((c) => c.key === raw);
    if (def?.icon) return def.icon;
  }
  const kind = resolveCategoryKind(raw) || 'Other';
  return DEFAULT_ICON_BY_KIND[kind] || 'ellipsis';
}

/** @deprecated use getCategoryIconId */
export function getCategoryIconName(raw, categories = []) {
  return getCategoryIconId(raw, categories);
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
