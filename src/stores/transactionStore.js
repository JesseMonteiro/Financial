import { create } from 'zustand';
import { fetchTransactions } from '../services/api';
import { getStoredManualTransactions, saveStoredManualTransaction, deleteStoredManualTransaction } from '../services/storage';

export const useTransactionStore = create((set, get) => ({
  transactions: [],
  loading: false,
  error: null,
  filters: {
    search: '',
    category: 'all',
    accountId: 'all',
    type: 'all',
    dateRange: '30d'
  },

  setFilters: (newFilters) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  loadTransactions: async () => {
    set({ loading: true, error: null });
    try {
      const [apiRes, manualTxs] = await Promise.all([
        fetchTransactions(),
        getStoredManualTransactions()
      ]);
      const apiList = apiRes.results || apiRes || [];
      
      set({
        transactions: [...apiList, ...manualTxs],
        loading: false
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addManualTransaction: async (txData) => {
    const newTxs = [];
    const isRecurring = txData.isRecurring;
    const isContinuous = isRecurring && txData.isContinuous;
    
    // For continuous recurrence, we generate 24 months in advance
    const occurrences = isContinuous ? 24 : (isRecurring ? parseInt(txData.occurrences, 10) || 12 : 1);
    const baseDate = new Date(txData.date || new Date());
    const parentId = crypto.randomUUID();

    for (let i = 0; i < occurrences; i++) {
      const txDate = new Date(baseDate);
      if (isRecurring) {
        if (txData.frequency === 'weekly') {
          txDate.setDate(baseDate.getDate() + i * 7);
        } else if (txData.frequency === 'yearly') {
          txDate.setFullYear(baseDate.getFullYear() + i);
        } else {
          // default: monthly
          txDate.setMonth(baseDate.getMonth() + i);
        }
      }

      const id = crypto.randomUUID();
      const amount = -Math.abs(parseFloat(txData.amount)); // Manual expenses are always negative (debits)
      
      let suffix = '';
      if (isRecurring) {
        suffix = isContinuous ? ' (Recorrente)' : ` (${i + 1}/${occurrences})`;
      }

      const newTx = {
        id,
        description: `${txData.description}${suffix}`,
        originalDescription: txData.description,
        amount,
        category: txData.category || 'Other',
        date: txDate.toISOString(),
        type: 'DEBIT',
        status: 'POSTED',
        accountId: 'manual', // Special account ID for manual entries
        isManual: true,
        isRecurring,
        isContinuous,
        parentId: isRecurring ? parentId : null,
        merchant: { name: 'Manual' }
      };

      await saveStoredManualTransaction(newTx);
      newTxs.push(newTx);
    }

    set(state => ({
      transactions: [...state.transactions, ...newTxs]
    }));
  },

  deleteManualTransaction: async (id) => {
    const { transactions } = get();
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      if (tx.parentId) {
        // Delete all transactions sharing this parentId
        const siblingIds = transactions.filter(t => t.parentId === tx.parentId).map(t => t.id);
        for (const sid of siblingIds) {
          await deleteStoredManualTransaction(sid);
        }
        set(state => ({
          transactions: state.transactions.filter(t => t.parentId !== tx.parentId)
        }));
      } else {
        await deleteStoredManualTransaction(id);
        set(state => ({
          transactions: state.transactions.filter(t => t.id !== id)
        }));
      }
    }
  },

  getFilteredTransactions: () => {
    const { transactions, filters } = get();
    return transactions.filter(t => {
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesName = t.description?.toLowerCase().includes(query);
        const matchesMerchant = t.merchant?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesMerchant) return false;
      }
      if (filters.category !== 'all' && t.category !== filters.category) {
        return false;
      }
      if (filters.accountId !== 'all' && t.accountId !== filters.accountId) {
        return false;
      }
      if (filters.type !== 'all') {
        if (filters.type === 'debit' && t.amount > 0) return false;
        if (filters.type === 'credit' && t.amount < 0) return false;
      }
      return true;
    });
  }
}));
