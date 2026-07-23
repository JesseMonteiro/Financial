import { translateCategory } from './categories.js';
import { isBillPayment } from './creditBillPeriod.js';

function merchantName(tx) {
  return (
    tx?.merchant?.businessName ||
    tx?.merchant?.name ||
    tx?.originalDescription ||
    tx?.description ||
    'Desconhecido'
  );
}

function isExpenseTx(tx) {
  if (!tx || isBillPayment(tx)) return false;
  if (tx.type === 'CREDIT' || tx.type === 'CREDIT_INCOME') return false;
  return Number(tx.amount) < 0 || tx.type === 'DEBIT';
}

/** Fixed UI order for subscription kind sections */
export const SUBSCRIPTION_KIND_ORDER = [
  'streaming',
  'telecom',
  'servicos_digitais',
  'utilidades',
  'fitness',
  'educacao',
  'outros',
];

export const SUBSCRIPTION_KIND_LABELS = {
  streaming: 'Streaming',
  telecom: 'Telecom',
  servicos_digitais: 'Serviços digitais',
  utilidades: 'Utilidades',
  fitness: 'Fitness',
  educacao: 'Educação',
  outros: 'Outros',
};

/** Merchant keywords (normalized uppercase) → subscription kind. Longer phrases first. */
const MERCHANT_CATALOG = [
  // Streaming
  { kind: 'streaming', keywords: ['AMAZON PRIME', 'PRIME VIDEO', 'APPLE TV', 'YOUTUBE PREMIUM', 'YOUTUBE MUSIC'] },
  { kind: 'streaming', keywords: ['NETFLIX', 'HBO', 'MAX COM', 'DISNEY', 'SPOTIFY', 'GLOBOPLAY', 'PARAMOUNT', 'CRUNCHYROLL', 'DEEZER', 'TIDAL', 'APPLE MUSIC'] },
  // Telecom
  { kind: 'telecom', keywords: ['BRISANET', 'STARLINK', 'VIVO', 'CLARO', 'TIM ', ' TIM', ' OI ', 'OI FIBRA', 'SKY ', 'NET VIRTUA', 'OI FIXO'] },
  // Digital services
  { kind: 'servicos_digitais', keywords: ['APPLE.COM/BILL', 'APPLE BILL', 'APPLE.COM', 'ICLOUD', 'OPENAI', 'CHATGPT', 'CURSOR'] },
  { kind: 'servicos_digitais', keywords: ['MICROSOFT', 'ADOBE', 'DROPBOX', 'GITHUB', 'GOOGLE ONE', 'GOOGLE STORAGE', 'GOOGLE *', 'PLAYSTATION', 'XBOX', 'NINTENDO'] },
  // Utilities
  { kind: 'utilidades', keywords: ['EQUATORIAL', 'COMPESA', 'CAGECE', 'SANEAGO', 'ENEL', 'CEMIG', 'LIGHT ', 'COELBA', 'COSERN'] },
  // Fitness
  { kind: 'fitness', keywords: ['SMART FIT', 'SMARTFIT', 'BODYTECH', 'TOTALPASS', 'GYMPASS', 'BLUEFIT'] },
  // Education
  { kind: 'educacao', keywords: ['UDEMY', 'COURSERA', 'ALURA', 'DUOLINGO', 'HOTMART', 'EBAC'] },
];

/** Always exclude these merchants / description fragments */
const MERCHANT_BLOCKLIST = [
  'UBER',
  '99APP',
  '99 POP',
  'IFOOD',
  'RAPPI',
  'PADARIA',
  'POSTO ',
  'SHELL',
  'IPIRANGA',
  'RAIZEN',
  'SUPERMERCADO',
  'ATACADAO',
  'ATACADÃO',
  'ASSAI',
  'ASSAÍ',
  'DROGASIL',
  'DROGA RAIA',
  'PANVEL',
  'MERCADO LIVRE',
  'SHOPEE',
  'AMAZON MARKETPLACE',
  'MAGALU',
  'AMERICANAS',
  'PICPAY',
  'NUBANK TRANSF',
  'TED ',
  'PIX ',
  'SAQUE',
];

