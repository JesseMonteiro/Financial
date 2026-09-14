#!/usr/bin/env node
/**
 * Validates credit-bill fixtures schema used by JS/TS/Swift parity.
 * Accepts both full fixtures (fixtureId + card) and lightweight stubs (id + account).
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('docs/fixtures/credit-bills');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
if (!files.length) {
  console.error('No fixtures found');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const id = raw.fixtureId || raw.id;
  if (!id) {
    console.error(`${file}: missing fixtureId/id`);
    failed += 1;
  }
  if (!raw.connectorProfileId) {
    console.error(`${file}: missing connectorProfileId`);
    failed += 1;
  }
  if (!raw.calculationVersion) {
    console.error(`${file}: missing calculationVersion`);
    failed += 1;
  }
  if (!raw.card && !raw.account) {
    console.error(`${file}: missing card/account`);
    failed += 1;
  }
  if (!raw.expected) {
    console.error(`${file}: missing expected`);
    failed += 1;
  }
  console.log(`OK ${file} (${raw.calculationVersion})`);
}

if (failed) {
  console.error(`Failed checks: ${failed}`);
  process.exit(1);
}
console.log(`Validated ${files.length} fixtures`);

