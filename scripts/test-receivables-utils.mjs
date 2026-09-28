import assert from 'node:assert/strict';
import {
  getInitials,
  dueKey,
  nextPendingDue,
  receivableSortKey,
  sortReceivablesByDue,
  receivableEffectiveTotal,
  generateReceivableInstallments,
  personReceivableTotals,
  summarizeReceivables,
  groupReceivablesByPerson,
  reimbursementsReceivedInMonth,
  CONTINUOUS_PROJECTION_MONTHS,
} from '../src/utils/receivables.js';

console.log('Testing receivables utils...');

// 1. getInitials
assert.equal(getInitials('Jesse Monteiro'), 'JM');
assert.equal(getInitials('Jesse'), 'J');
assert.equal(getInitials(''), '');
assert.equal(getInitials('Ana Maria Silva'), 'AM');

// 2. dueKey
assert.equal(dueKey({ dueDate: '2026-03-15T00:00:00.000Z' }), '2026-03-15');
assert.equal(dueKey(null), '');

// 3. 24-month continuous projection
const continuous = generateReceivableInstallments({
  totalAmount: 150, // R$ 150/mês
  isContinuous: true,
  firstDueDate: '2026-01-10',
});
assert.equal(continuous.length, CONTINUOUS_PROJECTION_MONTHS, 'Continuous projection must yield 24 installments');
assert.equal(continuous[0].amount, 150);
assert.equal(continuous[0].dueDate, '2026-01-10');
assert.equal(continuous[23].dueDate, '2027-12-10');
assert.equal(continuous[0].paidAt, null);

// 4. Fixed installments
const fixed = generateReceivableInstallments({
  totalAmount: 600,
  installments: 3,
  firstDueDate: '2026-01-15',
  isContinuous: false,
});
assert.equal(fixed.length, 3);
assert.equal(fixed[0].amount, 200);
assert.equal(fixed[2].amount, 200);

// 5. nextPendingDue & receivableSortKey
const rec1 = {
  id: 'r1',
  personName: 'Carlos',
  installmentHistory: [
    { installmentNumber: 1, dueDate: '2026-01-10', paidAt: '2026-01-09T10:00:00Z', amount: 100 },
    { installmentNumber: 2, dueDate: '2026-02-10', paidAt: null, amount: 100 },
  ],
};
const recSettled = {
  id: 'r2',
  personName: 'Ana',
  installmentHistory: [
    { installmentNumber: 1, dueDate: '2025-12-10', paidAt: '2025-12-08T10:00:00Z', amount: 50 },
  ],
};
assert.equal(nextPendingDue(rec1.installmentHistory), '2026-02-10');
assert.equal(nextPendingDue(recSettled.installmentHistory), null);
assert.equal(receivableSortKey(rec1), '0_2026-02-10');
assert.equal(receivableSortKey(recSettled), '1_2025-12-10');

// 6. sortReceivablesByDue
const sorted = sortReceivablesByDue([recSettled, rec1]);
assert.equal(sorted[0].id, 'r1', 'Pending due must sort before settled');
assert.equal(sorted[1].id, 'r2');

// 7. receivableEffectiveTotal
assert.equal(receivableEffectiveTotal({ totalAmount: 300, isContinuous: false }), 300);
assert.equal(receivableEffectiveTotal({ totalAmount: 100, isContinuous: true, installmentHistory: [{ amount: 100 }] }), 2400);

// 8. personReceivableTotals
const personTotals = personReceivableTotals([rec1]);
assert.equal(personTotals.pending, 100);
assert.equal(personTotals.paid, 100);
assert.equal(personTotals.total, 200);
assert.equal(personTotals.pct, 50);

// 9. summarizeReceivables
const summary = summarizeReceivables([rec1, recSettled]);
assert.equal(summary.totalToReceive, 100);
assert.equal(summary.totalReceived, 150);
assert.equal(summary.numPeople, 2);
assert.equal(summary.nextDueDate, '2026-02-10');

// 10. groupReceivablesByPerson
const groups = groupReceivablesByPerson([rec1, recSettled]);
assert.equal(groups.length, 2);
assert.equal(groups[0].personName, 'Carlos', 'Carlos has pending due so should be first');

// 11. reimbursementsReceivedInMonth
assert.equal(reimbursementsReceivedInMonth([rec1, recSettled], '2026-01'), 100);
assert.equal(reimbursementsReceivedInMonth([rec1, recSettled], '2025-12'), 50);
assert.equal(reimbursementsReceivedInMonth([rec1, recSettled], '2026-02'), 0);

console.log('✓ All receivables utils tests passed successfully!');
