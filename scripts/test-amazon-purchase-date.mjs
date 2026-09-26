/**
 * Lucas Amazon Oct/2026: stale PENDING purchaseDate is UTC, so slicing the
 * calendar day splits the series and slides an old parcel onto the open bill.
 */
import assert from 'node:assert/strict';
import {
  installmentPurchaseDate,
  buildCreditCardBills,
} from '../src/utils/creditBillPeriod.js';

const posted = installmentPurchaseDate({
  creditCardMetadata: { purchaseDate: '2025-11-27T03:21:57.007Z' },
});
const pending = installmentPurchaseDate({
  creditCardMetadata: { purchaseDate: '2025-11-28T00:57:08.000Z' },
});
assert.equal(posted, '2025-11-27');
assert.equal(pending, '2025-11-27');
assert.equal(
  installmentPurchaseDate({ creditCardMetadata: { purchaseDate: '2026-03-15' } }),
  '2026-03-15',
);

const card = {
  id: 'amazon',
  type: 'CREDIT',
  name: 'Amazon Prime Bradescard',
  balance: 9000,
  creditData: { creditLimit: 11500, availableCreditLimit: 2500 },
};

function tx(partial) {
  return {
    accountId: 'amazon',
    type: 'DEBIT',
    amount: partial.amount,
    description: partial.description,
    date: partial.date,
    status: partial.status,
    creditCardMetadata: partial.meta,
    ...(partial.billId ? { billId: partial.billId } : {}),
  };
}

const officialBills = [
  { id: 'jun', accountId: 'amazon', dueDate: '2026-06-10', totalAmount: 100, status: 'PAID' },
  { id: 'aug', accountId: 'amazon', dueDate: '2026-08-05', totalAmount: 100, status: 'PAID' },
  { id: 'sep', accountId: 'amazon', dueDate: '2026-09-05', totalAmount: 1602.24, status: 'PAID' },
];

const transactions = [
  tx({
    amount: 121.42,
    description: 'AMAZON BR SA',
    date: '2026-04-27T12:00:00.000Z',
    status: 'POSTED',
    billId: 'jun',
    meta: {
      billId: 'jun',
      billForecastDate: '2026-05',
      purchaseDate: '2025-11-27T03:21:57.007Z',
      installmentNumber: 6,
      totalInstallments: 21,
    },
  }),
  tx({
    amount: 121.42,
    description: 'AMAZON BR SA',
    date: '2026-05-28T12:00:00.000Z',
    status: 'PENDING',
    meta: {
      billForecastDate: '2026-07',
      purchaseDate: '2025-11-28T00:57:08.000Z',
      installmentNumber: 7,
      totalInstallments: 21,
    },
  }),
  tx({
    amount: 15.84,
    description: 'AMAZON BR SA',
    date: '2026-05-06T12:00:00.000Z',
    status: 'POSTED',
    billId: 'jun',
    meta: {
      billId: 'jun',
      billForecastDate: '2026-05',
      purchaseDate: '2026-02-05T03:16:57.007Z',
      installmentNumber: 4,
      totalInstallments: 5,
    },
  }),
  tx({
    amount: 15.84,
    description: 'AMAZON BR SA',
    date: '2026-06-05T12:00:00.000Z',
    status: 'PENDING',
    meta: {
      billForecastDate: '2026-07',
      purchaseDate: '2026-02-06T02:31:56.000Z',
      installmentNumber: 5,
      totalInstallments: 5,
    },
  }),
  tx({
    amount: 10.51,
    description: 'AMAZON BR SA',
    date: '2026-05-14T12:00:00.000Z',
    status: 'POSTED',
    billId: 'jun',
    meta: {
      billId: 'jun',
      billForecastDate: '2026-05',
      purchaseDate: '2026-03-15T03:22:44.013Z',
      installmentNumber: 3,
      totalInstallments: 4,
    },
  }),
  tx({
    amount: 10.51,
    description: 'AMAZON BR SA',
    date: '2026-06-13T12:00:00.000Z',
    status: 'PENDING',
    meta: {
      billForecastDate: '2026-07',
      purchaseDate: '2026-03-16T01:44:08.000Z',
      installmentNumber: 4,
      totalInstallments: 4,
    },
  }),
  tx({
    amount: 10.62,
    description: 'AMAZON BR SA',
    date: '2026-06-02T11:55:23.000Z',
    status: 'PENDING',
    meta: {
      billForecastDate: '2026-07',
      purchaseDate: '2026-06-02T11:55:23.000Z',
      installmentNumber: 1,
      totalInstallments: 4,
    },
  }),
  tx({
    amount: 50,
    description: 'OUTSIDE TI',
    date: '2026-08-23T18:28:17.000Z',
    status: 'PENDING',
    meta: { billForecastDate: '2026-09' },
  }),
];

const built = buildCreditCardBills({
  transactions,
  officialBills,
  creditCards: [card],
  selectedCardId: card.id,
  today: new Date('2026-09-25T12:00:00.000Z'),
});

assert.equal(built.openDueKey, '2026-10');
const oct = built.bills['2026-10'];
const projected = (oct.items || []).filter((t) => t.isProjected);
const labels = projected.map((t) => {
  const n = t.creditCardMetadata?.installmentNumber;
  const m = t.creditCardMetadata?.totalInstallments;
  return `${n}/${m}:${Math.abs(Number(t.amount)).toFixed(2)}`;
});

assert.deepEqual(labels.sort(), ['3/4:10.62', '9/21:121.42']);
assert.ok(!labels.some((l) => l.startsWith('7/21')));
assert.ok(!labels.some((l) => l.startsWith('5/5')));
assert.ok(!labels.some((l) => l.startsWith('4/4')));

console.log('amazon purchase-date drift: ok', labels.join(', '));
