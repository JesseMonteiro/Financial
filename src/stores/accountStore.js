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
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  renameAccount: async (accountId, newName) => {
    const { accounts } = get();

    const customNames = await getCustomAccountNames();

    if (newName && newName.trim()) {
      customNames[accountId] = newName.trim();
    } else {
      delete customNames[accountId];
    }
    await saveCustomAccountNames(customNames);

    const updatedAccounts = accounts.map((acc) => {
      if (acc.id === accountId) {
        return {
          ...acc,
          name:
            newName && newName.trim()
              ? newName.trim()
              : acc.originalName || acc.name,
        };
      }
      return acc;
    });

    set({ accounts: updatedAccounts });
  },

  getSummary: () => {
    const { accounts, loans } = get();
    return calculateNetWorth(accounts, [], loans);
  },
}));
