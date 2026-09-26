import { create } from 'zustand';
import { sendChatbotMessage } from '../services/api';
import { useAccountStore } from './accountStore';
import { useTransactionStore } from './transactionStore';
import { useCreditDataStore } from './creditDataStore';
import { useBudgetStore } from './budgetStore';
import { formatCurrency } from '../utils/formatters';

const DEFAULT_SUGGESTED_PROMPTS = [
  'Qual meu saldo total?',
  'Quais as compras não parceladas no mês de outubro no meu cartão amazon?',
  'Qual cartão tem mais gastos abertos?',
  'Onde gastei mais este mês?',
];

function isInstallmentDescription(text) {
  if (!text) return false;
  return /\b(?:\d+\s*\/\s*\d+|\d+\s*de\s*\d+|parcela\s+\d+)\b/i.test(text);
}

function buildClientFinancialContext() {
  const accounts = useAccountStore.getState().accounts || [];
  const allTransactions = useTransactionStore.getState().transactions || [];
  const creditData = useCreditDataStore.getState().transactionsByAccount || {};
  const budgets = useBudgetStore.getState().budgetCategories || [];

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const cardsList = accounts
    .filter((a) => a.type === 'CREDIT' || a.isCreditCard)
    .map((c) => ({
      id: c.id,
      name: c.name || c.marketingName || 'Cartão',
      institutionName: c.institutionName || '',
      currentBill: formatCurrency(Math.abs(Number(c.balance) || 0)),
      creditLimit: c.creditData?.creditLimit ? formatCurrency(c.creditData.creditLimit) : null,
      availableLimit: c.creditData?.availableCreditLimit ? formatCurrency(c.creditData.availableCreditLimit) : null,
    }));

  const bankAccounts = accounts
    .filter((a) => a.type !== 'CREDIT' && !a.isCreditCard)
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: formatCurrency(Number(a.balance) || 0),
      institutionName: a.institutionName,
    }));

  // Compilar todas as compras de cartão disponíveis
  const creditPurchases = [];
  const seenTx = new Set();

  const addCreditTx = (tx, defaultCardName) => {
    if (!tx || seenTx.has(tx.id)) return;
    seenTx.add(tx.id);

    const isPayment = Boolean(tx.isPayment || tx.category === 'Payment' || tx.type === 'CREDIT');
    if (isPayment) return;

    const account = accountMap.get(tx.accountId);
    const cardName = account?.name || account?.marketingName || defaultCardName || 'Cartão de Crédito';

    const totalInst = tx.installmentTotal || tx.creditCardMetadata?.totalInstallments || 0;
    const numInst = tx.installmentNumber || tx.creditCardMetadata?.installmentNumber;
    const hasInstPattern = isInstallmentDescription(tx.description);
    const isInstallment = totalInst > 1 || hasInstPattern;

    let instLabel = 'À vista (não parcelada)';
    if (isInstallment) {
      instLabel = totalInst > 1 ? `Parcela ${numInst || 1}/${totalInst}` : 'Parcelada';
    }

    const dueMonth = tx.creditCardMetadata?.billForecastDate
      ? String(tx.creditCardMetadata.billForecastDate).slice(0, 7)
      : (tx.date ? String(tx.date).slice(0, 7) : '');

    creditPurchases.push({
      id: tx.id,
      cardName,
      description: tx.description || 'Compra',
      amount: Math.abs(Number(tx.amount) || 0),
      amountLabel: formatCurrency(Math.abs(Number(tx.amount) || 0)),
      date: tx.date ? String(tx.date).slice(0, 10) : '',
      dueMonth,
      isInstallment,
      installmentLabel: instLabel,
      category: tx.category || 'Outros',
      merchant: tx.merchant?.businessName || '',
    });
  };

  // 1. A partir de creditDataStore (carregado para cartões)
  for (const [accId, txList] of Object.entries(creditData)) {
    const card = accountMap.get(accId);
    const cardName = card?.name || 'Cartão';
    if (Array.isArray(txList)) {
      for (const tx of txList) {
        addCreditTx(tx, cardName);
      }
    }
  }

  // 2. A partir de transactionStore
  for (const tx of allTransactions) {
    const account = accountMap.get(tx.accountId);
    if (account?.type === 'CREDIT' || account?.isCreditCard) {
      addCreditTx(tx, account.name);
    }
  }

  return {
    today: new Date().toISOString().slice(0, 10),
    currentMonth: new Date().toISOString().slice(0, 7),
    cards: cardsList,
    bankAccounts,
    creditPurchases: creditPurchases.slice(0, 200),
    budgets: budgets.map((b) => ({
      category: b.category,
      spent: b.spent ? formatCurrency(b.spent) : 'R$ 0,00',
      limit: b.limit ? formatCurrency(b.limit) : 'R$ 0,00',
      percent: b.percent || 0,
    })),
  };
}

export const useChatbotStore = create((set, get) => ({
  isOpen: false,
  messages: [],
  isSending: false,
  error: null,
  suggestedPrompts: DEFAULT_SUGGESTED_PROMPTS,

  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),

  clearHistory: () => set({ messages: [], error: null }),

  sendMessage: async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || get().isSending) return;

    const userMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };

    set((s) => ({
      messages: [...s.messages, userMessage],
      isSending: true,
      error: null,
    }));

    try {
      const context = buildClientFinancialContext();
      const history = get().messages.slice(-10).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await sendChatbotMessage({
        message: trimmed,
        history,
        context,
      });

      const replyText = res?.reply || 'Não foi possível obter resposta no momento.';

      const assistantMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date(),
      };

      set((s) => ({
        messages: [...s.messages, assistantMessage],
        isSending: false,
      }));
    } catch (err) {
      console.error('[ChatbotStore] Erro ao enviar mensagem:', err);
      const errMsg = err.response?.data?.error || err.message || 'Erro ao processar sua pergunta.';
      set((s) => ({
        isSending: false,
        error: errMsg,
        messages: [
          ...s.messages,
          {
            id: `msg-err-${Date.now()}`,
            role: 'assistant',
            text: `⚠️ Desculpe, não consegui processar sua pergunta: ${errMsg}`,
            timestamp: new Date(),
          },
        ],
      }));
    }
  },
}));
