import { describe, it, expect } from 'vitest';
import {
  getYesterdayDateInfo,
  getCategoryEmoji,
  escapeTelegramMd,
  formatDailySummaryMessage,
} from '../server/routes/chatbot.js';
import { isBillPayment } from '../src/utils/creditBillPeriod.js';

describe('Telegram Daily Summary Unit Tests', () => {
  it('calculates yesterday date in São Paulo timezone correctly', () => {
    const refDate = new Date('2026-09-25T14:38:00-03:00');
    const dateInfo = getYesterdayDateInfo(refDate);
    expect(dateInfo.todayStr).toBe('2026-09-25');
    expect(dateInfo.yesterdayStr).toBe('2026-09-24');
    expect(dateInfo.displayDate).toBe('24/09/2026');
  });

  it('maps category names to appropriate emojis', () => {
    expect(getCategoryEmoji('Alimentação')).toBe('🍔');
    expect(getCategoryEmoji('Supermercados')).toBe('🛒');
    expect(getCategoryEmoji('Transporte')).toBe('🚗');
    expect(getCategoryEmoji('Uber')).toBe('🚗');
    expect(getCategoryEmoji('Saúde')).toBe('💊');
    expect(getCategoryEmoji('Educação')).toBe('📚');
    expect(getCategoryEmoji('Lazer')).toBe('🎉');
    expect(getCategoryEmoji('Serviços')).toBe('⚡');
    expect(getCategoryEmoji('Compras')).toBe('🛍️');
    expect(getCategoryEmoji('Salário')).toBe('💰');
    expect(getCategoryEmoji('Desconhecida')).toBe('📂');
  });

  it('escapes Markdown special characters safely', () => {
    expect(escapeTelegramMd('PAG*SUPER_MERCADO [1] `test`')).toBe(
      'PAG\\*SUPER\\_MERCADO \\[1\\] \\`test\\`'
    );
    expect(escapeTelegramMd('Normal text 123')).toBe('Normal text 123');
  });

  it('filters out credit card bill payments from transaction list', () => {
    expect(isBillPayment({ description: 'PAGAMENTO DE FATURA' })).toBe(true);
    expect(isBillPayment({ description: 'PAGAMENTO RECEBIDO' })).toBe(true);
    expect(isBillPayment({ description: 'PAGAMENTO PIX' })).toBe(true);
    expect(isBillPayment({ description: 'SUPERMERCADO DIA' })).toBe(false);
  });

  it('formats daily summary message with active transactions and consolidated totals', () => {
    const profile = { display_name: 'Jesse Monteiro' };
    const summaryData = {
      targetDateStr: '2026-09-24',
      displayDate: '24/09/2026',
      hasTransactions: true,
      transactions: [
        {
          id: 'tx-1',
          description: 'Supermercado Extra',
          absAmount: 120.5,
          type: 'DEBIT',
          accountName: 'Nubank Roxinho',
          category: 'Supermercados',
        },
        {
          id: 'tx-2',
          description: 'Uber * Corrida',
          absAmount: 23.5,
          type: 'DEBIT',
          accountName: 'Itaú Click',
          category: 'Transporte',
        },
        {
          id: 'tx-3',
          description: 'Pix Recebido de João',
          absAmount: 50.0,
          type: 'CREDIT',
          accountName: 'Nubank Roxinho',
          category: 'Transferências',
        },
      ],
      totalExpenses: 144.0,
      totalIncome: 50.0,
      expenseCount: 2,
      incomeCount: 1,
      netDay: -94.0,
      categories: [
        { category: 'Supermercados', amount: 120.5, emoji: '🛒', percentage: 83.68 },
        { category: 'Transporte', amount: 23.5, emoji: '🚗', percentage: 16.32 },
      ],
      consolidatedStatus: {
        bankTotal: 3450.0,
        manualBalance: 150.0,
        totalAvailable: 3600.0,
        creditDebt: 820.0,
        netConsolidated: 2780.0,
        hasBankAccounts: true,
        hasCreditCards: true,
      },
    };

    const message = formatDailySummaryMessage(profile, summaryData);
    expect(message).toContain('Resumo de Ontem — 24/09/2026');
    expect(message).toContain('Jesse Monteiro');
    expect(message).toContain('Supermercados');
    expect(message).toContain('🛒');
    expect(message).toContain('Supermercado Extra');
    expect(message).toContain('Uber \\* Corrida');
    expect(message).toContain('Status Consolidado Atual');
    expect(message).toMatch(/3\.?450/);
    expect(message).toMatch(/820/);
    expect(message).toMatch(/2\.?780/);
  });

  it('formats daily summary message cleanly when there are no transactions', () => {
    const profile = { display_name: 'Jesse' };
    const emptySummary = {
      targetDateStr: '2026-09-24',
      displayDate: '24/09/2026',
      hasTransactions: false,
      transactions: [],
      consolidatedStatus: {
        bankTotal: 5000.0,
        manualBalance: 0,
        totalAvailable: 5000.0,
        creditDebt: 1200.0,
        netConsolidated: 3800.0,
        hasBankAccounts: true,
        hasCreditCards: true,
      },
    };

    const emptyMsg = formatDailySummaryMessage(profile, emptySummary);
    expect(emptyMsg).toContain('Nenhuma transação foi realizada no dia anterior');
    expect(emptyMsg).toContain('Status Consolidado Atual');
  });
});