/** Pluggy categories that are never subscriptions */
const CATEGORY_BLOCKLIST = new Set([
  'Groceries',
  'Eating out',
  'Food delivery',
  'Taxi and ride-hailing',
  'Gas stations',
  'Parking',
  'Transfers',
  'Credit card payment',
  'Shopping',
  'Clothing',
  'Car rental',
  'Tickets',
  'Cinema, theater and concerts',
  'Houseware',
]);

/** Pluggy categories that can signal a subscription without a merchant match */
const CATEGORY_ALLOWLIST = new Set([
  'Digital services',
  'Telecommunications',
  'Gaming',
  'Services',
  'Gyms and fitness centers',
  'Wellness and fitness',
  'Rent',
]);

function normalizeText(text) {
  return String(text || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function txSearchBlob(tx) {
  return normalizeText(
    [
      merchantName(tx),
      tx?.originalDescription,
      tx?.description,
      tx?.descriptionRaw,
      tx?.merchant?.businessName,
      tx?.merchant?.name,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function isBlockedMerchant(blob) {
  return MERCHANT_BLOCKLIST.some((kw) => blob.includes(normalizeText(kw)));
}

/**
 * Classify a transaction as a subscription candidate.
 * @returns {{ kind: string, label: string, fromCatalog: boolean } | null}
 */
export function classifySubscription(tx) {
  if (!tx || !isExpenseTx(tx)) return null;

  const pluggyCat = tx.category || '';
  if (CATEGORY_BLOCKLIST.has(pluggyCat)) return null;

  const blob = txSearchBlob(tx);
  if (!blob || isBlockedMerchant(blob)) return null;

  for (const entry of MERCHANT_CATALOG) {
    for (const kw of entry.keywords) {
      const needle = normalizeText(kw);
      if (needle && blob.includes(needle)) {
        return {
          kind: entry.kind,
          label: SUBSCRIPTION_KIND_LABELS[entry.kind] || entry.kind,
          fromCatalog: true,
        };
      }
    }
  }

  // Soft allow via Pluggy category (no strong merchant match)
  if (CATEGORY_ALLOWLIST.has(pluggyCat)) {
    let kind = 'outros';
    if (pluggyCat === 'Digital services' || pluggyCat === 'Gaming') kind = 'servicos_digitais';
    else if (pluggyCat === 'Telecommunications') kind = 'telecom';
    else if (pluggyCat === 'Gyms and fitness centers' || pluggyCat === 'Wellness and fitness') kind = 'fitness';
    else if (pluggyCat === 'Services') kind = 'servicos_digitais';
    else if (pluggyCat === 'Rent') kind = 'utilidades';

    return {
      kind,
      label: SUBSCRIPTION_KIND_LABELS[kind] || kind,
      fromCatalog: false,
    };
  }

  return null;
}

export function monthlyEquivalentFor(amount, frequency = 'monthly') {
  const n = Number(amount) || 0;
  if (frequency === 'weekly') return Number((n * 4.33).toFixed(2));
  if (frequency === 'yearly') return Number((n / 12).toFixed(2));
  if (frequency === 'bimonthly') return Number((n / 2).toFixed(2));
  return Number(n.toFixed(2));
}

function groupKeyFor(tx) {
  const raw = merchantName(tx)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\d{1,2}\/\d{1,2}/g, '')
    .trim();
  return raw.slice(0, 40) || 'OUTROS';
}

/**
 * Detect recurring subscriptions from expense transactions.
 * Uses merchant catalog + Pluggy category filters to avoid noise (Uber, groceries, etc.).
 *
 * @param {object[]} transactions
 * @param {{ minOccurrences?: number, catalogMinOccurrences?: number, amountTolerance?: number }} [opts]
 */
export function detectSubscriptions(
  transactions = [],
  { minOccurrences = 3, catalogMinOccurrences = 2, amountTolerance = 0.15 } = {}
) {
  const candidates = transactions.filter((t) => classifySubscription(t));
  const groups = {};

  candidates.forEach((t) => {
    const key = groupKeyFor(t);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const results = [];
  Object.entries(groups).forEach(([key, txs]) => {
    const classifs = txs.map((t) => classifySubscription(t)).filter(Boolean);
    const fromCatalog = classifs.some((c) => c.fromCatalog);
    const needed = fromCatalog ? catalogMinOccurrences : minOccurrences;
    if (txs.length < needed) return;

    const amounts = txs.map((t) => Math.abs(Number(t.amount) || 0)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const similar = txs.filter((t) => {
      const a = Math.abs(Number(t.amount) || 0);
      return median === 0 ? a === 0 : Math.abs(a - median) / median <= amountTolerance;
    });
    if (similar.length < needed) return;

    const dates = similar
      .map((t) => new Date(t.date))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a - b);
    if (dates.length < 2) return;

    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    let frequency = 'monthly';
    if (avgGap <= 10) frequency = 'weekly';
    else if (avgGap >= 300) frequency = 'yearly';
    else if (avgGap > 40 && avgGap < 80) frequency = 'bimonthly';

    // Skip accidental duplicates with huge irregular gaps labeled monthly
    if (avgGap > 100 && frequency === 'monthly') return;

    // Non-catalog weekly spend (e.g. services used often) is usually not a subscription
    if (!fromCatalog && frequency === 'weekly') return;

    // For soft (category-only) matches, prefer roughly monthly cadence
    if (!fromCatalog && frequency === 'monthly' && (avgGap < 20 || avgGap > 45)) return;

    const lastDate = dates[dates.length - 1];
    const nextDate = new Date(lastDate);
    if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
    else if (frequency === 'bimonthly') nextDate.setMonth(nextDate.getMonth() + 2);
    else nextDate.setMonth(nextDate.getMonth() + 1);

    const sample = similar[similar.length - 1];
    const classified = classifySubscription(sample) || {
      kind: 'outros',
      label: SUBSCRIPTION_KIND_LABELS.outros,
      fromCatalog: false,
    };

    results.push({
      id: key,
      name: merchantName(sample),
      amount: Number(median.toFixed(2)),
      frequency,
      occurrences: similar.length,
      lastDate: lastDate.toISOString(),
      nextDate: nextDate.toISOString(),
      category: translateCategory(sample.category),
      subscriptionKind: classified.kind,
      subscriptionKindLabel: classified.label,
      fromCatalog: classified.fromCatalog,
      monthlyEquivalent: monthlyEquivalentFor(median, frequency),
    });
  });

  // Explicit manual recurrings
  transactions
    .filter((t) => t.isManual && t.isRecurring && isExpenseTx(t))
    .forEach((t) => {
      const name = t.originalDescription || t.description;
      const already = results.some((r) =>
        r.name.toLowerCase().includes(String(name).toLowerCase().slice(0, 20))
      );
      if (already) return;

      // Still skip obvious noise even for manuals
      if (isBlockedMerchant(txSearchBlob(t))) return;
      if (CATEGORY_BLOCKLIST.has(t.category || '')) return;

      const classified = classifySubscription(t) || {
        kind: 'outros',
        label: SUBSCRIPTION_KIND_LABELS.outros,
        fromCatalog: false,
      };
      const amount = Math.abs(Number(t.amount) || 0);
      const frequency = t.frequency || 'monthly';
      const next = new Date(t.date);
      results.push({
        id: `manual_${t.id}`,
        name,
        amount,
        frequency,
        occurrences: 1,
        lastDate: t.date,
        nextDate: next.toISOString(),
        category: translateCategory(t.category),
        subscriptionKind: classified.kind,
        subscriptionKindLabel: classified.label,
        fromCatalog: classified.fromCatalog,
        monthlyEquivalent: monthlyEquivalentFor(amount, frequency),
        isManual: true,
      });
    });

  return results.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
}

/**
 * Group detected subscriptions by kind for UI sections.
 * @param {ReturnType<typeof detectSubscriptions>} subscriptions
 */
export function groupSubscriptionsByKind(subscriptions = []) {
  const map = Object.fromEntries(
    SUBSCRIPTION_KIND_ORDER.map((kind) => [
      kind,
      {
        kind,
        label: SUBSCRIPTION_KIND_LABELS[kind],
        items: [],
        monthlyTotal: 0,
      },
    ])
  );

  subscriptions.forEach((sub) => {
    const kind = map[sub.subscriptionKind] ? sub.subscriptionKind : 'outros';
    map[kind].items.push(sub);
    map[kind].monthlyTotal += Number(sub.monthlyEquivalent) || 0;
  });

  return SUBSCRIPTION_KIND_ORDER.map((kind) => ({
    ...map[kind],
    monthlyTotal: Number(map[kind].monthlyTotal.toFixed(2)),
  })).filter((g) => g.items.length > 0);
}
