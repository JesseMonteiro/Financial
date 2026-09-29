import { describe, it, expect } from 'vitest';
import {
  isSamePersonTransfer,
  isExpenseTx,
  isIncomeTx,
  expensesByCategory,
} from '../src/utils/analytics.js';
import {
  groupTransactionsByCategory,
  calculateIncomeVsExpense,
} from '../src/utils/calculations.js';
import { BUDGET_EXCLUDED_CATEGORIES } from '../src/utils/budgetPeriod.js';
import {
  isSamePersonTransfer as edgeIsSamePersonTransfer,
  isExpenseTx as edgeIsExpenseTx,
  isIncomeTx as edgeIsIncomeTx,
  expensesByCategory as edgeExpensesByCategory,
} from '../supabase/functions/pluggy-proxy/utils/dashboardAnalytics.ts';
import { BUDGET_EXCLUDED_CATEGORIES as EDGE_BUDGET_EXCLUDED_CATEGORIES } from '../supabase/functions/pluggy-proxy/utils/budgetPeriod.ts';

describe('Same Person Transfer exclusion and parity', () => {
  const sampleSamePersonByPluggyCategory = {
    id: 'tx-1',
    description: 'Transferência recebida',
    amount: 1500,
    type: 'CREDIT',
    category: 'Same person transfer',
    date: '2026-09-15T12:00:00Z',
  };

  const sampleSamePersonBySubcategory = {
    id: 'tx-2',
    description: 'Pix enviado',
    amount: -500,
    type: 'DEBIT',
    category: 'Same person transfer - PIX',
    date: '2026-09-15T12:00:00Z',
  };

  const sampleSamePersonByDescription = {
    id: 'tx-3',
    description: 'TRANSF PROPRIA MESMA TITULARIDADE',
    amount: -800,
    type: 'DEBIT',
    category: 'Transfers',
    date: '2026-09-15T12:00:00Z',
  };

  const sampleSamePersonByPaymentData = {
    id: 'tx-4',
    description: 'PIX ENVIADO',
    amount: -300,
    type: 'DEBIT',
    category: 'Transfers',
    date: '2026-09-15T12:00:00Z',
    paymentData: {
      payer: { documentNumber: { value: '123.456.789-00' } },
      receiver: { documentNumber: { value: '12345678900' } },
    },
  };

  const sampleNormalExpense = {
    id: 'tx-5',
    description: 'Supermercado Pão de Açúcar',
    amount: -250,
    type: 'DEBIT',
    category: 'Food and drinks',
    date: '2026-09-15T12:00:00Z',
  };

  const sampleNormalIncome = {
    id: 'tx-6',
    description: 'Recebimento de Cliente',
    amount: 8000,
    type: 'CREDIT',
    category: 'Income',
    date: '2026-09-15T12:00:00Z',
  };

  it('correctly detects same-person transfers across heuristics', () => {
    expect(isSamePersonTransfer(sampleSamePersonByPluggyCategory)).toBe(true);
    expect(isSamePersonTransfer(sampleSamePersonBySubcategory)).toBe(true);
    expect(isSamePersonTransfer(sampleSamePersonByDescription)).toBe(true);
    expect(isSamePersonTransfer(sampleSamePersonByPaymentData)).toBe(true);
    expect(isSamePersonTransfer(sampleNormalExpense)).toBe(false);
    expect(isSamePersonTransfer(sampleNormalIncome)).toBe(false);

    // Parity with Edge function
    expect(edgeIsSamePersonTransfer(sampleSamePersonByPluggyCategory)).toBe(true);
    expect(edgeIsSamePersonTransfer(sampleSamePersonBySubcategory)).toBe(true);
    expect(edgeIsSamePersonTransfer(sampleSamePersonByDescription)).toBe(true);
    expect(edgeIsSamePersonTransfer(sampleSamePersonByPaymentData)).toBe(true);
    expect(edgeIsSamePersonTransfer(sampleNormalExpense)).toBe(false);
    expect(edgeIsSamePersonTransfer(sampleNormalIncome)).toBe(false);
  });

  it('excludes same person transfers from isExpenseTx and isIncomeTx', () => {
    // Web client
    expect(isExpenseTx(sampleSamePersonBySubcategory)).toBe(false);
    expect(isExpenseTx(sampleSamePersonByDescription)).toBe(false);
    expect(isIncomeTx(sampleSamePersonByPluggyCategory)).toBe(false);
    expect(isExpenseTx(sampleNormalExpense)).toBe(true);
    expect(isIncomeTx(sampleNormalIncome)).toBe(true);

    // Edge function parity
    expect(edgeIsExpenseTx(sampleSamePersonBySubcategory)).toBe(false);
    expect(edgeIsExpenseTx(sampleSamePersonByDescription)).toBe(false);
    expect(edgeIsIncomeTx(sampleSamePersonByPluggyCategory)).toBe(false);
    expect(edgeIsExpenseTx(sampleNormalExpense)).toBe(true);
    expect(edgeIsIncomeTx(sampleNormalIncome)).toBe(true);
  });

  it('excludes same person transfers from category spend breakdown', () => {
    const list = [
      sampleNormalExpense,
      sampleSamePersonByPluggyCategory,
      sampleSamePersonBySubcategory,
      sampleSamePersonByDescription,
      sampleSamePersonByPaymentData,
    ];

    const webCats = expensesByCategory(list, { ym: '2026-09' });
    expect(webCats).toEqual([{ name: 'Alimentação', value: 250 }]);

    const edgeCats = edgeExpensesByCategory(list, { ym: '2026-09' });
    expect(edgeCats[0].name).toBe('Alimentação');
    expect(edgeCats[0].value).toBe(250);
  });

  it('excludes same person transfers from calculations.js', () => {
    const list = [
      sampleNormalExpense,
      sampleNormalIncome,
      sampleSamePersonByPluggyCategory,
      sampleSamePersonBySubcategory,
    ];

    const { income, expense, net } = calculateIncomeVsExpense(list);
    expect(income).toBe(8000);
    expect(expense).toBe(250);
    expect(net).toBe(7750);

    const grouped = groupTransactionsByCategory(list);
    expect(grouped.find((g) => g.name === 'Food and drinks' || g.name === 'Alimentação')).toBeDefined();
    expect(grouped.find((g) => g.name === 'Same person transfer')).toBeUndefined();
    expect(grouped.find((g) => g.name === 'Transferência entre mesma pessoa')).toBeUndefined();
  });

  it('includes same person transfer categories in budget exclusions', () => {
    expect(BUDGET_EXCLUDED_CATEGORIES).toContain('Same person transfer');
    expect(BUDGET_EXCLUDED_CATEGORIES).toContain('Transferência entre mesma pessoa');
    expect(EDGE_BUDGET_EXCLUDED_CATEGORIES).toContain('Same person transfer');
    expect(EDGE_BUDGET_EXCLUDED_CATEGORIES).toContain('Transferência entre mesma pessoa');
  });
});
