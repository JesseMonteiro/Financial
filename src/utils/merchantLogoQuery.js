import { matchMerchantLogo, normalizeMerchantText } from './merchantLogos.js';

/** Queries kept out of logo.dev: transfers and generic bank text, not a store. */
const SKIP_PATTERNS = [
  /\bpix\b/,
  /\bted\b/,
  /\bdoc\b/,
  /\bsalario\b/,
  /\brendimento\b/,
  /\bpoupanca\b/,
  /\bpagamento de fatura\b/,
];

const NOISE_TOKENS = new Set([
  'compra',
  'compras',
  'pag',
  'pg',
  'pagamento',
  'debito',
  'credito',
  'cartao',
  'visa',
  'master',
  'mastercard',
  'elo',
  'hipercard',
  'br',
  'brasil',
  'sa',
  'ltda',
  'me',
  'eireli',
  'filial',
  'loja',
  'parcela',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'em',
  'no',
  'na',
  'para',
  'recebida',
  'recebido',
  'enviada',
  'enviado',
  'transf',
  'transferencia',
  'fatura',
]);

export const MERCHANT_LOGO_QUERY_LIMIT = 40;

/**
 * Prefer the establishment name over the raw card description.
 * @param {string|object} textOrItem
 * @param {object|string} [merchantObj]
 */
export function merchantSourceText(textOrItem, merchantObj = null) {
  let title = '';
  let merchantName = '';

  if (typeof textOrItem === 'string') {
    title = textOrItem;
  } else if (textOrItem && typeof textOrItem === 'object') {
    title = textOrItem.description || textOrItem.originalDescription || textOrItem.title || '';
    merchantName =
      textOrItem.merchant?.businessName ||
      textOrItem.merchant?.name ||
      textOrItem.merchantName ||
      '';
  }

  if (merchantObj && typeof merchantObj === 'object') {
    merchantName = merchantObj.businessName || merchantObj.name || merchantName;
  } else if (typeof merchantObj === 'string' && merchantObj) {
    merchantName = merchantObj;
  }

  return merchantName || title || '';
}

export function shouldSkipMerchantLookup(normalized) {
  if (!normalized) return true;
  const compact = normalized.replace(/\s/g, '');
  if (!compact || /^\d+$/.test(compact)) return true;
  return SKIP_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function cleanMerchantLookupKey(normalized) {
  return normalized
    .split(' ')
    .filter((token) => token && !NOISE_TOKENS.has(token) && !/^\d+$/.test(token))
    .join(' ')
    .trim();
}

/**
 * Cache key for a purchase that is not already covered by the local catalog.
 * Returns null when the row should keep the category icon and must not call logo.dev.
 * @param {string|object} textOrItem
 * @param {object|string} [merchantObj]
 */
export function merchantLogoQueryKey(textOrItem, merchantObj = null) {
  if (matchMerchantLogo(textOrItem, merchantObj)) return null;
  const normalized = normalizeMerchantText(merchantSourceText(textOrItem, merchantObj));
  if (shouldSkipMerchantLookup(normalized)) return null;
  const key = cleanMerchantLookupKey(normalized);
  if (!key || key.length < 3 || key.length > 80) return null;
  if (shouldSkipMerchantLookup(key)) return null;
  if (matchMerchantLogo(key)) return null;
  return key;
}

/**
 * Same fields CategoryIcon receives, so the list and the icon share one key.
 */
export function merchantLogoQueryKeyFromFields({ title, description, merchant } = {}) {
  return merchantLogoQueryKey(title || description || '', merchant);
}

/**
 * Accept a client-supplied key. Does not strip tokens again, so the response
 * map stays aligned with the key the list asked for.
 */
export function canonicalQueryKey(raw) {
  const key = normalizeMerchantText(raw);
  if (!key || key.length < 3 || key.length > 80) return null;
  if (shouldSkipMerchantLookup(key)) return null;
  if (matchMerchantLogo(key)) return null;
  return key;
}

/** Top search hit is usable only when it shares a meaningful token with the query. */
export function brandNameMatchesQuery(queryKey, brandName) {
  const query = normalizeMerchantText(queryKey);
  const brand = normalizeMerchantText(brandName);
  if (!query || !brand) return false;
  if (query.length >= 4 && (brand.includes(query) || query.includes(brand))) return true;
  const queryTokens = new Set(query.split(' ').filter((token) => token.length >= 4));
  return brand.split(' ').some((token) => token.length >= 4 && queryTokens.has(token));
}
