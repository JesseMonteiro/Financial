import { create } from 'zustand';
import { fetchTransactions } from '../services/api';
import {
  getCurrentUserId,
  getStoredManualTransactions,
  saveStoredManualTransaction,
  saveStoredManualTransactions,
  deleteStoredManualTransactions,
} from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';
import { splitManualTotal } from '../utils/manualAccounts';

function addPending(pending, ids) {
  const next = { ...pending };
  for (const id of ids) {
    if (id != null) next[id] = true;
  }
  return next;
}

function removePending(pending, ids) {
  const next = { ...pending };
  for (const id of ids) {
    delete next[id];
  }
  return next;
}

function buildManualTx(txData, { id, txDate, parentId, index, occurrences, userId }) {
  const isRecurring = txData.isRecurring;
  const isContinuous = isRecurring && txData.isContinuous;
  const amount = -Math.abs(parseFloat(txData.amount));
  let suffix = '';
  if (isRecurring) {
    suffix = isContinuous ? ' (Recorrente)' : ` (${index + 1}/${occurrences})`;
  }
  return {
    id,
    description: `${txData.description}${suffix}`,
    originalDescription: txData.description,
    amount,
    category: txData.category || 'Other',
    date: txDate.toISOString(),
    type: 'DEBIT',
    status: 'POSTED',
    accountId: txData.accountId || 'manual',
    isManual: true,
    isRecurring,
    isContinuous,
    parentId: isRecurring ? parentId : null,
    isPaid: false,
    paidAt: null,
    merchant: { name: 'Manual' },
    userId,
  };
}

