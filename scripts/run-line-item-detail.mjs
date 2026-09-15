#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  fromCreditPurchase,
  fromManualExpense,
  fromReceivable,
  fromTransaction,
} from '../src/utils/lineItemDetail.js';
import { selectedCategoryValue } from '../src/utils/categories.js';

const tx = fromTransaction(
  {
    id: 'tx-1',
    description: 'Uber',
    amount: -32,
    date: '2026-09-15',
    category: 'Taxi and ride-hailing',
    status: 'POSTED',
    type: 'DEBIT',
  },
  'Nubank'
);
assert.equal(tx.kind, 'transaction');
assert.equal(tx.capabilities.togglePaid, false);
assert.equal(tx.capabilities.edit, false);
assert.equal(tx.capabilities.delete, false);
assert.equal(tx.capabilities.createReceivable, false);
assert.equal(tx.capabilities.changeCategory, true);

const manual = fromManualExpense({
  id: 'man-1',
  description: 'Aluguel',
  amount: 1800,
  date: '2026-09-01',
  category: 'Rent',
  isPaid: false,
}, 'Carteira');
assert.equal(manual.kind, 'manualExpense');
assert.equal(manual.capabilities.togglePaid, true);
assert.equal(manual.capabilities.edit, true);
assert.equal(manual.capabilities.delete, true);
assert.equal(manual.capabilities.changeCategory, true);

const receivable = fromReceivable({
  id: 'rec-1',
  description: 'Reembolso',
  personName: 'Ana',
  totalAmount: 90,
  installments: 1,
  installmentHistory: [{ installmentNumber: 1, amount: 90, dueDate: '2026-09-20', paidAt: null }],
});
assert.equal(receivable.kind, 'receivable');
assert.equal(receivable.capabilities.togglePaid, true);

const purchase = fromCreditPurchase(
  { id: 'bill-1', description: 'Farmácia', amount: 45, date: '2026-09-10', type: 'DEBIT' },
  { accountName: 'Inter Black', canCreateReceivable: true }
);
assert.equal(purchase.kind, 'creditBillLine');
assert.equal(purchase.capabilities.createReceivable, true);
assert.equal(purchase.capabilities.changeCategory, true);

const payment = fromCreditPurchase(
  { id: 'pay-1', description: 'Pagamento', amount: -200, type: 'CREDIT', isPayment: true },
  { canCreateReceivable: true }
);
assert.equal(payment.capabilities.createReceivable, false);
assert.equal(payment.capabilities.changeCategory, false);

const matched = selectedCategoryValue(
  { categoryId: '', categoryKey: 'Eating out', category: 'Eating out' },
  [{ value: '07010200', label: 'Eating out' }]
);
assert.equal(matched, '07010200');

console.log('lineItemDetail capabilities ok');
