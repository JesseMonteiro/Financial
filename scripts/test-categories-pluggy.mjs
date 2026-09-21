#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  PLUGGY_BASE_CATEGORIES,
  PLUGGY_BASE_KEYS,
  DEFAULT_PURCHASE_CATEGORIES,
  translateCategory,
  resolveCategoryColor,
  getCategoryIconId,
  pluggyCategoryOptions,
  recategorizationOptions,
  selectedCategoryValue,
} from '../src/utils/categories.js';

console.log('--- Testing Categories & Pluggy Level 1 Integration ---');

// 1. Validate Base Categories Count & Keys
assert.equal(PLUGGY_BASE_CATEGORIES.length, 23);
assert.ok(PLUGGY_BASE_KEYS.has('Food and drinks'));
assert.ok(PLUGGY_BASE_KEYS.has('Groceries'));
assert.ok(PLUGGY_BASE_KEYS.has('Transportation'));
assert.ok(PLUGGY_BASE_KEYS.has('Housing'));
assert.ok(PLUGGY_BASE_KEYS.has('Services'));
assert.ok(PLUGGY_BASE_KEYS.has('Shopping'));
assert.ok(PLUGGY_BASE_KEYS.has('Healthcare'));
assert.ok(PLUGGY_BASE_KEYS.has('Education'));
assert.ok(PLUGGY_BASE_KEYS.has('Leisure'));
assert.ok(PLUGGY_BASE_KEYS.has('Income'));
assert.ok(PLUGGY_BASE_KEYS.has('Investments'));
assert.ok(PLUGGY_BASE_KEYS.has('Transfers'));
assert.ok(PLUGGY_BASE_KEYS.has('Other'));

// All base categories must have valid key, label, color, and icon
for (const cat of PLUGGY_BASE_CATEGORIES) {
  assert.ok(cat.key, `Category missing key`);
  assert.ok(cat.label, `Category ${cat.key} missing label`);
  assert.ok(cat.color?.startsWith('#'), `Category ${cat.key} missing valid hex color`);
  assert.ok(cat.icon, `Category ${cat.key} missing icon`);
  assert.equal(cat.isBase, true);
}
console.log('✓ Base categories integrity check passed');

// 2. Validate Translations
assert.equal(translateCategory('Food and drinks'), 'Alimentação');
assert.equal(translateCategory('Comida e bebidas'), 'Alimentação');
assert.equal(translateCategory('Food'), 'Alimentação');
assert.equal(translateCategory('Groceries'), 'Supermercados');
assert.equal(translateCategory('Transportation'), 'Transporte');
assert.equal(translateCategory('Housing'), 'Habitação');
assert.equal(translateCategory('Healthcare'), 'Saúde');
assert.equal(translateCategory('Income'), 'Renda');
assert.equal(translateCategory('Investments'), 'Investimentos');
assert.equal(translateCategory('Transfers'), 'Transferências');
assert.equal(translateCategory('Same person transfer'), 'Transferência entre mesma pessoa');
assert.equal(translateCategory('Loans and Financing'), 'Empréstimos e Financiamentos');
assert.equal(translateCategory('Bank fees'), 'Taxas bancárias');
assert.equal(translateCategory('Taxes'), 'Impostos');
assert.equal(translateCategory('Insurance'), 'Seguro');
assert.equal(translateCategory('Eating out'), 'Restaurantes e bares');
assert.equal(translateCategory('Food delivery'), 'Delivery de comida');
console.log('✓ Category translations passed');

// 3. Validate Color and Icon Resolution (including legacy aliases)
assert.equal(getCategoryIconId('Food and drinks'), 'utensils');
assert.equal(getCategoryIconId('Food'), 'utensils'); // legacy alias
assert.equal(getCategoryIconId('Transportation'), 'car');
assert.equal(getCategoryIconId('Transport'), 'car'); // legacy alias
assert.equal(getCategoryIconId('Housing'), 'home');
assert.equal(getCategoryIconId('Rent'), 'home'); // legacy alias
assert.equal(getCategoryIconId('Eating out'), 'utensils'); // mapped kind
assert.ok(resolveCategoryColor('Food and drinks'));
assert.ok(resolveCategoryColor('Food'));
console.log('✓ Color and icon resolution with legacy aliases passed');

