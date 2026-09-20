/**
 * Catalog of frequent transaction merchants in Brazil / global digital services
 * with aliases for matching transaction titles and merchant names.
 */

export const MERCHANT_CATALOG = [
  // Alimentação & Delivery
  {
    id: 'ifood',
    name: 'iFood',
    aliases: ['ifood', 'i food', 'ifd*'],
    color: '#EA1D2C',
    file: 'ifood.png',
  },
  {
    id: 'rappi',
    name: 'Rappi',
    aliases: ['rappi'],
    color: '#FF441F',
    file: 'rappi.png',
  },
  {
    id: 'ze-delivery',
    name: 'Zé Delivery',
    aliases: ['ze delivery', 'zedelivery', 'ze delivery de bebidas'],
    color: '#FFCC00',
    file: 'ze-delivery.png',
  },
  {
    id: 'mcdonalds',
    name: "McDonald's",
    aliases: ['mcdonalds', 'mc donalds', 'mcdonald', 'mequi', 'arcos dourados'],
    color: '#DA291C',
    file: 'mcdonalds.png',
  },
  {
    id: 'burger-king',
    name: 'Burger King',
    aliases: ['burger king', 'bk brasil', 'burgerking'],
    color: '#D62300',
    file: 'burger-king.png',
  },
  {
    id: 'starbucks',
    name: 'Starbucks',
    aliases: ['starbucks', 'southrock'],
    color: '#006241',
    file: 'starbucks.png',
  },
  {
    id: 'outback',
    name: 'Outback',
    aliases: ['outback', 'outback steakhouse', 'bloomin'],
    color: '#8B0000',
    file: 'outback.png',
  },
  {
    id: 'habibs',
    name: "Habib's",
    aliases: ['habibs', 'habib'],
    color: '#C70000',
    file: 'habibs.png',
  },
  {
    id: 'cacau-show',
    name: 'Cacau Show',
    aliases: ['cacau show', 'cacaushow'],
    color: '#4A2311',
    file: 'cacau-show.png',
  },

  // Transporte & Mobilidade
  {
    id: 'uber',
    name: 'Uber',
    aliases: ['uber', 'uber *trip', 'uber trip', 'uberbr', 'uber eats', 'uber pendente'],
    color: '#000000',
    file: 'uber.png',
  },
  {
    id: '99app',
    name: '99',
    aliases: ['99app', '99 app', '99pop', '99tecnologia', '99pay'],
    color: '#FFB800',
    file: '99app.png',
  },
  {
    id: 'shell',
    name: 'Shell',
    aliases: ['shell', 'posto shell', 'shell box', 'raizen'],
    color: '#FFD700',
    file: 'shell.png',
  },
  {
    id: 'ipiranga',
    name: 'Ipiranga',
    aliases: ['ipiranga', 'posto ipiranga', 'abastece ai', 'ipiranga posto'],
    color: '#002D72',
    file: 'ipiranga.png',
  },
  {
    id: 'sem-parar',
    name: 'Sem Parar',
    aliases: ['sem parar', 'semparar'],
    color: '#E60000',
    file: 'sem-parar.png',
  },
  {
    id: 'conectcar',
    name: 'ConectCar',
    aliases: ['conectcar', 'conect car'],
    color: '#0090DA',
    file: 'conectcar.png',
  },
  {
    id: 'veloe',
    name: 'Veloe',
    aliases: ['veloe'],
    color: '#00A3E0',
    file: 'veloe.png',
  },
  {
    id: 'azul',
    name: 'Azul Linhas Aéreas',
    aliases: ['azul linhas', 'voeazul', 'azul cargo'],
    color: '#002D62',
    file: 'azul.png',
  },
  {
    id: 'gol',
    name: 'Gol Linhas Aéreas',
    aliases: ['gol linhas', 'voegol', 'gol transporte'],
    color: '#FF5A00',
    file: 'gol.png',
  },
  {
    id: 'latam',
    name: 'LATAM Airlines',
    aliases: ['latam airlines', 'latam pass', 'tam linhas'],
    color: '#E31837',
    file: 'latam.png',
  },

  // Supermercados & Farmácias
  {
    id: 'carrefour',
    name: 'Carrefour',
    aliases: ['carrefour', 'carrefour express', 'carrefour hiper'],
    color: '#004E9B',
    file: 'carrefour.png',
  },
  {
    id: 'pao-de-acucar',
    name: 'Pão de Açúcar',
    aliases: ['pao de acucar', 'paodeacucar', 'gpa', 'minuto pao'],
    color: '#006633',
    file: 'pao-de-acucar.png',
  },
  {
    id: 'assai',
    name: 'Assaí',
    aliases: ['assai', 'assai atacadista'],
    color: '#ED1C24',
    file: 'assai.png',
  },
  {
    id: 'atacadao',
    name: 'Atacadão',
    aliases: ['atacadao', 'atacadao sa'],
    color: '#E30613',
    file: 'atacadao.png',
  },
  {
    id: 'extra',
    name: 'Extra',
    aliases: ['extra supermercado', 'extra mercado', 'supermercado extra'],
    color: '#ED1C24',
    file: 'extra.png',
  },
  {
    id: 'oxxo',
    name: 'Oxxo',
    aliases: ['oxxo', 'mercado oxxo', 'nosso oxxo'],
    color: '#E60000',
    file: 'oxxo.png',
  },
  {
    id: 'droga-raia',
    name: 'Droga Raia',
    aliases: ['droga raia', 'drogaraia', 'raiadrogasil'],
    color: '#0054A6',
    file: 'droga-raia.png',
  },
  {
    id: 'drogasil',
    name: 'Drogasil',
    aliases: ['drogasil', 'droga sil', 'rd saude', 'rdsaude', 'rd farmacia'],
    color: '#ED1C24',
    file: 'drogasil.png',
  },
  {
    id: 'drogaria-sao-paulo',
    name: 'Drogaria São Paulo',
    aliases: ['drogaria sao paulo', 'drogaria sp', 'dpsp'],
    color: '#003399',
    file: 'drogaria-sao-paulo.png',
  },
  {
    id: 'pague-menos',
    name: 'Pague Menos',
    aliases: ['pague menos', 'paguemenos'],
    color: '#ED1C24',
    file: 'pague-menos.png',
  },
  {
    id: 'panvel',
    name: 'Panvel',
    aliases: ['panvel', 'panvel farmacias'],
    color: '#003B70',
    file: 'panvel.png',
  },

  // E-commerce & Varejo
  {
    id: 'amazon',
    name: 'Amazon',
    aliases: ['amazon', 'amzn', 'amazon prime', 'amazon mktplace', 'amazon.com.br'],
    color: '#FF9900',
    file: 'amazon.png',
  },
  {
    id: 'mercado-livre',
    name: 'Mercado Livre',
    aliases: ['mercado livre', 'mercadolivre', 'mercado pago', 'merpago', 'mp *'],
    color: '#FFE600',
    file: 'mercado-livre.png',
  },
  {
    id: 'shopee',
    name: 'Shopee',
    aliases: ['shopee', 'shopee brasil'],
    color: '#EE4D2D',
    file: 'shopee.png',
  },
  {
    id: 'shein',
    name: 'Shein',
    aliases: ['shein'],
    color: '#000000',
    file: 'shein.png',
  },
  {
    id: 'aliexpress',
    name: 'AliExpress',
    aliases: ['aliexpress', 'alipay'],
    color: '#FF4747',
    file: 'aliexpress.png',
  },
  {
    id: 'magalu',
    name: 'Magalu',
    aliases: ['magalu', 'magazine luiza', 'magazineluiza'],
    color: '#0086FF',
    file: 'magalu.png',
  },
  {
    id: 'americanas',
    name: 'Americanas',
    aliases: ['americanas', 'lojas americanas', 'b2w'],
    color: '#E60014',
    file: 'americanas.png',
  },
  {
    id: 'apple',
    name: 'Apple',
    aliases: ['apple.com', 'apple store', 'itunes', 'apple.com/bill', 'apple'],
    color: '#000000',
    file: 'apple.png',
  },
  {
    id: 'google',
    name: 'Google',
    aliases: ['google', 'google play', 'google storage', 'gsuite', 'google ads'],
    color: '#4285F4',
    file: 'google.png',
  },

  // Streaming & Assinaturas
  {
    id: 'netflix',
    name: 'Netflix',
    aliases: ['netflix', 'netflix.com'],
    color: '#E50914',
    file: 'netflix.png',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    aliases: ['spotify', 'spotify brasil'],
    color: '#1DB954',
    file: 'spotify.png',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    aliases: ['youtube', 'yt premium'],
    color: '#FF0000',
    file: 'youtube.png',
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    aliases: ['disney plus', 'disney+', 'disneyplus'],
    color: '#113CCF',
    file: 'disney-plus.png',
  },
  {
    id: 'max',
    name: 'Max',
    aliases: ['max.com', 'hbo max', 'hbomax'],
    color: '#0000FF',
    file: 'max.png',
  },
  {
    id: 'globoplay',
    name: 'Globoplay',
    aliases: ['globoplay', 'globo play'],
    color: '#FA3E3E',
    file: 'globoplay.png',
  },
  {
    id: 'deezer',
    name: 'Deezer',
    aliases: ['deezer'],
    color: '#A238FF',
    file: 'deezer.png',
  },
  {
    id: 'steam',
    name: 'Steam',
    aliases: ['steam', 'steam games', 'steampowered', 'valve'],
    color: '#171A21',
    file: 'steam.png',
  },
  {
    id: 'playstation',
    name: 'PlayStation',
    aliases: ['playstation', 'playstation network', 'psn'],
    color: '#003791',
    file: 'playstation.png',
  },
  {
    id: 'xbox',
    name: 'Xbox',
    aliases: ['xbox', 'microsoft*xbox', 'msft *xbox'],
    color: '#107C10',
    file: 'xbox.png',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    aliases: ['openai', 'chatgpt'],
    color: '#00A67E',
    file: 'openai.png',
  },
  {
    id: 'smartfit',
    name: 'Smart Fit',
    aliases: ['smart fit', 'smartfit'],
    color: '#F68B1F',
    file: 'smartfit.png',
  },
  {
    id: 'totalpass',
    name: 'TotalPass',
    aliases: ['totalpass', 'total pass'],
    color: '#1C1C1E',
    file: 'totalpass.png',
  },
  {
    id: 'gympass',
    name: 'Gympass',
    aliases: ['gympass', 'wellhub'],
    color: '#E83D48',
    file: 'gympass.png',
  },

  // Telecom & Serviços
  {
    id: 'claro',
    name: 'Claro',
    aliases: ['claro', 'claro net', 'embratel'],
    color: '#DA291C',
    file: 'claro.png',
  },
  {
    id: 'vivo',
    name: 'Vivo',
    aliases: ['vivo', 'telefonica brasil'],
    color: '#660099',
    file: 'vivo.png',
  },
  {
    id: 'tim',
    name: 'TIM',
    aliases: ['tim celular', 'tim brasil', 'tim'],
    color: '#003399',
    file: 'tim.png',
  },
  {
    id: 'recargapay',
    name: 'RecargaPay',
    aliases: ['recargapay', 'recarga pay'],
    color: '#00A650',
    file: 'recargapay.png',
  },
];

