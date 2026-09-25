import assert from 'node:assert';
import {
  getYesterdayDateInfo,
  getCategoryEmoji,
  escapeTelegramMd,
  formatDailySummaryMessage,
} from '../server/routes/chatbot.js';
import { isBillPayment } from '../src/utils/creditBillPeriod.js';

console.log('--- Testes de Unidade: Resumo Diário do Telegram ---');

// 1. Data de Ontem em São Paulo
{
  const refDate = new Date('2026-09-25T14:38:00-03:00');
  const dateInfo = getYesterdayDateInfo(refDate);
  assert.strictEqual(dateInfo.todayStr, '2026-09-25', 'todayStr deve ser 2026-09-25');
  assert.strictEqual(dateInfo.yesterdayStr, '2026-09-24', 'yesterdayStr deve ser 2026-09-24');
  assert.strictEqual(dateInfo.displayDate, '24/09/2026', 'displayDate deve ser 24/09/2026');
  console.log('✓ Cálculo de data (ontem em BRT) validado');
}

// 2. Emojis de categoria
{
  assert.strictEqual(getCategoryEmoji('Alimentação'), '🍔');
  assert.strictEqual(getCategoryEmoji('Supermercados'), '🛒');
  assert.strictEqual(getCategoryEmoji('Transporte'), '🚗');
  assert.strictEqual(getCategoryEmoji('Uber'), '🚗');
  assert.strictEqual(getCategoryEmoji('Saúde'), '💊');
  assert.strictEqual(getCategoryEmoji('Educação'), '📚');
  assert.strictEqual(getCategoryEmoji('Lazer'), '🎉');
  assert.strictEqual(getCategoryEmoji('Serviços'), '⚡');
  assert.strictEqual(getCategoryEmoji('Compras'), '🛍️');
  assert.strictEqual(getCategoryEmoji('Salário'), '💰');
  assert.strictEqual(getCategoryEmoji('Desconhecida'), '📂');
  console.log('✓ Mapeamento de emojis de categoria validado');
}

// 3. Escape de Markdown
{
  assert.strictEqual(escapeTelegramMd('PAG*SUPER_MERCADO [1] `test`'), 'PAG\\*SUPER\\_MERCADO \\[1\\] \\`test\\`');
  assert.strictEqual(escapeTelegramMd('Normal text 123'), 'Normal text 123');
  console.log('✓ Sanitização de caracteres Markdown validada');
}

// 4. Detecção de Pagamento de Fatura (isBillPayment)
{
  assert.strictEqual(isBillPayment({ description: 'PAGAMENTO DE FATURA' }), true);
  assert.strictEqual(isBillPayment({ description: 'PAGAMENTO RECEBIDO' }), true);
  assert.strictEqual(isBillPayment({ description: 'PAGAMENTO PIX' }), true);
  assert.strictEqual(isBillPayment({ description: 'SUPERMERCADO DIA' }), false);
  console.log('✓ Filtro de deduplicação de pagamento de fatura validado');
}

// 5. Formatação da Mensagem: Cenário com transações
{
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
  assert(message.includes('Resumo de Ontem — 24/09/2026'), 'Deve conter o cabeçalho');
  assert(message.includes('Jesse Monteiro'), 'Deve conter o nome do usuário');
  assert(message.includes('Supermercados'), 'Deve listar as categorias');
  assert(message.includes('🛒'), 'Deve exibir emoji da categoria');
  assert(message.includes('Supermercado Extra'), 'Deve listar as transações');
  assert(message.includes('Uber \\* Corrida'), 'Deve ter escapado asterisco no Markdown');
  assert(message.includes('Status Consolidado Atual'), 'Deve conter a seção consolidada');
  assert(message.includes('R$ 3.450,00') || message.includes('3450'), 'Deve conter saldo de contas');
  assert(message.includes('R$ 820,00') || message.includes('820'), 'Deve conter faturas abertas');
  assert(message.includes('R$ 2.780,00') || message.includes('2780'), 'Deve conter saldo consolidado líquido');
  console.log('✓ Formatação da mensagem com transações validada');
}

// 6. Formatação da Mensagem: Cenário sem transações (para requisição sob demanda /ontem)
{
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
  assert(emptyMsg.includes('Nenhuma transação foi realizada no dia anterior'), 'Deve informar que não houve transações');
  assert(emptyMsg.includes('Status Consolidado Atual'), 'Ainda deve exibir o status consolidado');
  console.log('✓ Formatação de mensagem vazia validada');
}

console.log('\n🎉 Todos os testes de unidade passaram com sucesso!');