// 4. Test pluggyCategoryOptions returns ONLY Level 1 categories
const mockPluggyApiResponse = [
  { id: '01000000', description: 'Income', descriptionTranslated: 'Renda', parentId: null },
  { id: '01010000', description: 'Salary', descriptionTranslated: 'Salário', parentId: '01000000' },
  { id: '05000000', description: 'Transfers', descriptionTranslated: 'Transferências', parentId: null },
  { id: '05080000', description: 'Transfer - TED', descriptionTranslated: 'Transferência - TED', parentId: '05000000' },
  { id: '07000000', description: 'Food and drinks', descriptionTranslated: 'Comida e bebidas', parentId: null },
  { id: '07010000', description: 'Eating out', descriptionTranslated: 'Restaurantes e bares', parentId: '07000000' },
];

const l1Options = pluggyCategoryOptions(mockPluggyApiResponse);
// Must contain 3 items (only Level 1), NOT the subcategories (Salary, Transfer - TED, Eating out)
assert.equal(l1Options.length, 3);
const l1Ids = l1Options.map((o) => o.value);
assert.ok(l1Ids.includes('01000000'));
assert.ok(l1Ids.includes('05000000'));
assert.ok(l1Ids.includes('07000000'));
assert.ok(!l1Ids.includes('01010000'), 'Should NOT include subcategory Salary');
assert.ok(!l1Ids.includes('05080000'), 'Should NOT include subcategory Transfer - TED');
assert.ok(!l1Ids.includes('07010000'), 'Should NOT include subcategory Eating out');
const foodL1 = l1Options.find((o) => o.value === '07000000');
assert.equal(foodL1?.label, 'Alimentação', 'Food and drinks must be labeled Alimentação');
console.log('✓ pluggyCategoryOptions filters exclusively to Level 1 passed');

// 5. Test recategorizationOptions combines custom user categories and Level 1
const mockUserCategories = [
  ...PLUGGY_BASE_CATEGORIES,
  { id: 'custom-1', key: 'PetsAndVet', label: 'Pets e Veterinário', color: '#ff0055', icon: 'pawprint', isBase: false },
  { id: 'custom-2', key: 'EmpresaPJ', label: 'Despesas PJ', color: '#00ccaa', icon: 'briefcase', isBase: false },
];

const recat = recategorizationOptions(mockPluggyApiResponse, mockUserCategories);
assert.equal(recat.custom.length, 2);
assert.equal(recat.custom[0].label, 'Despesas PJ');
assert.equal(recat.custom[1].label, 'Pets e Veterinário');
assert.equal(recat.base.length, 23); // strictly all 23 base categories
assert.equal(recat.all.length, 25); // 2 custom + 23 base
const foodRecat = recat.base.find((b) => b.key === 'Food and drinks');
assert.equal(foodRecat?.label, 'Alimentação');
assert.equal(foodRecat?.value, '07000000', 'Should resolve Pluggy category ID from API response');
console.log('✓ recategorizationOptions combination check passed');

// 6. Test selectedCategoryValue resolution
const matchedCustom = selectedCategoryValue(
  { category: 'Despesas PJ', categoryKey: 'EmpresaPJ' },
  recat.all
);
assert.equal(matchedCustom, 'EmpresaPJ');

const matchedBase = selectedCategoryValue(
  { category: 'Transfers', categoryId: '05000000' },
  recat.all
);
assert.equal(matchedBase, '05000000');

// Subcategory "Eating out" resolves to Level 1 "Alimentação" (07000000)
const matchedSub = selectedCategoryValue(
  { category: 'Eating out', categoryId: '07010000' },
  recat.all
);
assert.equal(matchedSub, '07000000');

// Portuguese subcategory "Restaurantes e bares" resolves to Level 1 "Alimentação" (07000000)
const matchedSubPt = selectedCategoryValue(
  { category: 'Restaurantes e bares' },
  recat.all
);
assert.equal(matchedSubPt, '07000000');

console.log('✓ All category integration tests passed successfully!');