export const MERCHANT_BY_ID = Object.fromEntries(
  MERCHANT_CATALOG.map((m) => [m.id, m])
);

/**
 * Normalizes text for alias matching (accent stripping, lowercase, punctuation collapse).
 */
export function normalizeMerchantText(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pre-compiled list of aliases sorted longest first */
const COMPILED_ALIASES = [];
for (const merchant of MERCHANT_CATALOG) {
  for (const rawAlias of merchant.aliases) {
    const clean = normalizeMerchantText(rawAlias);
    if (clean) {
      COMPILED_ALIASES.push({
        merchant,
        rawAlias,
        normalized: clean,
        isShort: clean.length <= 3,
      });
    }
  }
}
COMPILED_ALIASES.sort((a, b) => b.normalized.length - a.normalized.length);

/**
 * Matches a transaction's description or merchant name to a known merchant entry.
 *
 * @param {string|object} textOrItem - Description string or transaction-like object
 * @param {object|string} [merchantObj] - Optional merchant info object or name
 * @returns {object|null} Matched merchant entry or null
 */
export function matchMerchantLogo(textOrItem, merchantObj = null) {
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

  const normalizedTitle = normalizeMerchantText(title);
  const normalizedMerchant = normalizeMerchantText(merchantName);

  if (!normalizedTitle && !normalizedMerchant) return null;

  // Search candidate strings: merchant name first (higher precision), then title
  const candidates = [normalizedMerchant, normalizedTitle].filter(Boolean);

  for (const cand of candidates) {
    // Pad with spaces for safe word-boundary checks
    const padded = ` ${cand} `;
    for (const item of COMPILED_ALIASES) {
      if (item.isShort) {
        // Short aliases (e.g. 'tim', 'gol') require word boundaries
        if (padded.includes(` ${item.normalized} `)) {
          return item.merchant;
        }
      } else {
        // Longer aliases can match substring
        if (cand.includes(item.normalized)) {
          return item.merchant;
        }
      }
    }
  }

  return null;
}

/**
 * Returns public URL for merchant logo PNG asset.
 */
export function getMerchantLogoUrl(merchantOrId) {
  if (!merchantOrId) return null;
  const entry = typeof merchantOrId === 'string' ? MERCHANT_BY_ID[merchantOrId] : merchantOrId;
  if (!entry?.file) return null;

  const base = import.meta.env?.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}merchant-logos/${entry.file}`;
}
