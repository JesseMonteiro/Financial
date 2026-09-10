import { create } from 'zustand';
import { getStoredGoals, saveStoredGoal, deleteStoredGoal } from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';

export const useGoalStore = create((set, get) => ({
  goals: [],
  loading: false,
  lastUpdated: null,
  pending: {},

  isPending: (id) => Boolean(get().pending[id]),

  loadGoals: async ({ force = false } = {}) => {
    const { goals, lastUpdated } = get();
    if (
      !force &&
      goals.length > 0 &&
      isFreshTimestamp(lastUpdated, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = goals.length > 0;
    if (!silent) set({ loading: true });

    try {
      const data = await getStoredGoals();
      set({ goals: data || [], loading: false, lastUpdated: Date.now() });
    } catch (e) {
      set({ goals: [], loading: false });
    }
  },

  addGoal: async (newGoal) => {
    const goal = { id: `g_${Date.now()}`, ...newGoal, currentAmount: newGoal.currentAmount || 0 };
    const snapshot = get().goals;
    set((state) => ({
      goals: [...state.goals, goal],
      pending: { ...state.pending, [goal.id]: true },
    }));
    try {
      await saveStoredGoal(goal);
    } catch (err) {
      set({ goals: snapshot });
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[goal.id];
        return { pending: next };
      });
    }
  },

  removeGoal: async (id) => {
    if (get().pending[id]) return;
    const snapshot = get().goals;
    set((state) => ({
      goals: state.goals.filter(g => g.id !== id),
      pending: { ...state.pending, [id]: true },
    }));
    try {
      await deleteStoredGoal(id);
    } catch (err) {
      set({ goals: snapshot });
      console.error(err);
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[id];
        return { pending: next };
      });
    }
  }
}));
