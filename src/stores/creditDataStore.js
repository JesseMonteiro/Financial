import { create } from 'zustand';
import { fetchTransactions, fetchBills } from '../services/api';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';

/**
 * Shared cache for per-card transactions + official bills
 * (Credit Cards, Financial Moment, Budget).
 */
export const useCreditDataStore = create((set, get) => ({
  /** @type {Record<string, any[]>} */
  transactionsByAccount: {},
  /** @type {Record<string, any[]>} */
  billsByAccount: {},
  /** @type {Record<string, number>} */
  lastUpdatedByAccount: {},
  loading: false,
  error: null,

  /**
   * Load (or reuse) card data for the given account ids.
   * @param {string[]} accountIds
   * @param {{ force?: boolean }} [opts]
   */
  loadForAccounts: async (accountIds = [], { force = false } = {}) => {
    const ids = [...new Set((accountIds || []).filter(Boolean))];
    if (!ids.length) {
      set({ loading: false });
      return;
    }

    const state = get();
    const need = ids.filter((id) => {
      if (force) return true;
      const updated = state.lastUpdatedByAccount[id];
      const hasTx = Array.isArray(state.transactionsByAccount[id]);
      const hasBills = Array.isArray(state.billsByAccount[id]);
      return !hasTx || !hasBills || !isFreshTimestamp(updated, CACHE_TTL_MS);
    });

    if (!need.length) {
      set({ loading: false });
      return;
    }

    const hasAnyCached = ids.some((id) => Boolean(state.lastUpdatedByAccount[id]));
    // Only flash loading when we have nothing useful yet
    if (!hasAnyCached) set({ loading: true, error: null });

    try {
      await Promise.all(
        need.map(async (id) => {
          const [txRes, billsRes] = await Promise.all([
            fetchTransactions({ accountId: id }, { force }),
            fetchBills(id, { force }),
          ]);
          const txs = (txRes.results || txRes || []).map((t) => ({
            ...t,
            accountId: t.accountId || id,
          }));
          const bills = (billsRes || []).map((b) => ({ ...b, accountId: id }));
          set((s) => ({
            transactionsByAccount: { ...s.transactionsByAccount, [id]: txs },
            billsByAccount: { ...s.billsByAccount, [id]: bills },
            lastUpdatedByAccount: {
              ...s.lastUpdatedByAccount,
              [id]: Date.now(),
            },
          }));
        })
      );
      set({ loading: false });
    } catch (err) {
      set({ loading: false, error: err.message || String(err) });
    }
  },

  getMerged: (accountIds = []) => {
    const { transactionsByAccount, billsByAccount } = get();
    const ids = accountIds.length
      ? accountIds
      : Object.keys(transactionsByAccount);
    const transactions = [];
    const bills = [];
    for (const id of ids) {
      transactions.push(...(transactionsByAccount[id] || []));
      bills.push(...(billsByAccount[id] || []));
    }
    return { transactions, bills };
  },

  clear: () =>
    set({
      transactionsByAccount: {},
      billsByAccount: {},
      lastUpdatedByAccount: {},
      loading: false,
      error: null,
    }),
}));
