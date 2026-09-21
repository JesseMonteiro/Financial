import { create } from 'zustand';
import {
  getStoredPurchaseCategories,
  saveStoredPurchaseCategory,
  deleteStoredPurchaseCategory,
} from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';
import {
  PLUGGY_BASE_CATEGORIES,
  DEFAULT_PURCHASE_CATEGORIES,
  slugifyCategoryKey,
  sortPurchaseCategories,
} from '../utils/categories';

/**
 * Merges Pluggy Level 1 base categories with stored user categories.
 * Base categories are always present with `isBase: true`.
 * Custom categories created by the user have `isBase: false`.
 */
function mergeBaseAndStoredCategories(stored = []) {
  const storedList = Array.isArray(stored) ? stored : [];
  const storedByKey = new Map();
  storedList.forEach((c) => {
    if (c?.key) storedByKey.set(c.key.toLowerCase(), c);
  });

  const merged = PLUGGY_BASE_CATEGORIES.map((baseCat) => {
    const custom = storedByKey.get(baseCat.key.toLowerCase());
    if (custom) {
      storedByKey.delete(baseCat.key.toLowerCase());
      return {
        ...baseCat,
        id: custom.id || `base-${baseCat.key}`,
        color: custom.color || baseCat.color,
        icon: custom.icon || baseCat.icon,
        sortOrder: custom.sortOrder ?? baseCat.sortOrder,
        isBase: true,
      };
    }
    return {
      ...baseCat,
      id: `base-${baseCat.key}`,
      isBase: true,
    };
  });

  // Remaining stored categories are custom categories created by the user!
  for (const [, customCat] of storedByKey.entries()) {
    merged.push({
      ...customCat,
      isBase: false,
    });
  }

  return sortPurchaseCategories(merged);
}

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
      const merged = mergeBaseAndStoredCategories(data || []);
      set({
        categories: merged,
        loading: false,
        lastUpdated: Date.now(),
      });
    } catch (_err) {
      set({
        categories: get().categories.length
          ? get().categories
          : mergeBaseAndStoredCategories(DEFAULT_PURCHASE_CATEGORIES),
        loading: false,
      });
    }
  },

  saveCategory: async (input) => {
    const existing = get().categories;
    const isEdit = Boolean(input.id && existing.some((c) => c.id === input.id));
    const target = isEdit ? existing.find((c) => c.id === input.id) : null;
    const label = String(input.label || '').trim();
    if (!label) throw new Error('Informe o nome da categoria.');

    let category;
    if (isEdit && target) {
      const isBaseItem = Boolean(target.isBase);
      category = {
        ...target,
        id: String(target.id).startsWith('base-') ? crypto.randomUUID() : target.id,
        label,
        color: input.color || target.color,
        icon: input.icon || target.icon,
        isBase: isBaseItem,
      };
    } else {
      category = {
        id: crypto.randomUUID(),
        key: slugifyCategoryKey(label, existing.map((c) => c.key)),
        label,
        color: input.color || '#6366f1',
        icon: input.icon || 'tag',
        sortOrder: existing.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1) + 1,
        isBase: false,
      };
    }

    const snapshot = existing;
    set((state) => ({
      categories: sortPurchaseCategories(
        isEdit
          ? state.categories.map((c) => (c.id === input.id ? category : c))
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
        delete next[input.id];
        return { pending: next };
      });
    }
  },

  removeCategory: async (id) => {
    const target = get().categories.find((c) => c.id === id);
    if (!target || target.isBase || get().pending[id]) return;

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
