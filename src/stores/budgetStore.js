import { create } from 'zustand';
import { getStoredBudgets, saveStoredBudget, deleteStoredBudget } from '../services/storage';

export const useBudgetStore = create((set, get) => ({
  budgets: [],      // { category, limit } — user-defined limits from IndexedDB
  loading: false,

  loadBudgets: async () => {
    set({ loading: true });
    try {
      const data = await getStoredBudgets();
      set({ budgets: data || [], loading: false });
    } catch (e) {
      set({ budgets: [], loading: false });
    }
  },

  updateBudget: async (category, limit) => {
    const { budgets } = get();
    const existing = budgets.find(b => b.category === category);
    const updated = { category, limit: parseFloat(limit) };
    await saveStoredBudget(updated);
    const newBudgets = existing
      ? budgets.map(b => b.category === category ? updated : b)
      : [...budgets, updated];
    set({ budgets: newBudgets });
  },

  deleteBudget: async (category) => {
    const { budgets } = get();
    await deleteStoredBudget(category);
    set({ budgets: budgets.filter(b => b.category !== category) });
  }
}));
