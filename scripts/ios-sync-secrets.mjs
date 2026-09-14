#!/usr/bin/env node
/**
 * Gera ios/FinancialApp/Config/Secrets.xcconfig a partir do .env do web.
 * Não commit o arquivo gerado.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const envPath = path.join(root, '.env');
const outPath = path.join(root, 'ios/FinancialApp/Config/Secrets.xcconfig');

if (!fs.existsSync(envPath)) {
  console.error('Arquivo .env não encontrado na raiz do repo.');
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabaseURL = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
if (!supabaseURL || !anon) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes no .env');
  process.exit(1);
}

const hostPath = supabaseURL.replace(/^https:\/\//, '');
const apiBase = `${supabaseURL.replace(/\/$/, '')}/functions/v1/pluggy-proxy`;
const apiHostPath = apiBase.replace(/^https:\/\//, '');

const contents = `// Gerado por scripts/ios-sync-secrets.mjs — NÃO COMMITAR
SUPABASE_URL = https:/$()/${hostPath}
SUPABASE_ANON_KEY = ${anon}
API_BASE_URL = https:/$()/${apiHostPath}
`;

fs.writeFileSync(outPath, contents);
console.log(`Wrote ${outPath}`);
console.log('Rebuild the iOS app in Xcode after this.');

