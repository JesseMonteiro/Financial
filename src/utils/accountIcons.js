/**
 * Bank / card product icon catalog and resolver.
 *
 * Resolution order:
 *   1. User override (uploaded image URL or catalog key)
 *   2. Catalog card-product match (e.g. Santander Unique)
 *   3. Pluggy connector.imageUrl from the linked Item
 *   4. Catalog bank match (manual accounts)
 *   5. Pluggy connectors list matched by institution name
 *   6. Lucide fallback (no url)
 *
 * Catalog tiles use baked Pluggy CDN logos (not letter marks). Cards inherit
 * the parent bank logo. Live connector.imageUrl still wins when available.
 */

export const ICON_BUCKET = 'account-icons';
export const ICON_SIGNED_TTL_SEC = 60 * 60 * 24 * 7;
export const ICON_MAX_BYTES = 1024 * 1024;
export const CARD_FACE_MAX_BYTES = 2 * 1024 * 1024;
export const ICON_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export function pluggyConnectorIconUrl(fileId) {
  return `https://cdn.pluggy.ai/assets/connector-icons/${fileId}.svg`;
}

export function brandFaviconUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function markSvg({ bg, fg = '#fff', letter }) {
  const safe = String(letter || '?').slice(0, 3);
  const fontSize = safe.length > 2 ? 18 : safe.length > 1 ? 22 : 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="${bg}"/>
    <text x="32" y="34" dy="0.35em" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="700" fill="${fg}">${escapeXml(safe)}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @typedef {{ id: string, label: string, kind: 'bank'|'card', aliases: string[], color: string, letter: string, parent?: string, pluggyNames?: string[], imageUrl?: string, domain?: string }} CatalogEntry */

/** @type {CatalogEntry[]} */
export const ACCOUNT_ICON_CATALOG = [
  // Card products first in this list; matcher still sorts by kind + alias length.
  { id: 'santander-unique', label: 'Santander Unique', kind: 'card', parent: 'santander', aliases: ['santander unique', 'unique'], color: '#9B1B30', letter: 'U', pluggyNames: ['santander'] },
  { id: 'santander-sx', label: 'Santander SX', kind: 'card', parent: 'santander', aliases: ['santander sx', 'sx'], color: '#111111', letter: 'SX', pluggyNames: ['santander'] },
  { id: 'santander-unlimited', label: 'Santander Unlimited', kind: 'card', parent: 'santander', aliases: ['santander unlimited', 'unlimited'], color: '#1A1A2E', letter: 'UN', pluggyNames: ['santander'] },
  { id: 'nubank-ultravioleta', label: 'Nubank Ultravioleta', kind: 'card', parent: 'nubank', aliases: ['ultravioleta', 'nubank ultravioleta'], color: '#1A0A2E', letter: 'UV', pluggyNames: ['nubank'] },
  { id: 'nubank-rewards', label: 'Nubank Rewards', kind: 'card', parent: 'nubank', aliases: ['nubank rewards'], color: '#5B0A9D', letter: 'RW', pluggyNames: ['nubank'] },
  { id: 'itau-personnalite', label: 'Itaú Personnalité', kind: 'card', parent: 'itau', aliases: ['personnalite', 'personnalité', 'itau personnalite'], color: '#003399', letter: 'P', pluggyNames: ['itau', 'itaú'] },
  { id: 'itau-latam', label: 'Itaú Latam Pass', kind: 'card', parent: 'itau', aliases: ['latam pass', 'itau latam'], color: '#E31837', letter: 'LA', pluggyNames: ['itau', 'itaú'] },
  { id: 'itau-click', label: 'Itaú Click', kind: 'card', parent: 'itau', aliases: ['itau click', 'itaú click'], color: '#EC7000', letter: 'CK', pluggyNames: ['itau', 'itaú'] },
  { id: 'itau-extra', label: 'Extra Itaú', kind: 'card', parent: 'itau', aliases: ['extra itau visa internacional', 'extra itau', 'cartao extra'], color: '#0057B8', letter: 'EX', pluggyNames: ['itau', 'itaú'] },
  { id: 'itau-azul', label: 'Azul Itaú', kind: 'card', parent: 'itau', aliases: ['azul itau visa platinum', 'azul itau', 'itau azul'], color: '#0B1F3A', letter: 'AZ', pluggyNames: ['itau', 'itaú'] },
  { id: 'itau-platinum', label: 'Itaú Visa Platinum', kind: 'card', parent: 'itau', aliases: ['itau visa platinum'], color: '#EC7000', letter: 'PT', pluggyNames: ['itau', 'itaú'] },
  { id: 'inter-gold', label: 'Inter Gold', kind: 'card', parent: 'inter', aliases: ['inter gold'], color: '#FF7A00', letter: 'IG', pluggyNames: ['inter'] },
  { id: 'inter-black', label: 'Inter Black', kind: 'card', parent: 'inter', aliases: ['inter black', 'inter win'], color: '#1A1A1A', letter: 'IB', pluggyNames: ['inter'] },
  { id: 'c6-carbon', label: 'C6 Carbon', kind: 'card', parent: 'c6', aliases: ['c6 carbon', 'carbon'], color: '#111111', letter: 'C6', pluggyNames: ['c6'] },
  { id: 'bradesco-elo', label: 'Bradescard', kind: 'card', parent: 'bradesco', aliases: ['bradescard', 'bradesco elo'], color: '#CC092F', letter: 'BR', pluggyNames: ['bradesco'] },

  { id: 'itau', label: 'Itaú', kind: 'bank', aliases: ['itau', 'itaú', 'banco itau', 'banco itaú'], color: '#EC7000', letter: 'I', pluggyNames: ['itau', 'itaú'], imageUrl: pluggyConnectorIconUrl(201), domain: 'itau.com.br' },
  { id: 'santander', label: 'Santander', kind: 'bank', aliases: ['santander', 'banco santander'], color: '#EC0000', letter: 'S', pluggyNames: ['santander'], imageUrl: pluggyConnectorIconUrl(208), domain: 'santander.com.br' },
  { id: 'nubank', label: 'Nubank', kind: 'bank', aliases: ['nubank', 'nu pagamentos', 'nu bank'], color: '#820AD1', letter: 'N', pluggyNames: ['nubank'], imageUrl: pluggyConnectorIconUrl(212), domain: 'nubank.com.br' },
  { id: 'inter', label: 'Inter', kind: 'bank', aliases: ['inter', 'banco inter'], color: '#FF7A00', letter: 'I', pluggyNames: ['inter'], imageUrl: pluggyConnectorIconUrl(205), domain: 'bancointer.com.br' },
  { id: 'bradesco', label: 'Bradesco', kind: 'bank', aliases: ['bradesco', 'banco bradesco'], color: '#CC092F', letter: 'B', pluggyNames: ['bradesco'], imageUrl: pluggyConnectorIconUrl(203), domain: 'bradesco.com.br' },
  { id: 'banco-do-brasil', label: 'Banco do Brasil', kind: 'bank', aliases: ['banco do brasil', 'banco brasil'], color: '#003641', letter: 'BB', pluggyNames: ['banco do brasil'], imageUrl: pluggyConnectorIconUrl(211), domain: 'bb.com.br' },
  { id: 'caixa', label: 'Caixa', kind: 'bank', aliases: ['caixa', 'caixa economica', 'caixa econômica'], color: '#0066B3', letter: 'CX', pluggyNames: ['caixa'], imageUrl: pluggyConnectorIconUrl(219), domain: 'caixa.gov.br' },
  { id: 'c6', label: 'C6 Bank', kind: 'bank', aliases: ['c6', 'c6 bank'], color: '#000000', letter: 'C6', pluggyNames: ['c6'], imageUrl: pluggyConnectorIconUrl(226), domain: 'c6bank.com.br' },
  { id: 'mercado-pago', label: 'Mercado Pago', kind: 'bank', aliases: ['mercado pago', 'mercadopago', 'mercado livre'], color: '#00B1EA', letter: 'MP', pluggyNames: ['mercado pago'], imageUrl: pluggyConnectorIconUrl(206), domain: 'mercadopago.com.br' },
  { id: 'picpay', label: 'PicPay', kind: 'bank', aliases: ['picpay'], color: '#21C25E', letter: 'PP', pluggyNames: ['picpay'], imageUrl: pluggyConnectorIconUrl(651), domain: 'picpay.com.br' },
  { id: 'xp', label: 'XP', kind: 'bank', aliases: ['xp', 'xp investimentos'], color: '#111111', letter: 'XP', pluggyNames: ['xp'], imageUrl: pluggyConnectorIconUrl(202), domain: 'xpi.com.br' },
  { id: 'btg', label: 'BTG Pactual', kind: 'bank', aliases: ['btg', 'btg pactual'], color: '#001E62', letter: 'BTG', pluggyNames: ['btg'], imageUrl: pluggyConnectorIconUrl(214), domain: 'btgpactual.com.br' },
  { id: 'carrefour', label: 'Carrefour', kind: 'bank', aliases: ['carrefour', 'cartao carrefour'], color: '#004E9B', letter: 'CF', pluggyNames: ['carrefour'], domain: 'carrefour.com.br' },
  { id: 'original', label: 'Original', kind: 'bank', aliases: ['original', 'banco original'], color: '#00A859', letter: 'O', pluggyNames: ['original'], domain: 'original.com.br' },
  { id: 'next', label: 'Next', kind: 'bank', aliases: ['next', 'banco next'], color: '#00D4AA', letter: 'NX', pluggyNames: ['next'], imageUrl: pluggyConnectorIconUrl(656), domain: 'next.me' },
  { id: 'neon', label: 'Neon', kind: 'bank', aliases: ['neon'], color: '#00E1E1', letter: 'NE', pluggyNames: ['neon'], imageUrl: pluggyConnectorIconUrl(689), domain: 'neon.com.br' },
  { id: 'pagbank', label: 'PagBank', kind: 'bank', aliases: ['pagbank', 'pagseguro'], color: '#00DCB6', letter: 'PB', pluggyNames: ['pagbank', 'pagseguro'], imageUrl: pluggyConnectorIconUrl(292), domain: 'pagbank.com.br' },
  { id: 'sicoob', label: 'Sicoob', kind: 'bank', aliases: ['sicoob'], color: '#003641', letter: 'SC', pluggyNames: ['sicoob'], domain: 'sicoob.com.br' },
  { id: 'sicredi', label: 'Sicredi', kind: 'bank', aliases: ['sicredi'], color: '#3AAA35', letter: 'SI', pluggyNames: ['sicredi'], imageUrl: pluggyConnectorIconUrl(661), domain: 'sicredi.com.br' },
  { id: 'porto-seguro', label: 'Porto Seguro', kind: 'bank', aliases: ['porto seguro', 'porto bank'], color: '#004B8D', letter: 'PS', pluggyNames: ['porto'], domain: 'portoseguro.com.br' },
  { id: 'magalu', label: 'Magalu', kind: 'bank', aliases: ['magalu', 'magazine luiza', 'luizalabs'], color: '#0086FF', letter: 'ML', pluggyNames: ['magalu', 'magazine'], domain: 'magazineluiza.com.br' },
  { id: 'will', label: 'Will Bank', kind: 'bank', aliases: ['will', 'will bank'], color: '#6C2BD9', letter: 'W', pluggyNames: ['will'], domain: 'willbank.com.br' },
  { id: 'amazon', label: 'Amazon', kind: 'bank', aliases: ['amazon', 'amazon brasil'], color: '#FF9900', letter: 'A', pluggyNames: ['amazon'], domain: 'amazon.com.br' },
  { id: 'meupluggy', label: 'MeuPluggy', kind: 'bank', aliases: ['meupluggy', 'meu pluggy'], color: '#6366F1', letter: 'MP', pluggyNames: ['meupluggy'] },
];

export const CATALOG_BY_ID = Object.fromEntries(ACCOUNT_ICON_CATALOG.map((e) => [e.id, e]));

export function normalizeIconText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function catalogMarkUrl(entry) {
  if (!entry) return null;
  return markSvg({ bg: entry.color, letter: entry.letter });
}

export function accountNameBlob(account = {}) {
  return [
    account.name,
    account.originalName,
    account.marketingName,
    account.institutionName,
    account.bankData?.institutionName,
    account.creditData?.institutionName,
    account.connectorName,
    account._connector,
  ]
    .filter(Boolean)
    .join(' ');
}

function aliasMatches(normalizedBlob, alias) {
  const a = normalizeIconText(alias);
  if (!a) return false;
  if (normalizedBlob === a) return true;
  const padded = ` ${normalizedBlob} `;
  if (padded.includes(` ${a} `)) return true;
  // Longer aliases may sit inside marketing names without extra spaces around every token.
  if (a.length >= 6 && normalizedBlob.includes(a)) return true;
  return false;
}

/**
 * @param {string} blob
 * @param {{ kind?: 'bank'|'card' }} [opts]
 */
export function matchCatalog(blob, opts = {}) {
  const n = normalizeIconText(blob);
  if (!n) return null;
  const ranked = [...ACCOUNT_ICON_CATALOG].sort((a, b) => {
    if (opts.kind && a.kind !== b.kind) {
      if (a.kind === opts.kind) return -1;
      if (b.kind === opts.kind) return 1;
    }
    if (a.kind !== b.kind) return a.kind === 'card' ? -1 : 1;
    const aLen = Math.max(...a.aliases.map((x) => normalizeIconText(x).length));
    const bLen = Math.max(...b.aliases.map((x) => normalizeIconText(x).length));
    return bLen - aLen;
  });
  for (const entry of ranked) {
    if (opts.kind && entry.kind !== opts.kind && opts.strictKind) continue;
    if (entry.aliases.some((alias) => aliasMatches(n, alias))) return entry;
  }
  return null;
}

export function matchConnector(blob, connectors = []) {
  const n = normalizeIconText(blob);
  if (!n || !connectors.length) return null;
  let best = null;
  let bestLen = 0;
  for (const connector of connectors) {
    const name = normalizeIconText(connector?.name);
    if (!name || name.length < 2) continue;
    const hit = n.includes(name) || name.includes(n) || aliasMatches(n, name);
    if (!hit || !connector.imageUrl) continue;
    if (name.length > bestLen) {
      best = connector;
      bestLen = name.length;
    }
  }
  return best;
}

function uniqueUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Preference order for a catalog tile / saved catalog key:
 * live Pluggy connector → baked CDN logo → parent bank logo → favicon → letter mark.
 */
export function catalogEntryUrls(entry, connectors = []) {
  if (!entry) return [];
  const parent = entry.parent ? CATALOG_BY_ID[entry.parent] : null;
  const urls = [];

  const matchNames = [
    ...(entry.pluggyNames || []),
    entry.label,
    ...(parent?.pluggyNames || []),
    parent?.label,
  ]
    .filter(Boolean)
    .map(normalizeIconText);

  if (Array.isArray(connectors) && connectors.length && matchNames.length) {
    for (const connector of connectors) {
      const cname = normalizeIconText(connector?.name);
      if (
        cname &&
        connector.imageUrl &&
        matchNames.some((n) => n && (cname.includes(n) || n.includes(cname)))
      ) {
        urls.push(connector.imageUrl);
      }
    }
  }

  if (entry.imageUrl) urls.push(entry.imageUrl);
  if (parent?.imageUrl) urls.push(parent.imageUrl);
  if (entry.domain) urls.push(brandFaviconUrl(entry.domain));
  if (parent?.domain) urls.push(brandFaviconUrl(parent.domain));
  urls.push(catalogMarkUrl(entry));
  return uniqueUrls(urls);
}

export function catalogEntryUrl(entry, connectors = []) {
  return catalogEntryUrls(entry, connectors)[0] || null;
}

export function suggestIconKey(accountLike = {}) {
  const blob = accountNameBlob(accountLike);
  const kind = accountLike.type === 'CREDIT' ? 'card' : 'bank';
  const product = matchCatalog(blob, { kind: 'card' });
  if (accountLike.type === 'CREDIT' && product?.kind === 'card') return product.id;
  const bank = matchCatalog(blob, { kind: 'bank' });
  return (kind === 'card' ? product : bank)?.id || bank?.id || product?.id || null;
}

function itemsMap(itemsById) {
  if (!itemsById) return {};
  if (Array.isArray(itemsById)) {
    return Object.fromEntries(itemsById.filter((i) => i?.id).map((i) => [i.id, i]));
  }
  return itemsById;
}

/**
 * @param {object} account
 * @param {{ customIcons?: Record<string, { key?: string, path?: string, url?: string }>, itemsById?: object, connectors?: object[] }} ctx
 */
export function resolveAccountIcon(account, ctx = {}) {
  const customIcons = ctx.customIcons || {};
  const itemsById = itemsMap(ctx.itemsById);
  const connectors = ctx.connectors || [];
  const custom = iconOverlayFor(customIcons, account?.id);

  if (custom?.url) {
    const urls = [custom.url, ...(custom.key && CATALOG_BY_ID[custom.key] ? catalogEntryUrls(CATALOG_BY_ID[custom.key], connectors) : [])];
    return { url: custom.url, urls: uniqueUrls(urls), key: custom.key || null, source: 'upload', color: null };
  }
  if (custom?.key && CATALOG_BY_ID[custom.key]) {
    const entry = CATALOG_BY_ID[custom.key];
    const urls = catalogEntryUrls(entry, connectors);
    return {
      url: urls[0] || null,
      urls,
      key: entry.id,
      source: 'catalog',
      color: entry.color,
    };
  }

  const blob = accountNameBlob(account);
  if (account?.type === 'CREDIT') {
    const product = matchCatalog(blob, { kind: 'card' });
    if (product?.kind === 'card') {
      const urls = catalogEntryUrls(product, connectors);
      return {
        url: urls[0] || null,
        urls,
        key: product.id,
        source: 'catalog',
        color: product.color,
      };
    }
  }

  const item = account?.itemId ? itemsById[account.itemId] : null;
  const pluggyUrl =
    item?.connector?.imageUrl ||
    account?.connector?.imageUrl ||
    account?.connectorImageUrl;
  const pluggyColor =
    item?.connector?.primaryColor ||
    account?.connector?.primaryColor ||
    account?.bankData?.primaryColor;
  if (pluggyUrl) {
    return { url: pluggyUrl, urls: [pluggyUrl], key: null, source: 'pluggy', color: pluggyColor || null };
  }

  const bank = matchCatalog(blob, { kind: 'bank' });
  if (bank) {
    const urls = catalogEntryUrls(bank, connectors);
    return {
      url: urls[0] || null,
      urls,
      key: bank.id,
      source: 'catalog',
      color: bank.color,
    };
  }

  const connector = matchConnector(blob, connectors);
  if (connector?.imageUrl) {
    return {
      url: connector.imageUrl,
      urls: [connector.imageUrl],
      key: null,
      source: 'pluggy',
      color: connector.primaryColor || null,
    };
  }

  return { url: null, urls: [], key: null, source: 'fallback', color: pluggyColor || null };
}

export function collectFacesByCatalogKey(iconMaps = []) {
  const out = {};
  for (const icons of iconMaps) {
    if (!icons || typeof icons !== 'object') continue;
    for (const value of Object.values(icons)) {
      const overlay = value && typeof value === 'object' ? value : null;
      if (!overlay) continue;
      const key = overlay.key;
      const facePath = overlay.facePath || overlay.face_path || null;
      const faceUrl = overlay.faceUrl || overlay.face_url || null;
      if (!key || !(facePath || faceUrl) || out[key]) continue;
      out[key] = { facePath, faceUrl };
    }
  }
  return out;
}

export function decorateAccountWithIcon(account, ctx = {}) {
  const item = account?.itemId ? itemsMap(ctx.itemsById)[account.itemId] : null;
  const icon = resolveAccountIcon(account, ctx);
  const overlay = iconOverlayFor(ctx.customIcons, account?.id);
  const productKey = overlay?.key || icon.key || account?.iconKey || null;
  const family = (productKey && ctx.facesByKey?.[productKey]) || null;
  const overlayFacePath = overlay?.facePath || overlay?.face_path || null;
  const overlayFaceUrl = overlay?.faceUrl || overlay?.face_url || null;
  return {
    ...account,
    connectorName: account.connectorName || item?.connector?.name || account._connector || null,
    connectorId: account.connectorId || item?.connector?.id || account._connectorId || null,
    connectorImageUrl: item?.connector?.imageUrl || account.connectorImageUrl || null,
    iconUrl: icon.url || account.iconUrl || null,
    iconUrls: uniqueUrls([
      ...(icon.urls || []),
      icon.url,
      account.iconUrl,
      ...(account.iconUrls || []),
    ]),
    iconKey: icon.key || account.iconKey || null,
    iconSource: icon.source || account.iconSource || null,
    iconColor: icon.color || account.iconColor || account.bankData?.primaryColor || null,
    cardFaceUrl: overlayFaceUrl || family?.faceUrl || account.cardFaceUrl || null,
    cardFacePath: overlayFacePath || family?.facePath || account.cardFacePath || null,
  };
}

function iconOverlayFor(customIcons, accountId) {
  if (!customIcons || accountId == null) return null;
  return customIcons[accountId] || customIcons[String(accountId)] || null;
}

export function decorateAccountsWithIcons(accounts, ctx = {}) {
  return (accounts || []).map((acc) => decorateAccountWithIcon(acc, ctx));
}

export function shareCardFacesByProduct(accounts = []) {
  const byKey = new Map();
  for (const acc of accounts) {
    if (acc?.type && acc.type !== 'CREDIT') continue;
    const key = acc.iconKey || suggestIconKey({ ...acc, type: 'CREDIT' });
    if ((acc.cardFaceUrl || acc.cardFacePath) && key && !byKey.has(key)) {
      byKey.set(key, {
        cardFaceUrl: acc.cardFaceUrl || null,
        cardFacePath: acc.cardFacePath || null,
      });
    }
  }
  if (byKey.size === 0) return accounts;
  return accounts.map((acc) => {
    if (acc?.type && acc.type !== 'CREDIT') return acc;
    if (acc.cardFaceUrl || acc.cardFacePath) return acc;
    const key = acc.iconKey || suggestIconKey({ ...acc, type: 'CREDIT' });
    const shared = key ? byKey.get(key) : null;
    if (!shared) return acc;
    return { ...acc, cardFaceUrl: shared.cardFaceUrl, cardFacePath: shared.cardFacePath };
  });
}

export function extFromImageFile(file) {
  const type = String(file?.type || '').toLowerCase();
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/svg+xml') return 'svg';
  const name = String(file?.name || '');
  const m = name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] || 'png').toLowerCase();
}

export function validateIconFile(file) {
  if (!file) return 'Selecione uma imagem.';
  if (file.size > ICON_MAX_BYTES) return 'A imagem deve ter no máximo 1 MB.';
  if (file.type && !ICON_MIME.includes(file.type)) return 'Use PNG, JPG, WEBP ou SVG.';
  return null;
}

export function validateCardFaceFile(file) {
  if (!file) return 'Selecione uma imagem.';
  if (file.size > CARD_FACE_MAX_BYTES) return 'A foto do cartão deve ter no máximo 2 MB.';
  if (file.type && !ICON_MIME.includes(file.type)) return 'Use PNG, JPG, WEBP ou SVG.';
  return null;
}
