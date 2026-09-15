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
  const match = (Array.isArray(categories) ? categories : []).find((c) => c.key === key);
  if (match?.color) return match.color;
  return null;
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
