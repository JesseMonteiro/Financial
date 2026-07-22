import { create } from 'zustand';
import { fetchInvestments } from '../services/api';

export const useInvestmentStore = create((set, get) => ({
  investments: [],
  loading: false,
  error: null,

  loadInvestments: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchInvestments();
      set({ investments: data || [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  getTotalInvested: () => {
    const { investments } = get();
    return investments.reduce((acc, i) => acc + (i.balance || i.amount || 0), 0);
  }
}));
