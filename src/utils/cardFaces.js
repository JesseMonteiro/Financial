import { CATALOG_BY_ID, catalogEntryUrl, suggestIconKey } from './accountIcons';

/** Front photos we validated as the physical card (not lifestyle crops). */
const CARD_FACE_SRC = {
  'santander-unique': '/card-faces/santander-unique.png',
};

const DARK_TEXT_KEYS = new Set(['itau-click', 'itau', 'inter', 'amazon']);

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

/**
 * Resolve the physical-card face for the credit-cards strip.
 * Photos only for catalog *products* with a stored asset; banks get CSS plastic.
 */
export function resolveCardFace(account) {
  const key = account?.iconKey || suggestIconKey({ ...account, type: 'CREDIT' });
  const entry = key ? CATALOG_BY_ID[key] : null;
  const parent = entry?.parent ? CATALOG_BY_ID[entry.parent] : null;
  const color = entry?.color || account?.iconColor || '#1a1a1a';
  const src =
    account?.iconSource === 'upload' || entry?.kind !== 'card'
      ? null
      : CARD_FACE_SRC[entry?.id] || null;
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
