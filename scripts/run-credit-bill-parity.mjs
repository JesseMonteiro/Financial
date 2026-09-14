#!/usr/bin/env node
/**
 * Runs summarizeCardOpenBill from the web JS engine and the BFF TS copy
 * against docs/fixtures/credit-bills/*.json.
 *
 * Usage: node --experimental-strip-types scripts/run-credit-bill-parity.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_VERSION = '2026.09.2';
const dir = path.resolve('docs/fixtures/credit-bills');

const jsMod = await import(pathToFileURL(path.resolve('src/utils/creditBillPeriod.js')).href);
const tsMod = await import(
  pathToFileURL(path.resolve('supabase/functions/pluggy-proxy/creditBillPeriod.ts')).href
);

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nearlyEqual(a, b, eps = 0.02) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= eps;
}

function runEngine(mod, fixture) {
  const card = fixture.card || fixture.account;
  const txs = fixture.transactions || [];
  const bills = fixture.officialBills || [];
  return mod.summarizeCardOpenBill(card, txs, bills);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
if (!files.length) {
  console.error('No fixtures found');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const fixture = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const id = fixture.fixtureId || fixture.id || file;
  const expected = fixture.expected?.summarizeCardOpenBill;
  if (!expected) {
    console.error(`${file}: missing expected.summarizeCardOpenBill`);
    failed += 1;
    continue;
  }
  if (fixture.calculationVersion !== EXPECTED_VERSION) {
    console.error(`${file}: calculationVersion ${fixture.calculationVersion} != ${EXPECTED_VERSION}`);
    failed += 1;
  }

  let js;
  let ts;
  try {
    js = runEngine(jsMod, fixture);
    ts = runEngine(tsMod, fixture);
  } catch (err) {
    console.error(`${file}: engine threw ${err?.message || err}`);
    failed += 1;
    continue;
  }

  const checks = [
    ['js.openDueKey', js.openDueKey, expected.openDueKey],
    ['ts.openDueKey', ts.openDueKey, expected.openDueKey],
    ['js.openTotal', js.openTotal, expected.openTotal],
    ['ts.openTotal', ts.openTotal, expected.openTotal],
    ['js.lastPaidKey', js.lastPaidKey, expected.lastPaidKey ?? null],
    ['ts.lastPaidKey', ts.lastPaidKey, expected.lastPaidKey ?? null],
  ];
  let fileFailed = false;
  for (const [label, actual, want] of checks) {
    const ok = label.includes('Total') ? nearlyEqual(actual, want) : actual === want;
    if (!ok) {
      console.error(`${file} ${id}: ${label} got ${JSON.stringify(actual)} want ${JSON.stringify(want)}`);
      fileFailed = true;
    }
  }
  if (!nearlyEqual(js.openTotal, ts.openTotal) || js.openDueKey !== ts.openDueKey) {
    console.error(`${file} ${id}: JS/TS mismatch js=${JSON.stringify(js)} ts=${JSON.stringify(ts)}`);
    fileFailed = true;
  }
  if (fileFailed) {
    failed += 1;
    continue;
  }
  console.log(`OK ${file} open=${num(js.openTotal)} due=${js.openDueKey}`);
}

if (failed) {
  console.error(`Failed fixtures: ${failed}`);
  process.exit(1);
}
console.log(`Parity passed for ${files.length} fixtures (JS + TS @ ${EXPECTED_VERSION})`);
