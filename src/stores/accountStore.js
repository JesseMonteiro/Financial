import { create } from 'zustand';
import { fetchAccounts, fetchLoans, fetchItems, fetchConnectors } from '../services/api';
import { calculateNetWorth } from '../utils/calculations';
import {
  getCustomAccountNames,
  saveCustomAccountNames,
  getCustomAccountIcons,
  saveCustomAccountIcons,
  uploadAccountIconFile,
  deleteAccountIconFile,
  getStoredManualAccounts,
  saveStoredManualAccounts,
  deleteStoredManualAccounts,
  deleteStoredManualTransactionsForAccounts,
} from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';
import { hydrateManualAccount } from '../utils/manualAccounts';
import { decorateAccountsWithIcons, suggestIconKey } from '../utils/accountIcons';
import { useTransactionStore } from './transactionStore';

function mergeAccounts(pluggyList, customNames, manuals) {
  const pluggy = (pluggyList || []).map((acc) => ({
    ...acc,
    isManual: false,
    originalName: acc.originalName || acc.name,
    name: customNames[acc.id] || acc.name,
  }));
  const manualHydrated = (manuals || []).map((row) => hydrateManualAccount(row));
  const seen = new Set(pluggy.map((a) => a.id));
  const extra = manualHydrated.filter((a) => a.id && !seen.has(a.id));
  return [...pluggy, ...extra];
}

function itemsByIdFromList(items) {
  return Object.fromEntries((items || []).filter((i) => i?.id).map((i) => [i.id, i]));
}

function withIcons(list, state) {
  return decorateAccountsWithIcons(list, {
    customIcons: state.customAccountIcons || {},
    itemsById: state.itemsById || {},
    connectors: state.connectors || [],
  });
}

