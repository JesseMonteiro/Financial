import { describe, it, expect } from 'vitest';
import {
  computeFinancialMomentMonth,
  buildFinancialMomentMonthList,
  cardBillAmountForMonth,
} from '../src/utils/financialMomentMonth.js';

describe('Financial Moment Month Utilities', () => {
  describe('buildFinancialMomentMonthList', () => {
    it('generates a 12-month rolling range centered on the given date (-6 to +5)', () => {
      const baseDate = new Date('2026-09-15T12:00:00Z');
      const list = buildFinancialMomentMonthList(baseDate);

      expect(list).toHaveLength(12);
      expect(list[6].ym).toBe('2026-09');
      expect(list[0].ym).toBe('2026-03');
      expect(list[11].ym).toBe('2027-02'); // Next year +5 months from Sept is Feb 2027
      expect(list[11].year).toBe(2027);
      expect(list[6].label).toContain('2026');
    });
  });

  describe('computeFinancialMomentMonth', () => {
    it('returns null if selectedMonth is not provided', () => {
      const res = computeFinancialMomentMonth({ selectedMonth: '' });
      expect(res).toBeNull();
    });

    it('Scenario 1: Base case with simple salary and no expenses', () => {
      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 10000,
      });

      expect(res.salary).toBe(10000);
      expect(res.receivablesTotal).toBe(0);
      expect(res.entriesTotal).toBe(10000);
      expect(res.expensesTotal).toBe(0);
      expect(res.netBalance).toBe(10000);
      expect(res.accountsPayableTotal).toBe(0);
      expect(res.unpaidBills).toHaveLength(0);
      expect(res.unpaidManual).toHaveLength(0);
    });

    it('Scenario 2: Resolves salary from salaries map when salary override is not passed', () => {
      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salaries: {
          '2026-08': 8000,
          '2026-09': 12500,
          '2026-10': 9000,
        },
      });

      expect(res.salary).toBe(12500);
      expect(res.entriesTotal).toBe(12500);
    });

    it('Scenario 3: Parses receivables with camelCase schema', () => {
      const receivables = [
        {
          id: 'rec-1',
          personName: 'Carlos',
          personColor: '#10b981',
          description: 'Empréstimo notebook',
          installments: 3,
          installmentHistory: [
            { dueDate: '2026-08-10', amount: 500 },
            { dueDate: '2026-09-10', amount: 500, paidAt: '2026-09-09' },
            { dueDate: '2026-10-10', amount: 500 },
          ],
        },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 5000,
        receivables,
      });

      expect(res.receivablesTotal).toBe(500);
      expect(res.entriesTotal).toBe(5500);
      expect(res.activeReceivables).toHaveLength(1);
      expect(res.activeReceivables[0].personName).toBe('Carlos');
      expect(res.activeReceivables[0].paidAt).toBe('2026-09-09');
    });

    it('Scenario 4: Parses receivables with snake_case schema (DB drift resilience)', () => {
      const receivables = [
        {
          id: 'rec-2',
          person_name: 'Beatriz',
          person_color: '#8b5cf6',
          description: 'Aluguel compartilhado',
          total_installments: 1,
          installment_history: [
            { due_date: '2026-09-15', amount: 1200, paid_at: null },
          ],
        },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 6000,
        receivables,
      });

      expect(res.receivablesTotal).toBe(1200);
      expect(res.entriesTotal).toBe(7200);
      expect(res.activeReceivables[0].personName).toBe('Beatriz');
      expect(res.activeReceivables[0].paidAt).toBeNull();
    });

    it('Scenario 5: Credit card with paid official bill (unpaidBills is empty)', () => {
      const creditCards = [{ id: 'card-inter', name: 'Inter Black' }];
      const cardBills = [
        {
          id: 'bill-1',
          accountId: 'card-inter',
          dueDate: '2026-09-10',
          totalAmount: 1850.5,
          isPaid: true,
        },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 10000,
        creditCards,
        cardBills,
      });

      expect(res.creditCardsTotal).toBe(1850.5);
      expect(res.activeBills).toHaveLength(1);
      expect(res.activeBills[0].isPaid).toBe(true);
      expect(res.unpaidBills).toHaveLength(0);
      expect(res.unpaidCreditTotal).toBe(0);
      expect(res.accountsPayableTotal).toBe(0);
      expect(res.netBalance).toBe(10000 - 1850.5);
    });

    it('Scenario 6: Credit card with unpaid official bill (contributes to accountsPayableTotal)', () => {
      const creditCards = [{ id: 'card-nubank', name: 'Nubank Ultravioleta' }];
      const cardBills = [
        {
          account_id: 'card-nubank',
          due_date: '2026-09-20',
          total_amount: 3200.75,
          is_paid: false,
        },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 10000,
        creditCards,
        cardBills,
      });

      expect(res.creditCardsTotal).toBe(3200.75);
      expect(res.activeBills).toHaveLength(1);
      expect(res.activeBills[0].isPaid).toBe(false);
      expect(res.unpaidBills).toHaveLength(1);
      expect(res.unpaidCreditTotal).toBe(3200.75);
      expect(res.accountsPayableTotal).toBe(3200.75);
      expect(res.netBalance).toBe(10000 - 3200.75);
    });

    it('Scenario 7: Manual expenses distinction between paid and unpaid', () => {
      const transactions = [
        {
          id: 'tx-m1',
          description: 'Faxina paga',
          amount: 250,
          date: '2026-09-05',
          isManual: true,
          isPaid: true,
        },
        {
          id: 'tx-m2',
          description: 'Manutenção ar-condicionado pendente',
          amount: 400,
          dueDate: '2026-09-25',
          isManual: true,
          isPaid: false,
        },
        {
          id: 'tx-m3',
          description: 'Gasto em outro mês',
          amount: 150,
          date: '2026-08-20',
          isManual: true,
          isPaid: false,
        },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 8000,
        transactions,
      });

      expect(res.manualExpensesTotal).toBe(650);
      expect(res.activeManual).toHaveLength(2);
      expect(res.unpaidManual).toHaveLength(1);
      expect(res.unpaidManual[0].description).toBe('Manutenção ar-condicionado pendente');
      expect(res.unpaidManualTotal).toBe(400);
      expect(res.accountsPayableTotal).toBe(400);
      expect(res.netBalance).toBe(8000 - 650);
    });

    it('Scenario 8: Manual expenses with snake_case fields (is_manual, is_paid, due_date)', () => {
      const transactions = [
        {
          id: 'tx-snk-1',
          description: 'Pintura',
          amount: 800,
          due_date: '2026-09-18',
          is_manual: true,
          is_paid: false,
        },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 5000,
        transactions,
      });

      expect(res.manualExpensesTotal).toBe(800);
      expect(res.unpaidManualTotal).toBe(800);
      expect(res.accountsPayableTotal).toBe(800);
    });

    it('Scenario 9: Automatic debits calculation for bank accounts', () => {
      const bankAccountIds = ['acc-itau-1'];
      const transactions = [
        {
          id: 'tx-deb-1',
          description: 'Débito Automático CPFL Energia',
          amount: -180.4,
          date: '2026-09-12',
          accountId: 'acc-itau-1',
          status: 'PENDING',
        },
        {
          id: 'tx-deb-2',
          description: 'Débito Automático Internet Fibra',
          amount: -120.0,
          date: '2026-09-15',
          accountId: 'acc-itau-1',
          status: 'POSTED',
        },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 7000,
        transactions,
        bankAccountIds,
        bankAccountNameById: { 'acc-itau-1': 'Itaú Personalité' },
      });

      expect(res.automaticDebitsTotal).toBeCloseTo(300.4, 2);
      expect(res.expensesTotal).toBeCloseTo(300.4, 2);
      expect(res.netBalance).toBeCloseTo(7000 - 300.4, 2);
      expect(res.unpaidAutomaticDebitsTotal).toBeCloseTo(180.4, 2);
    });

    it('Scenario 10: Multi-card joint calculation summing distinct card bills correctly', () => {
      const creditCards = [
        { id: 'card-1', name: 'XP Visa Infinite' },
        { id: 'card-2', name: 'BTG Mastercard Black' },
      ];
      const cardBills = [
        {
          accountId: 'card-1',
          dueDate: '2026-09-10',
          totalAmount: 2500,
          isPaid: true,
        },
        {
          accountId: 'card-2',
          dueDate: '2026-09-25',
          totalAmount: 1500,
          isPaid: false,
        },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 15000,
        creditCards,
        cardBills,
      });

      expect(res.creditCardsTotal).toBe(4000);
      expect(res.activeBills).toHaveLength(2);
      expect(res.unpaidBills).toHaveLength(1);
      expect(res.unpaidCreditTotal).toBe(1500);
      expect(res.accountsPayableTotal).toBe(1500);
      expect(res.netBalance).toBe(11000);
    });

    it('Scenario 11: Combined full scenario (salary + receivables - creditCards - manual - debits)', () => {
      const creditCards = [{ id: 'card-1', name: 'Inter' }];
      const cardBills = [
        { accountId: 'card-1', dueDate: '2026-09-10', totalAmount: 1000, isPaid: false },
      ];
      const receivables = [
        {
          id: 'rec-1',
          description: 'Consultoria',
          installmentHistory: [{ dueDate: '2026-09-01', amount: 3000 }],
        },
      ];
      const transactions = [
        { id: 'man-1', description: 'Dentista', amount: 500, date: '2026-09-04', isManual: true, isPaid: false },
      ];

      const res = computeFinancialMomentMonth({
        selectedMonth: '2026-09',
        salary: 10000,
        creditCards,
        cardBills,
        receivables,
        transactions,
      });

      expect(res.entriesTotal).toBe(13000); // 10000 + 3000
      expect(res.expensesTotal).toBe(1500);  // 1000 card + 500 manual
      expect(res.netBalance).toBe(11500);    // 13000 - 1500
      expect(res.accountsPayableTotal).toBe(1500); // 1000 unpaid card + 500 unpaid manual
    });
  });
});