export const useTransactionStore = create((set, get) => ({
  transactions: [],
  loading: false,
  error: null,
  lastUpdated: null,
  pending: {},
  filters: {
    search: '',
    category: 'all',
    accountId: 'all',
    type: 'all',
    dateRange: '30d'
  },

  isPending: (id) => Boolean(get().pending[id]),

  setFilters: (newFilters) => {
    set(state => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  /**
   * @param {{ force?: boolean }} [opts]
   */
  loadTransactions: async ({ force = false } = {}) => {
    const { transactions, lastUpdated } = get();
    const hasPluggy = transactions.some((t) => !t.isManual);
    if (
      !force &&
      hasPluggy &&
      isFreshTimestamp(lastUpdated, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = transactions.length > 0;
    if (!silent) set({ loading: true, error: null });
    else set({ error: null });

    try {
      const [apiRes, manualTxs] = await Promise.all([
        fetchTransactions({}, { force }),
        getStoredManualTransactions()
      ]);
      const apiList = apiRes.results || apiRes || [];

      set({
        transactions: [...apiList, ...manualTxs],
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addManualTransaction: async (txData) => {
    const isRecurring = txData.isRecurring;
    const isContinuous = isRecurring && txData.isContinuous;
    const occurrences = isContinuous ? 24 : (isRecurring ? parseInt(txData.occurrences, 10) || 12 : 1);
    const baseDate = new Date(txData.date || new Date());
    const parentId = crypto.randomUUID();
    const userId = await getCurrentUserId();

    const amounts = splitManualTotal(txData.amount, {
      isRecurring,
      isContinuous,
      occurrences,
    });
    const newTxs = [];
    for (let i = 0; i < occurrences; i++) {
      const txDate = new Date(baseDate);
      if (isRecurring) {
        if (txData.frequency === 'weekly') {
          txDate.setDate(baseDate.getDate() + i * 7);
        } else if (txData.frequency === 'yearly') {
          txDate.setFullYear(baseDate.getFullYear() + i);
        } else {
          txDate.setMonth(baseDate.getMonth() + i);
        }
      }
      newTxs.push(buildManualTx({ ...txData, amount: amounts[i] }, {
        id: crypto.randomUUID(),
        txDate,
        parentId,
        index: i,
        occurrences,
        userId,
      }));
    }

    const ids = newTxs.map((t) => t.id);
    const snapshot = get().transactions;
    set((state) => ({
      transactions: [...state.transactions, ...newTxs],
      pending: addPending(state.pending, ids),
    }));

    try {
      await saveStoredManualTransactions(newTxs);
    } catch (err) {
      set({ transactions: snapshot });
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, ids) }));
    }
  },

  deleteManualTransaction: async (id) => {
    const { transactions } = get();
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const siblingIds = tx.parentId
      ? transactions.filter(t => t.parentId === tx.parentId).map(t => t.id)
      : [id];
    const snapshot = transactions;

    set((state) => ({
      transactions: tx.parentId
        ? state.transactions.filter(t => t.parentId !== tx.parentId)
        : state.transactions.filter(t => t.id !== id),
      pending: addPending(state.pending, siblingIds),
    }));

    try {
      await deleteStoredManualTransactions(siblingIds);
    } catch (err) {
      set({ transactions: snapshot });
      console.error(err);
    } finally {
      set((state) => ({ pending: removePending(state.pending, siblingIds) }));
    }
  },

  /** Mark a single manual installment/occurrence as paid (tracking only). */
  setManualPaid: async (id, isPaid) => {
    const { transactions, pending } = get();
    if (pending[id]) return;
    const tx = transactions.find((t) => t.id === id && t.isManual);
    if (!tx) return;

    const updated = {
      ...tx,
      isPaid: Boolean(isPaid),
      paidAt: isPaid ? new Date().toISOString() : null,
    };
    const snapshot = transactions;
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? updated : t)),
      pending: addPending(state.pending, [id]),
    }));

    try {
      await saveStoredManualTransaction(updated);
    } catch (err) {
      set({ transactions: snapshot });
      console.error(err);
    } finally {
      set((state) => ({ pending: removePending(state.pending, [id]) }));
    }
  },

  /**
   * Update manual expense amount.
   * @param {string} id - installment/transaction id
   * @param {number} amount - absolute value (stored as negative debit)
   * @param {{ scope?: 'one' | 'series' }} [opts] - `series` updates all parcels sharing parentId
   */
  updateManualAmount: async (id, amount, { scope = 'one' } = {}) => {
    const { transactions } = get();
    const tx = transactions.find((t) => t.id === id && t.isManual);
    if (!tx) return;

    const nextAmount = -Math.abs(parseFloat(amount) || 0);
    const targets =
      scope === 'series' && tx.parentId
        ? transactions.filter((t) => t.isManual && t.parentId === tx.parentId)
        : [tx];

    const updatedList = targets.map((t) => ({ ...t, amount: nextAmount }));
    const ids = updatedList.map((t) => t.id);
    const byId = new Map(updatedList.map((t) => [t.id, t]));
    const snapshot = transactions;

    set((state) => ({
      transactions: state.transactions.map((t) => byId.get(t.id) || t),
      pending: addPending(state.pending, ids),
    }));

    try {
      await saveStoredManualTransactions(updatedList);
    } catch (err) {
      set({ transactions: snapshot });
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, ids) }));
    }
  },

  /**
   * Full update of a manual expense (or series): name, category, amount, date, recurrence.
   * Rebuilds the series when needed and restores paid flags by calendar day when dates match.
   * @param {string} id - any installment id in the group (or the single expense id)
   * @param {{
   *   description: string,
   *   amount: number,  // valor total; parcelada (>1) é dividido entre as ocorrências
   *   category?: string,
   *   date: Date|string,
   *   isRecurring?: boolean,
   *   isContinuous?: boolean,
   *   frequency?: string,
   *   occurrences?: number|string,
   * }} txData
   */
  updateManualExpense: async (id, txData) => {
    const { transactions } = get();
    const tx = transactions.find((t) => t.id === id && t.isManual);
    if (!tx) return;

    const siblings = tx.parentId
      ? transactions.filter((t) => t.isManual && t.parentId === tx.parentId)
      : [tx];
    const oldIds = siblings.map((s) => s.id);
    const snapshot = transactions;
    const userId = tx.userId || await getCurrentUserId();

    const paidByDay = {};
    for (const s of siblings) {
      const day = String(s.date || '').slice(0, 10);
      if (s.isPaid && day) {
        paidByDay[day] = { isPaid: true, paidAt: s.paidAt || null };
      }
    }

    const isRecurring = Boolean(txData.isRecurring);
    const isContinuous = isRecurring && Boolean(txData.isContinuous);
    const occurrences = isContinuous
      ? 24
      : isRecurring
        ? parseInt(txData.occurrences, 10) || 12
        : 1;
    const baseDate = new Date(txData.date || new Date());
    const parentId = crypto.randomUUID();
    const amounts = splitManualTotal(txData.amount, {
      isRecurring,
      isContinuous,
      occurrences,
    });
    const description = String(txData.description || '').trim();
    const category = txData.category || 'Other';
    const frequency = txData.frequency || 'monthly';

    const newTxs = [];
    for (let i = 0; i < occurrences; i++) {
      const txDate = new Date(baseDate);
      if (isRecurring) {
        if (frequency === 'weekly') {
          txDate.setDate(baseDate.getDate() + i * 7);
        } else if (frequency === 'yearly') {
          txDate.setFullYear(baseDate.getFullYear() + i);
        } else {
          txDate.setMonth(baseDate.getMonth() + i);
        }
      }

      const day = txDate.toISOString().slice(0, 10);
      const paid = paidByDay[day];
      let suffix = '';
      if (isRecurring) {
        suffix = isContinuous ? ' (Recorrente)' : ` (${i + 1}/${occurrences})`;
      }

      newTxs.push({
        id: crypto.randomUUID(),
        description: `${description}${suffix}`,
        originalDescription: description,
        amount: -Math.abs(amounts[i] || 0),
        category,
        date: txDate.toISOString(),
        type: 'DEBIT',
        status: 'POSTED',
        accountId: txData.accountId || tx.accountId || 'manual',
        isManual: true,
        isRecurring,
        isContinuous,
        parentId: isRecurring ? parentId : null,
        isPaid: Boolean(paid?.isPaid),
        paidAt: paid?.isPaid ? paid.paidAt : null,
        merchant: { name: 'Manual' },
        userId,
      });
    }

    const removeIds = new Set(oldIds);
    const removeParentId = tx.parentId || null;
    const pendingIds = [...oldIds, ...newTxs.map((t) => t.id)];

    set((state) => ({
      transactions: [
        ...state.transactions.filter((t) => {
          if (removeParentId) return t.parentId !== removeParentId;
          return !removeIds.has(t.id);
        }),
        ...newTxs,
      ],
      pending: addPending(state.pending, pendingIds),
    }));

    try {
      await deleteStoredManualTransactions(oldIds);
      await saveStoredManualTransactions(newTxs);
    } catch (err) {
      set({ transactions: snapshot });
      try {
        await saveStoredManualTransactions(siblings);
      } catch (_) { /* restore best-effort */ }
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, pendingIds) }));
    }
  },

  getFilteredTransactions: () => {
    const { transactions, filters } = get();
    return transactions.filter(t => {
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesName = t.description?.toLowerCase().includes(query);
        const matchesMerchant = t.merchant?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesMerchant) return false;
      }
      if (filters.category !== 'all' && t.category !== filters.category) {
        return false;
      }
      if (filters.accountId !== 'all' && t.accountId !== filters.accountId) {
        return false;
      }
      if (filters.type !== 'all') {
        if (filters.type === 'debit' && t.amount > 0) return false;
        if (filters.type === 'credit' && t.amount < 0) return false;
      }
      return true;
    });
  },

  /**
   * Replace non-recurring manual purchases on an account for a bill cycle.
   * Used after PDF import. Recurring series are left untouched.
   */
  replaceManualPurchasesForAccount: async (accountId, newTxs, { dueDate, closingDate } = {}) => {
    if (!accountId) return;
    const { transactions } = get();
    const due = dueDate ? String(dueDate).slice(0, 10) : null;
    const close = closingDate ? String(closingDate).slice(0, 10) : null;
    const dueYm = due ? due.slice(0, 7) : null;
    const prevYm = dueYm
      ? (() => {
          const [y, m] = dueYm.split('-').map(Number);
          return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
        })()
      : null;

    const toRemove = transactions.filter((t) => {
      if (!t.isManual || t.accountId !== accountId) return false;
      if (t.isRecurring || t.isContinuous) return false;
      const d = String(t.date || '').slice(0, 10);
      const fromPdf = t.merchant?.name === 'Fatura PDF';
      if (close && due) return d >= close && d <= due;
      if (dueYm) return d.startsWith(dueYm) || (prevYm && d.startsWith(prevYm));
      // Sem janela de fatura: só substitui lançamentos já vindos de PDF.
      return fromPdf;
    });

    const incoming = (newTxs || []).map((t) => ({
      ...t,
      accountId,
      isManual: true,
    }));
    const removeIds = toRemove.map((t) => t.id);
    const removeSet = new Set(removeIds);
    const snapshot = transactions;
    const pendingIds = [...removeIds, ...incoming.map((t) => t.id)];

    set((state) => ({
      transactions: [
        ...state.transactions.filter((t) => !removeSet.has(t.id)),
        ...incoming,
      ],
      pending: addPending(state.pending, pendingIds),
    }));

    try {
      if (removeIds.length) await deleteStoredManualTransactions(removeIds);
      if (incoming.length) await saveStoredManualTransactions(incoming);
    } catch (err) {
      set({ transactions: snapshot });
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, pendingIds) }));
    }
  },

  /** Drop in-memory manuals linked to deleted local accounts. */
  dropManualsForAccounts: (accountIds = []) => {
    const ids = new Set((accountIds || []).filter(Boolean));
    if (!ids.size) return;
    set((state) => ({
      transactions: state.transactions.filter(
        (t) => !(t.isManual && ids.has(t.accountId))
      ),
    }));
  },
}));
