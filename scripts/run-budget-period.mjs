#!/usr/bin/env node
/**
 * Period-aware budget allowance + VA/VR category mapping.
 */
import assert from 'node:assert/strict';
import {
  allowance,
  asOfForBudgetMonth,
  mergeBudgetRows,
  monthCap,
  periodCount,
  startedPeriods,
} from '../src/utils/budgetPeriod.js';
import {
  defaultMealCategoryForKind,
  mealSpendByCategory,
  remainingAsOf,
} from '../src/utils/mealBenefits.js';

const ym = '2026-09';

assert.equal(periodCount('daily', ym), 30);
assert.equal(periodCount('weekly', ym), 4);
assert.equal(periodCount('biweekly', ym), 2);
assert.equal(periodCount('monthly', ym), 1);
assert.equal(periodCount('nope', ym), 1);

assert.equal(startedPeriods('daily', ym, '2026-09-01'), 1);
assert.equal(startedPeriods('daily', ym, '2026-09-14'), 14);
assert.equal(startedPeriods('daily', ym, '2026-09-30'), 30);
assert.equal(startedPeriods('weekly', ym, '2026-09-07'), 1);
assert.equal(startedPeriods('weekly', ym, '2026-09-08'), 2);
assert.equal(startedPeriods('weekly', ym, '2026-09-21'), 3);
assert.equal(startedPeriods('weekly', ym, '2026-09-22'), 4);
assert.equal(startedPeriods('biweekly', ym, '2026-09-15'), 1);
assert.equal(startedPeriods('biweekly', ym, '2026-09-16'), 2);
assert.equal(startedPeriods('monthly', ym, '2026-09-14'), 1);

assert.equal(allowance(20, 'daily', ym, '2026-09-14'), 280);
assert.equal(allowance(500, 'weekly', ym, '2026-09-14'), 1000);
assert.equal(allowance(200, 'monthly', ym, '2026-09-14'), 200);
assert.equal(monthCap(500, 'weekly', ym), 2000);
assert.equal(asOfForBudgetMonth(ym, '2026-10-03'), '2026-09-30');
assert.equal(startedPeriods('daily', ym, asOfForBudgetMonth(ym, '2026-10-03')), 30);
assert.equal(startedPeriods('daily', '2026-10', '2026-10-01'), 1);
assert.equal(allowance(20, 'daily', '2026-10', '2026-10-01'), 20);

assert.equal(defaultMealCategoryForKind('VA'), 'Supermercado & Alimentação');
assert.equal(defaultMealCategoryForKind('VR'), 'Restaurantes & Bares');

const benefits = [
  { id: 'va1', kind: 'VA', monthlyAmount: 800, creditDay: 1, startsOn: '2026-01-01', openingBalance: 0 },
  { id: 'vr1', kind: 'VR', monthlyAmount: 400, creditDay: 1, startsOn: '2026-01-01', openingBalance: 0 },
];
const purchases = [
  { id: 'p1', benefitId: 'va1', amount: 120, purchasedAt: '2026-09-10' },
  { id: 'p2', benefitId: 'vr1', amount: 45, purchasedAt: '2026-09-12' },
  { id: 'p3', benefitId: 'vr1', amount: 30, purchasedAt: '2026-09-13', category: 'Delivery de Comida' },
  { id: 'p4', benefitId: 'va1', amount: 50, purchasedAt: '2026-08-20' },
];
const mealMap = mealSpendByCategory(benefits, purchases, ym);
assert.equal(mealMap['Supermercado & Alimentação'], 120);
assert.equal(mealMap['Restaurantes & Bares'], 45);
assert.equal(mealMap['Delivery de Comida'], 30);

const remaining = remainingAsOf(benefits[0], purchases, '2026-09-14');
assert.equal(remaining, 800 * 9 - 170);

const rows = mergeBudgetRows({
  spentBankMap: { 'Supermercado & Alimentação': 80 },
  spentMealMap: mealMap,
  budgets: [
    { id: 'b1', category: 'Supermercado & Alimentação', limit: 500, period: 'weekly' },
    { id: 'b2', category: 'Restaurantes & Bares', limit: 20, period: 'daily' },
  ],
  ym,
  asOfDate: '2026-09-14',
});
const grocery = rows.find((r) => r.category === 'Groceries' || r.category === 'Supermercado & Alimentação');
assert.ok(grocery);
assert.equal(grocery.spentBank, 80);
assert.equal(grocery.spentMeal, 120);
assert.equal(grocery.spent, 200);
assert.equal(grocery.allowance, 1000);
assert.equal(grocery.limit, 1000);
assert.equal(grocery.monthCap, 2000);
assert.equal(grocery.period, 'weekly');

const resto = rows.find((r) => r.category === 'Eating out' || r.category === 'Restaurantes & Bares');
assert.ok(resto);
assert.equal(resto.spentMeal, 45);
assert.equal(resto.allowance, 280);

console.log('OK budget period + VA/VR mapping');
