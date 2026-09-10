import { create } from 'zustand';
import { getStoredBudgets, saveStoredBudget, deleteStoredBudget } from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';

export const useBudgetStore = create((set, get) => ({
  budgets: [],
  loading: false,
  lastUpdated: null,
  pending: {},

  isPending: (category) => Boolean(get().pending[category]),

  loadBudgets: async ({ force = false } = {}) => {
    const { budgets, lastUpdated } = get();
    if (
      !force &&
      budgets.length > 0 &&
      isFreshTimestamp(lastUpdated, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = budgets.length > 0;
    if (!silent) set({ loading: true });

    try {
      const data = await getStoredBudgets();
      set({ budgets: data || [], loading: false, lastUpdated: Date.now() });
    } catch (e) {
      set({ budgets: [], loading: false });
    }
  },

  updateBudget: async (category, limit) => {
    const { budgets, pending } = get();
    if (pending[category]) return;

    const existing = budgets.find(b => b.category === category);
    const updated = { category, limit: parseFloat(limit) };
    const snapshot = budgets;
    const newBudgets = existing
      ? budgets.map(b => b.category === category ? updated : b)
      : [...budgets, updated];

    set((state) => ({
      budgets: newBudgets,
      pending: { ...state.pending, [category]: true },
    }));

    try {
      await saveStoredBudget(updated);
    } catch (err) {
      set({ budgets: snapshot });
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[category];
        return { pending: next };
      });
    }
  },

  deleteBudget: async (category) => {
    const { budgets, pending } = get();
    if (pending[category]) return;
    const snapshot = budgets;

    set((state) => ({
      budgets: state.budgets.filter(b => b.category !== category),
      pending: { ...state.pending, [category]: true },
    }));

    try {
      await deleteStoredBudget(category);
    } catch (err) {
      set({ budgets: snapshot });
      console.error(err);
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[category];
        return { pending: next };
      });
    }
  }
}));
