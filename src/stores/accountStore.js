import { create } from 'zustand';
import { fetchAccounts, fetchLoans } from '../services/api';
import { calculateNetWorth } from '../utils/calculations';
import { getCustomAccountNames, saveCustomAccountNames } from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';

export const useAccountStore = create((set, get) => ({
  accounts: [],
  loans: [],
  loading: false,
  error: null,
  lastUpdated: null,
  customAccountNames: {},
  pending: {},

  /**
   * @param {{ force?: boolean }} [opts]
   */
  loadAccounts: async ({ force = false } = {}) => {
    const { accounts, lastUpdated } = get();
    if (
      !force &&
      accounts.length > 0 &&
      isFreshTimestamp(lastUpdated, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = accounts.length > 0;
    if (!silent) set({ loading: true, error: null });
    else set({ error: null });

    try {
      const [accountsData, loansData, customNames] = await Promise.all([
        fetchAccounts(undefined, { force }),
        fetchLoans(undefined, { force }),
        getCustomAccountNames(),
      ]);

      const parsedAccounts = (accountsData || []).map((acc) => ({
        ...acc,
        originalName: acc.originalName || acc.name,
        name: customNames[acc.id] || acc.name,
      }));

      set({
        accounts: parsedAccounts,
        loans: loansData || [],
        customAccountNames: customNames || {},
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  renameAccount: async (accountId, newName) => {
    const { accounts, customAccountNames, pending } = get();
    if (pending[accountId]) return;

    const trimmed = newName && newName.trim() ? newName.trim() : '';
    const snapshot = { accounts, customAccountNames };
    const nextNames = { ...customAccountNames };
    if (trimmed) nextNames[accountId] = trimmed;
    else delete nextNames[accountId];

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        name: trimmed || acc.originalName || acc.name,
      };
    });

    set((state) => ({
      accounts: updatedAccounts,
      customAccountNames: nextNames,
      pending: { ...state.pending, [accountId]: true },
    }));

    try {
      await saveCustomAccountNames(nextNames);
    } catch (err) {
      set(snapshot);
      throw err;
    } finally {
      set((state) => {
        const next = { ...state.pending };
        delete next[accountId];
        return { pending: next };
      });
    }
  },

  getSummary: () => {
    const { accounts, loans } = get();
    return calculateNetWorth(accounts, [], loans);
  },
}));