export const useAccountStore = create((set, get) => ({
  accounts: [],
  loans: [],
  loading: false,
  error: null,
  lastUpdated: null,
  customAccountNames: {},
  customAccountIcons: {},
  itemsById: {},
  connectors: [],
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
      const [accountsData, loansData, customNames, customIcons, items, connectors] = await Promise.all([
        fetchAccounts(undefined, { force }),
        fetchLoans(undefined, { force }),
        getCustomAccountNames(),
        getCustomAccountIcons(),
        fetchItems({ force }).catch(() => []),
        fetchConnectors({ force }).catch(() => []),
      ]);

      let manuals = [];
      let manualsError = null;
      try {
        manuals = await getStoredManualAccounts();
      } catch (err) {
        manualsError = err;
        manuals = get().accounts.filter((acc) => acc.isManual);
      }

      const itemsById = itemsByIdFromList(items);
      const iconCtx = {
        customAccountIcons: customIcons || {},
        itemsById,
        connectors: connectors || [],
      };
      const merged = mergeAccounts(accountsData, customNames || {}, manuals);

      set({
        accounts: withIcons(merged, iconCtx),
        loans: loansData || [],
        customAccountNames: customNames || {},
        customAccountIcons: customIcons || {},
        itemsById,
        connectors: connectors || [],
        loading: false,
        lastUpdated: new Date(),
        error: manualsError
          ? (manualsError.message || 'Não foi possível carregar contas manuais.')
          : null,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  renameAccount: async (accountId, newName) => {
    const { accounts, customAccountNames, pending } = get();
    if (pending[accountId]) return;

    const target = accounts.find((acc) => acc.id === accountId);
    if (!target) return;

    const trimmed = newName && newName.trim() ? newName.trim() : '';
    const snapshot = { accounts, customAccountNames };

    if (target.isManual) {
      const nextName = trimmed || target.originalName || target.name;
      const updatedAccounts = accounts.map((acc) => {
        if (acc.id !== accountId) return acc;
        return { ...acc, name: nextName, originalName: nextName };
      });
      set((state) => ({
        accounts: withIcons(updatedAccounts, state),
        pending: { ...state.pending, [accountId]: true },
      }));
      try {
        await saveStoredManualAccounts([{ ...target, name: nextName }]);
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
      return;
    }

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
      accounts: withIcons(updatedAccounts, state),
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

  /**
   * Persist a catalog key or uploaded image for an account/card.
   * @param {string} accountId
   * @param {{ key?: string|null, file?: File }} payload
   */
  setAccountIcon: async (accountId, payload = {}) => {
    const { accounts, customAccountIcons, pending } = get();
    if (pending[accountId]) return;
    const target = accounts.find((acc) => acc.id === accountId);
    if (!target) return;

    const snapshot = { accounts, customAccountIcons };
    const nextIcons = { ...customAccountIcons };
    const prev = nextIcons[accountId] || {};

    set((state) => ({
      pending: { ...state.pending, [accountId]: true },
    }));

    try {
      if (payload.file) {
        const uploaded = await uploadAccountIconFile(accountId, payload.file);
        if (prev.path && prev.path !== uploaded.path) {
          await deleteAccountIconFile(prev.path);
        }
        nextIcons[accountId] = { path: uploaded.path, url: uploaded.url };
      } else if (payload.key) {
        if (prev.path) await deleteAccountIconFile(prev.path);
        nextIcons[accountId] = { key: payload.key };
      } else {
        if (prev.path) await deleteAccountIconFile(prev.path);
        delete nextIcons[accountId];
      }

      const signed = await saveCustomAccountIcons(nextIcons);
      set((state) => ({
        customAccountIcons: signed,
        accounts: withIcons(state.accounts, { ...state, customAccountIcons: signed }),
      }));
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

  /**
   * Create one or two local accounts.
   * @param {{
   *   kind: 'account' | 'card' | 'both',
   *   institutionName: string,
   *   accountName?: string,
   *   accountBalance?: number,
   *   cardName?: string,
   *   cardNumber?: string,
   *   billAmount?: number,
   *   billDueDay?: number,
   *   creditLimit?: number,
   * }} payload
   */
  addManualAccounts: async (payload) => {
    const kind = payload?.kind || 'account';
    const institutionName = String(payload.institutionName || '').trim();
    const rows = [];
    const pairId = kind === 'both' ? crypto.randomUUID() : null;

    if (kind === 'account' || kind === 'both') {
      rows.push({
        id: crypto.randomUUID(),
        type: 'BANK',
        name: String(payload.accountName || institutionName || 'Conta manual').trim(),
        institutionName,
        number: payload.accountNumber || '',
        balance: Number(payload.accountBalance) || 0,
        pairId,
      });
    }
    if (kind === 'card' || kind === 'both') {
      rows.push({
        id: crypto.randomUUID(),
        type: 'CREDIT',
        name: String(payload.cardName || `${institutionName} Cartão`.trim() || 'Cartão manual').trim(),
        institutionName,
        number: String(payload.cardNumber || '').replace(/\D/g, '').slice(-4),
        billAmount: Number(payload.billAmount) || 0,
        billDueDay: payload.billDueDay ? Number(payload.billDueDay) : null,
        creditLimit: payload.creditLimit ? Number(payload.creditLimit) : 0,
        pairId,
      });
    }

    if (!rows.length) return [];

    const hydrated = rows.map((r) => hydrateManualAccount(r));
    const snapshot = {
      accounts: get().accounts,
      customAccountIcons: get().customAccountIcons,
    };
    const nextIcons = { ...get().customAccountIcons };
    for (const row of hydrated) {
      const key = suggestIconKey(row);
      if (key) nextIcons[row.id] = { key };
    }

    set((state) => ({
      customAccountIcons: nextIcons,
      accounts: withIcons([...state.accounts, ...hydrated], { ...state, customAccountIcons: nextIcons }),
      pending: { ...state.pending, ...Object.fromEntries(rows.map((r) => [r.id, true])) },
    }));

    try {
      await saveStoredManualAccounts(rows);
      const assigned = hydrated.some((row) => nextIcons[row.id]?.key);
      if (assigned) {
        const signed = await saveCustomAccountIcons(nextIcons);
        set((state) => ({
          customAccountIcons: signed,
          accounts: withIcons(state.accounts, { ...state, customAccountIcons: signed }),
        }));
      }
      return get().accounts.filter((acc) => rows.some((r) => r.id === acc.id));
    } catch (err) {
      set({ accounts: snapshot.accounts, customAccountIcons: snapshot.customAccountIcons });
      throw err;
    } finally {
      set((state) => {
        const pending = { ...state.pending };
        for (const r of rows) delete pending[r.id];
        return { pending };
      });
    }
  },

  updateManualAccount: async (accountId, patch) => {
    const { accounts, pending } = get();
    if (pending[accountId]) return;
    const target = accounts.find((acc) => acc.id === accountId && acc.isManual);
    if (!target) return;

    const next = { ...target, ...patch };
    if (patch.balance != null && target.type === 'BANK') {
      next.balance = Number(patch.balance) || 0;
    }
    if (patch.billAmount != null && target.type === 'CREDIT') {
      next.billAmount = Number(patch.billAmount) || 0;
      next.balance = next.billAmount;
      if (next.creditData) {
        const limit = Number(next.creditData.creditLimit) || 0;
        next.creditData = {
          ...next.creditData,
          availableCreditLimit: limit > 0 ? Math.max(0, limit - next.billAmount) : 0,
        };
      }
    }
    if (patch.billDueDay != null) next.billDueDay = Number(patch.billDueDay) || null;
    if (patch.creditLimit != null && next.creditData) {
      const limit = Number(patch.creditLimit) || 0;
      next.creditData = {
        ...next.creditData,
        creditLimit: limit,
        availableCreditLimit: limit > 0 ? Math.max(0, limit - (Number(next.billAmount) || 0)) : 0,
      };
    }
    if (patch.name) {
      next.name = patch.name;
      next.originalName = patch.name;
    }

    const snapshot = accounts;
    set((state) => ({
      accounts: withIcons(state.accounts.map((acc) => (acc.id === accountId ? next : acc)), state),
      pending: { ...state.pending, [accountId]: true },
    }));

    try {
      await saveStoredManualAccounts([{
        ...next,
        institutionName: next.bankData?.institutionName || next.creditData?.institutionName,
        creditLimit: next.creditData?.creditLimit,
      }]);
    } catch (err) {
      set({ accounts: snapshot });
      throw err;
    } finally {
      set((state) => {
        const pendingNext = { ...state.pending };
        delete pendingNext[accountId];
        return { pending: pendingNext };
      });
    }
  },

  /**
   * @param {string} accountId
   * @param {{ deletePair?: boolean }} [opts]
   */
  deleteManualAccount: async (accountId, { deletePair = false } = {}) => {
    const { accounts, pending } = get();
    if (pending[accountId]) return;
    const target = accounts.find((acc) => acc.id === accountId && acc.isManual);
    if (!target) return;

    const ids = [accountId];
    if (deletePair && target.pairId) {
      for (const acc of accounts) {
        if (acc.isManual && acc.pairId === target.pairId && acc.id !== accountId) {
          ids.push(acc.id);
        }
      }
    }

    const snapshot = { accounts, customAccountIcons: get().customAccountIcons };
    set((state) => ({
      accounts: state.accounts.filter((acc) => !ids.includes(acc.id)),
      pending: { ...state.pending, ...Object.fromEntries(ids.map((id) => [id, true])) },
    }));

    try {
      await deleteStoredManualTransactionsForAccounts(ids);
      await deleteStoredManualAccounts(ids);
      useTransactionStore.getState().dropManualsForAccounts?.(ids);
      const nextIcons = { ...get().customAccountIcons };
      let iconsChanged = false;
      for (const id of ids) {
        if (nextIcons[id]) {
          if (nextIcons[id].path) await deleteAccountIconFile(nextIcons[id].path);
          delete nextIcons[id];
          iconsChanged = true;
        }
      }
      if (iconsChanged) {
        const signed = await saveCustomAccountIcons(nextIcons);
        set({ customAccountIcons: signed });
      }
    } catch (err) {
      set({ accounts: snapshot.accounts, customAccountIcons: snapshot.customAccountIcons });
      throw err;
    } finally {
      set((state) => {
        const pendingNext = { ...state.pending };
        for (const id of ids) delete pendingNext[id];
        return { pending: pendingNext };
      });
    }
  },

  getSummary: () => {
    const { accounts, loans } = get();
    return calculateNetWorth(accounts, [], loans);
  },
}));
