import { create } from 'zustand';
import { getStoredBudgets, saveStoredBudget, deleteStoredBudget } from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';
import { canonicalBudgetCategory } from '../utils/categories';

export const useBudgetStore = create((set, get) => ({
  budgets: [],
  loading: false,
  lastUpdated: null,
  pending: {},

  isPending: (category) => {
    const key = canonicalBudgetCategory(category) || category;
    return Boolean(get().pending[key] || get().pending[category]);
  },

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
      const normalized = (data || []).map((b) => ({
        ...b,
        category: canonicalBudgetCategory(b.category) || b.category,
      }));
      set({ budgets: normalized, loading: false, lastUpdated: Date.now() });
    } catch (e) {
      set({ budgets: [], loading: false });
    }
  },

  updateBudget: async (category, limit, period = 'monthly') => {
    const normalizedKey = canonicalBudgetCategory(category) || category;
    const { budgets, pending } = get();
    if (pending[normalizedKey]) return;

    const existing = budgets.find(
      (b) => b.category === normalizedKey || b.category === category
    );
    const updated = {
      category: normalizedKey,
      limit: parseFloat(limit),
      period: period || existing?.period || 'monthly',
    };
    const snapshot = budgets;
    const newBudgets = existing
      ? budgets.map((b) =>
          b.category === normalizedKey || b.category === category
            ? { ...existing, ...updated }
            : b
        )
      : [...budgets, updated];

    set((state) => ({
      budgets: newBudgets,
      pending: { ...state.pending, [normalizedKey]: true },
    }));

    try {
      await saveStoredBudget(updated);
    } catch (err) {
      set({ budgets: snapshot });
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[normalizedKey];
        delete next[category];
        return { pending: next };
      });
    }
  },

  deleteBudget: async (category) => {
    const normalizedKey = canonicalBudgetCategory(category) || category;
    const { budgets, pending } = get();
    if (pending[normalizedKey] || pending[category]) return;
    const snapshot = budgets;

    set((state) => ({
      budgets: state.budgets.filter(
        (b) => b.category !== normalizedKey && b.category !== category
      ),
      pending: { ...state.pending, [normalizedKey]: true, [category]: true },
    }));

    try {
      await deleteStoredBudget(normalizedKey);
      if (normalizedKey !== category) {
        try {
          await deleteStoredBudget(category);
        } catch (_) {
          /* ignore legacy key delete */
        }
      }
    } catch (err) {
      set({ budgets: snapshot });
      console.error(err);
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[normalizedKey];
        delete next[category];
        return { pending: next };
      });
    }
  }
}));

