#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MERCHANT_CATALOG,
  matchMerchantLogo,
  getMerchantLogoUrl,
  normalizeMerchantText,
} from '../src/utils/merchantLogos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const webDir = path.join(rootDir, 'public', 'merchant-logos');
const iosDir = path.join(
  rootDir,
  'ios',
  'Packages',
  'MeuFluxDesignSystem',
  'Sources',
  'MeuFluxDesignSystem',
  'Resources',
  'MerchantLogos'
);

// 1. Verify all 57 logos exist on disk for both Web and iOS
for (const entry of MERCHANT_CATALOG) {
  const webFile = path.join(webDir, entry.file);
  const iosFile = path.join(iosDir, entry.file);
  assert(fs.existsSync(webFile), `Web logo missing: ${entry.file}`);
  assert(fs.existsSync(iosFile), `iOS logo missing: ${entry.file}`);
  const stat = fs.statSync(webFile);
  assert(stat.size > 100, `Web logo ${entry.file} is suspiciously small: ${stat.size} bytes`);
}

// 2. Test text normalization
assert.equal(normalizeMerchantText('  iFood * Restaurante  '), 'ifood restaurante');
assert.equal(normalizeMerchantText('Pão de Açúcar - Supermercados'), 'pao de acucar supermercados');

// 3. Test matching for delivery and restaurants
const ifood = matchMerchantLogo('IFOOD *RESTAURANTE SAO PAULO');
assert.equal(ifood?.id, 'ifood');
assert.equal(ifood?.name, 'iFood');

const zedelivery = matchMerchantLogo('Zé Delivery Bebidas');
assert.equal(zedelivery?.id, 'ze-delivery');

const mcdonalds = matchMerchantLogo('MC DONALDS SHOPPING');
assert.equal(mcdonalds?.id, 'mcdonalds');

// 4. Test mobility
const uber = matchMerchantLogo('Uber * Viagem Urbana');
assert.equal(uber?.id, 'uber');

const shell = matchMerchantLogo('Posto Shell Combustível');
assert.equal(shell?.id, 'shell');

const app99 = matchMerchantLogo('99App *Corrida');
assert.equal(app99?.id, '99app');

// 5. Test streaming and digital services
const netflix = matchMerchantLogo('Netflix Assinatura Mensal');
assert.equal(netflix?.id, 'netflix');

const spotify = matchMerchantLogo('SPOTIFY BRASIL');
assert.equal(spotify?.id, 'spotify');

const amazon = matchMerchantLogo('AMAZON PRIME BR');
assert.equal(amazon?.id, 'amazon');

// 6. Test merchant object input
const itemWithMerchant = {
  description: 'Compra no cartão final 1234',
  merchant: { businessName: 'Drogaria São Paulo S/A' },
};
const drogasp = matchMerchantLogo(itemWithMerchant);
assert.equal(drogasp?.id, 'drogaria-sao-paulo');

const rdSaude = matchMerchantLogo('COMPRA RD SAUDE');
assert.equal(rdSaude?.id, 'drogasil');

// 7. Test word-boundary for short aliases (e.g., 'tim')
const timMatch = matchMerchantLogo('FATURA TIM CELULAR');
assert.equal(timMatch?.id, 'tim');
const notTim = matchMerchantLogo('INTIMIDADE MODA INTIMA');
assert.notEqual(notTim?.id, 'tim');

// 8. Test negative cases (generic / unknown transactions)
assert.equal(matchMerchantLogo('PAGAMENTO DE SALARIO'), null);
assert.equal(matchMerchantLogo('TED RECEBIDA JOAO SILVA'), null);
assert.equal(matchMerchantLogo('RENDIMENTO POUPANCA'), null);
assert.equal(matchMerchantLogo(''), null);
assert.equal(matchMerchantLogo(null), null);

// 9. Test URL resolver
const url = getMerchantLogoUrl(ifood);
assert.equal(url, '/merchant-logos/ifood.png');

console.log(`merchantLogos tests passed successfully (${MERCHANT_CATALOG.length} merchants checked).`);
