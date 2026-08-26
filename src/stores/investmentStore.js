import { create } from 'zustand';
import { fetchAccounts, fetchInvestments } from '../services/api';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';
import { mergeInvestmentsWithReserved } from '../utils/reservedBalances';

export const useInvestmentStore = create((set, get) => ({
  investments: [],
  loading: false,
  error: null,
  lastUpdated: null,

  /**
   * @param {{ force?: boolean }} [opts]
   */
  loadInvestments: async ({ force = false } = {}) => {
    const { investments, lastUpdated } = get();
    if (
      !force &&
      investments.length > 0 &&
      isFreshTimestamp(lastUpdated, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = investments.length > 0;
    if (!silent) set({ loading: true, error: null });
    else set({ error: null });

    try {
      const [pluggyInvestments, accounts] = await Promise.all([
        fetchInvestments(undefined, { force }),
        fetchAccounts(undefined, { force }),
      ]);

      set({
        investments: mergeInvestmentsWithReserved(pluggyInvestments || [], accounts || []),
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  getTotalInvested: () => {
    const { investments } = get();
    return investments.reduce((acc, i) => acc + (i.balance || i.amount || 0), 0);
  },
}));
