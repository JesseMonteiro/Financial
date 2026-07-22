import { create } from 'zustand';
import { getStoredGoals, saveStoredGoal, deleteStoredGoal } from '../services/storage';

export const useGoalStore = create((set, get) => ({
  goals: [],
  loading: false,

  loadGoals: async () => {
    set({ loading: true });
    try {
      const data = await getStoredGoals();
      set({ goals: data || [], loading: false });
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
