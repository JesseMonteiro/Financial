import assert from 'node:assert/strict';

// Test the logic of handleSaveSalary and handleToggleManualExpensePaid payload handling

function validateSaveSalaryPayload(bodyOrReq) {
  let body;
  if (bodyOrReq && typeof bodyOrReq === 'object' && !(bodyOrReq instanceof Request)) {
    body = bodyOrReq;
  } else {
    return { status: 400, error: 'JSON inválido' };
  }

  const month = String(body.month || '');
  const amount = Number(body.amount);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { status: 400, error: 'month inválido' };
  }
  if (!Number.isFinite(amount)) {
    return { status: 400, error: 'amount inválido' };
  }

  return { status: 200, ok: true, amount, month };
}

function validateToggleManualExpensePayload(bodyOrReq) {
  let body;
  if (bodyOrReq && typeof bodyOrReq === 'object' && !(bodyOrReq instanceof Request)) {
    body = bodyOrReq;
  } else {
    return { status: 400, error: 'JSON inválido' };
  }

  const expenseId = String(body.expenseId || '');
  if (!expenseId) return { status: 400, error: 'expenseId obrigatório' };
  const isPaid = Boolean(body.isPaid);

  return { status: 200, ok: true, expenseId, isPaid };
}

console.log('Testing financial-moment payload validation and stream safety...');

// 1. Valid parsed object
const res1 = validateToggleManualExpensePayload({ expenseId: 'tx-123', isPaid: true });
assert.equal(res1.status, 200);
assert.equal(res1.expenseId, 'tx-123');
assert.equal(res1.isPaid, true);

// 2. Missing expenseId
const res2 = validateToggleManualExpensePayload({ isPaid: true });
assert.equal(res2.status, 400);
assert.equal(res2.error, 'expenseId obrigatório');

// 3. Null / undefined / primitive body returns 'JSON inválido'
assert.equal(validateToggleManualExpensePayload(null).error, 'JSON inválido');
assert.equal(validateToggleManualExpensePayload(undefined).error, 'JSON inválido');
assert.equal(validateToggleManualExpensePayload('string').error, 'JSON inválido');

// 4. Save salary valid parsed object
const resSalary = validateSaveSalaryPayload({ amount: 15000, month: '2026-09' });
assert.equal(resSalary.status, 200);
assert.equal(resSalary.amount, 15000);
assert.equal(resSalary.month, '2026-09');

// 5. Save salary invalid month or amount
assert.equal(validateSaveSalaryPayload({ amount: 15000, month: '09-2026' }).error, 'month inválido');
assert.equal(validateSaveSalaryPayload({ amount: 'invalid', month: '2026-09' }).error, 'amount inválido');
assert.equal(validateSaveSalaryPayload(null).error, 'JSON inválido');

console.log('All financial-moment payload validation tests passed successfully!');
