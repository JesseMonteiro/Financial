import { CATALOG_BY_ID, catalogEntryUrl, suggestIconKey, shareCardFacesByProduct } from './accountIcons';

function publicFace(file) {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}card-faces/${file}`;
}

/** Catalog id → file under public/card-faces/. Products fall back to parent bank file. */
const CARD_FACE_FILE = {
  'santander-unique': 'santander-unique.png',
  'santander-sx': 'santander.png',
  'santander-unlimited': 'santander.png',
  santander: 'santander.png',
  'nubank-ultravioleta': 'nubank-ultravioleta.png',
  'nubank-rewards': 'nubank.png',
  nubank: 'nubank.png',
  'itau-personnalite': 'itau.png',
  'itau-latam': 'itau.png',
  'itau-click': 'itau-click.png',
  'itau-extra': 'itau-extra.png',
  'itau-azul': 'itau-azul.jpg',
  'itau-platinum': 'itau-platinum.png',
  itau: 'itau.png',
  'inter-gold': 'inter-gold.jpg',
  'inter-black': 'inter.png',
  inter: 'inter.png',
  magalu: 'magalu.jpg',
  'mercado-pago': 'mercado-pago.png',
  amazon: 'amazon.png',
  'porto-seguro': 'porto-seguro.png',
  'c6-carbon': 'c6.png',
  c6: 'c6.png',
  'bradesco-elo': 'bradesco.png',
  bradesco: 'bradesco.png',
  picpay: 'picpay.png',
};

const DARK_TEXT_KEYS = new Set();

function parseHex(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return [17, 17, 17];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function darken(hex, amount = 0.32) {
  const [r, g, b] = parseHex(hex);
  const mix = (c) => Math.round(c * (1 - amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function productShortLabel(entry, account) {
  if (!entry) return account?.name || 'Cartão';
  if (entry.kind === 'card') {
    return entry.label
      .replace(/^(Santander|Nubank|Itaú|Itau|Inter|C6|Bradesco)\s+/i, '')
      .trim() || entry.letter;
  }
  return entry.label;
}

function faceFileFor(entry) {
  if (!entry) return null;
  return CARD_FACE_FILE[entry.id] || (entry.parent ? CARD_FACE_FILE[entry.parent] : null) || null;
}

/**
 * Resolve the physical-card face for the credit-cards strip.
 */
export function resolveCardFace(account) {
  const key = account?.iconKey || suggestIconKey({ ...account, type: 'CREDIT' });
  const entry = key ? CATALOG_BY_ID[key] : null;
  const parent = entry?.parent ? CATALOG_BY_ID[entry.parent] : null;
  const color = entry?.color || account?.iconColor || '#1a1a1a';
  const file = faceFileFor(entry);
  const catalogSrc = file ? publicFace(file) : null;
  const src = account?.cardFaceUrl || catalogSrc || null;
  const logoTarget = parent || entry;
  return {
    key: entry?.id || null,
    src,
    textTone: DARK_TEXT_KEYS.has(key) ? 'dark' : 'light',
    color,
    logoUrl: catalogEntryUrl(logoTarget) || account?.iconUrl || null,
    productLabel: productShortLabel(entry, account),
    cssBackground: `linear-gradient(145deg, ${color} 0%, ${darken(color)} 100%)`,
  };
}

function creditFaceKey(account) {
  if (!account) return null;
  return account.iconKey || suggestIconKey({ ...account, type: 'CREDIT' }) || null;
}

function pickFace(account) {
  if (!account?.cardFaceUrl && !account?.cardFacePath) return null;
  return { cardFaceUrl: account.cardFaceUrl || null, cardFacePath: account.cardFacePath || null };
}

/**
 * Copy uploaded card photos onto the same account id, then onto the same catalog
 * product (so the partner's Unique/Nubank/Inter can reuse the logged-in photo).
 */
export function mergeLocalCardFaces(accounts, localAccounts) {
  if (!localAccounts?.length) return accounts || [];
  const byId = new Map(localAccounts.map((a) => [String(a.id), a]));
  const byKey = new Map();
  for (const local of localAccounts) {
    const face = pickFace(local);
    const key = creditFaceKey(local);
    if (face && key && !byKey.has(key)) byKey.set(key, { ...face, number: local.number, iconKey: local.iconKey });
  }
  return (accounts || []).map((acc) => {
    const local = byId.get(String(acc.id));
    const key = creditFaceKey(acc) || creditFaceKey(local);
    const fromKey = key ? byKey.get(key) : null;
    if (!local && !fromKey) return acc;
    return {
      ...acc,
      cardFaceUrl: acc.cardFaceUrl || local?.cardFaceUrl || fromKey?.cardFaceUrl || null,
      cardFacePath: acc.cardFacePath || local?.cardFacePath || fromKey?.cardFacePath || null,
      number: acc.number || local?.number || '',
      iconUrl: local?.iconUrl || acc.iconUrl || null,
      iconUrls: (local?.iconUrls?.length ? local.iconUrls : acc.iconUrls) || null,
      iconKey: local?.iconKey || acc.iconKey || fromKey?.iconKey || null,
      iconColor: local?.iconColor || acc.iconColor || null,
      iconSource: local?.iconSource || acc.iconSource || null,
    };
  });
}

export { shareCardFacesByProduct };
