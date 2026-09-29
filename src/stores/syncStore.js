import { create } from 'zustand';
import { fetchSyncStatus, triggerSyncRefresh } from '../services/api.js';
import { cacheFreshness } from '../utils/freshness.js';

export const useSyncStore = create((set, get) => ({
  items: [],
  globalLastSyncedAt: null,
  freshness: cacheFreshness(null),
  loading: false,
  refreshing: false,
  error: null,

  loadSyncStatus: async ({ force = false } = {}) => {
    // If not forced and already loading, return
    if (get().loading) return;

    set({ loading: true, error: null });
    try {
      const data = await fetchSyncStatus({ force });
      const lastSynced = data.globalLastSyncedAt || null;
      set({
        items: data.items || [],
        globalLastSyncedAt: lastSynced,
        freshness: cacheFreshness(lastSynced),
        loading: false,
      });
    } catch (err) {
      console.warn('[useSyncStore] Falha ao carregar status:', err);
      set({ error: err.message, loading: false });
    }
  },

  refreshSync: async (itemId) => {
    set({ refreshing: true, error: null });
    try {
      await triggerSyncRefresh(itemId);
      await get().loadSyncStatus({ force: true });
      set({ refreshing: false });
    } catch (err) {
      console.error('[useSyncStore] Falha no refresh:', err);
      set({ error: err.message, refreshing: false });
      throw err;
    }
  },

  getFreshness: () => {
    return cacheFreshness(get().globalLastSyncedAt);
  },
}));
