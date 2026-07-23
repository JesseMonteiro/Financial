import { create } from 'zustand';
import { getStoredGoals, saveStoredGoal, deleteStoredGoal } from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';

export const useGoalStore = create((set, get) => ({
  goals: [],
  loading: false,
  lastUpdated: null,

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
    await saveStoredGoal(goal);
    set(state => ({ goals: [...state.goals, goal] }));
  },

  removeGoal: async (id) => {
    await deleteStoredGoal(id);
    set(state => ({ goals: state.goals.filter(g => g.id !== id) }));
  }
}));
