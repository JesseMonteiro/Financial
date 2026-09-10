import { create } from 'zustand';
import {
  getStoredReceivables,
  saveStoredReceivable,
  deleteStoredReceivable,
} from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';

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

export const useReceivableStore = create((set, get) => ({
  receivables: [],
  loading: false,
  lastUpdated: null,
  pending: {},

  isPending: (id) => Boolean(get().pending[id]),

  /** Carrega todos os recebíveis do IndexedDB / Supabase */
  loadReceivables: async ({ force = false } = {}) => {
    const { receivables, lastUpdated } = get();
    if (
      !force &&
      receivables.length > 0 &&
      isFreshTimestamp(lastUpdated, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = receivables.length > 0;
    if (!silent) set({ loading: true });

    try {
      const data = await getStoredReceivables();
      set({ receivables: data || [], loading: false, lastUpdated: Date.now() });
    } catch (e) {
      console.error('[receivableStore] Erro ao carregar:', e);
      set({ receivables: [], loading: false });
    }
  },

  /** Cria um novo recebível e persiste no IndexedDB */
  addReceivable: async (data) => {
    const now = new Date().toISOString();

    const randomColor = () => {
      const palette = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
        '#f97316', '#eab308', '#22c55e', '#14b8a6',
        '#3b82f6', '#06b6d4',
      ];
      return palette[Math.floor(Math.random() * palette.length)];
    };

    const isContinuous = data.isContinuous || false;
    const installments = isContinuous ? 24 : (data.installments || 1);
    const firstDueDate = data.firstDueDate || now.slice(0, 10);
    const installmentAmount = isContinuous ? data.totalAmount : (data.totalAmount / installments);

    const installmentHistory = Array.from({ length: installments }, (_, i) => {
      const dueDate = new Date(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      return {
        installmentNumber: i + 1,
        amount: installmentAmount,
        dueDate: dueDate.toISOString().slice(0, 10),
        paidAt: null,
      };
    });

    const existing = get().receivables.find(r => r.personName.toLowerCase() === (data.personName || '').toLowerCase());
    const personColor = existing ? existing.personColor : (data.personColor || randomColor());

    const receivable = {
      id: crypto.randomUUID(),
      personName: data.personName || '',
      personColor,
      description: data.description || '',
      totalAmount: isContinuous ? (installmentAmount * 24) : (data.totalAmount || 0),
      originalTotalAmount: data.totalAmount,
      installments,
      paidInstallments: 0,
      linkedTransactionId: data.linkedTransactionId || null,
      linkedBillForecastDate: data.linkedBillForecastDate || null,
      notes: data.notes || '',
      createdAt: now,
      isContinuous,
      installmentHistory,
    };

    const snapshot = get().receivables;
    set((state) => ({
      receivables: [...state.receivables, receivable],
      pending: addPending(state.pending, [receivable.id]),
    }));

    try {
      await saveStoredReceivable(receivable);
    } catch (err) {
      set({ receivables: snapshot });
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, [receivable.id]) }));
    }
    return receivable;
  },

  /** Atualiza campo(s) de um recebível existente */
  updateReceivable: async (id, data) => {
    const { receivables } = get();
    const existing = receivables.find(r => r.id === id);
    if (!existing) return;

    let installmentHistory = existing.installmentHistory;
    let installments = existing.installments;
    let paidInstallments = existing.paidInstallments;

    if (data.totalAmount !== undefined || data.installments !== undefined || data.firstDueDate !== undefined || data.isContinuous !== undefined) {
      const isContinuous = data.isContinuous !== undefined ? data.isContinuous : (existing.isContinuous || false);
      installments = isContinuous ? 24 : (data.installments !== undefined ? data.installments : existing.installments);
      const firstDueDate = data.firstDueDate || (existing.installmentHistory[0]?.dueDate || new Date().toISOString().slice(0, 10));
      const totalAmount = data.totalAmount !== undefined ? data.totalAmount : (existing.originalTotalAmount || existing.totalAmount);
      const installmentAmount = isContinuous ? totalAmount : (totalAmount / installments);

      installmentHistory = Array.from({ length: installments }, (_, i) => {
        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        const existingInst = existing.installmentHistory?.find(inst => inst.installmentNumber === i + 1);
        return {
          installmentNumber: i + 1,
          amount: installmentAmount,
          dueDate: dueDate.toISOString().slice(0, 10),
          paidAt: existingInst ? existingInst.paidAt : null,
        };
      });
      paidInstallments = installmentHistory.filter(i => i.paidAt).length;
    }

    const {
      firstDueDate: _firstDueDate,
      ...dataWithoutFormOnly
    } = data;

    const updatedReceivable = {
      ...existing,
      ...dataWithoutFormOnly,
      totalAmount: (data.isContinuous || existing.isContinuous) ? ((data.totalAmount || existing.originalTotalAmount || existing.totalAmount) * 24) : (data.totalAmount !== undefined ? data.totalAmount : existing.totalAmount),
      originalTotalAmount: data.totalAmount !== undefined ? data.totalAmount : (existing.originalTotalAmount || existing.totalAmount),
      installments,
      paidInstallments,
      installmentHistory
    };

    const snapshot = receivables;
    set((state) => ({
      receivables: state.receivables.map(r => r.id === id ? updatedReceivable : r),
      pending: addPending(state.pending, [id]),
    }));

    try {
      await saveStoredReceivable(updatedReceivable);
    } catch (err) {
      set({ receivables: snapshot });
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, [id]) }));
    }
  },

  /** Remove um recebível do IndexedDB e da lista local */
  deleteReceivable: async (id) => {
    const snapshot = get().receivables;
    set((state) => ({
      receivables: state.receivables.filter(r => r.id !== id),
      pending: addPending(state.pending, [id]),
    }));
    try {
      await deleteStoredReceivable(id);
    } catch (err) {
      set({ receivables: snapshot });
      console.error(err);
    } finally {
      set((state) => ({ pending: removePending(state.pending, [id]) }));
    }
  },

  /** Marca uma parcela específica como paga */
  markInstallmentPaid: async (receivableId, installmentNumber, paidAt) => {
    const pendingKey = `${receivableId}:${installmentNumber}`;
    if (get().pending[pendingKey] || get().pending[receivableId]) return;

    const snapshot = get().receivables;
    const receivables = snapshot.map(r => {
      if (r.id !== receivableId) return r;
      const installmentHistory = r.installmentHistory.map(inst =>
        inst.installmentNumber === installmentNumber
          ? { ...inst, paidAt: paidAt || new Date().toISOString() }
          : inst
      );
      const paidInstallments = installmentHistory.filter(i => i.paidAt).length;
      return { ...r, installmentHistory, paidInstallments };
    });
    const target = receivables.find(r => r.id === receivableId);
    if (!target) return;

    set((state) => ({
      receivables,
      pending: addPending(state.pending, [pendingKey, receivableId]),
    }));

    try {
      await saveStoredReceivable(target);
    } catch (err) {
      set({ receivables: snapshot });
      console.error(err);
    } finally {
      set((state) => ({ pending: removePending(state.pending, [pendingKey, receivableId]) }));
    }
  },
}));
