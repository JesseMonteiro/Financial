import { create } from 'zustand';
import {
  getStoredPurchaseCategories,
  saveStoredPurchaseCategory,
  deleteStoredPurchaseCategory,
} from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';
import { DEFAULT_PURCHASE_CATEGORIES, slugifyCategoryKey, sortPurchaseCategories } from '../utils/categories';

export const useCategoryStore = create((set, get) => ({
  categories: [],
  loading: false,
  lastUpdated: null,
  pending: {},

  isPending: (id) => Boolean(get().pending[id]),

  loadCategories: async ({ force = false } = {}) => {
    const { categories, lastUpdated } = get();
    if (
      !force &&
      categories.length > 0 &&
      isFreshTimestamp(lastUpdated, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = categories.length > 0;
    if (!silent) set({ loading: true });

    try {
      const data = await getStoredPurchaseCategories();
      set({
        categories: sortPurchaseCategories(data || []),
        loading: false,
        lastUpdated: Date.now(),
      });
    } catch (e) {
      set({
        categories: get().categories.length ? get().categories : DEFAULT_PURCHASE_CATEGORIES,
        loading: false,
      });
    }
  },

  saveCategory: async (input) => {
    const existing = get().categories;
    const isEdit = Boolean(input.id && existing.some((c) => c.id === input.id));
    const label = String(input.label || '').trim();
    if (!label) throw new Error('Informe o nome da categoria.');

    const category = isEdit
      ? {
          ...existing.find((c) => c.id === input.id),
          label,
          color: input.color || existing.find((c) => c.id === input.id)?.color,
          icon: input.icon || existing.find((c) => c.id === input.id)?.icon,
        }
      : {
          id: crypto.randomUUID(),
          key: slugifyCategoryKey(label, existing.map((c) => c.key)),
          label,
          color: input.color || '#6366f1',
          icon: input.icon || 'tag',
          sortOrder: existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1) + 1,
        };

    const snapshot = existing;
    set((state) => ({
      categories: sortPurchaseCategories(
        isEdit
          ? state.categories.map((c) => (c.id === category.id ? category : c))
          : [...state.categories, category]
      ),
      pending: { ...state.pending, [category.id]: true },
    }));
    try {
      await saveStoredPurchaseCategory(category);
    } catch (err) {
      set({ categories: snapshot });
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[category.id];
        return { pending: next };
      });
    }
  },

  removeCategory: async (id) => {
    if (get().pending[id]) return;
    const snapshot = get().categories;
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
      pending: { ...state.pending, [id]: true },
    }));
    try {
      await deleteStoredPurchaseCategory(id);
    } catch (err) {
      set({ categories: snapshot });
      console.error(err);
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[id];
        return { pending: next };
      });
    }
  },
}));
