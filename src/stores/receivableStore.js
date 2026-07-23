import { create } from 'zustand';
import {
  getStoredReceivables,
  saveStoredReceivable,
  deleteStoredReceivable,
} from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';

export const useReceivableStore = create((set, get) => ({
  receivables: [],
  loading: false,
  lastUpdated: null,

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

    // Gera cor aleatória em hex
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

    // Gera histórico de parcelas
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

    // Reuse existing color for the same person if they already have receivables
    const existing = get().receivables.find(r => r.personName.toLowerCase() === (data.personName || '').toLowerCase());
    const personColor = existing ? existing.personColor : (data.personColor || randomColor());

    const receivable = {
      id: crypto.randomUUID(),
      personName: data.personName || '',
      personColor,
      description: data.description || '',
      totalAmount: isContinuous ? (installmentAmount * 24) : (data.totalAmount || 0),
      originalTotalAmount: data.totalAmount, // Keep trace of user entered amount
      installments,
      paidInstallments: 0,
      linkedTransactionId: data.linkedTransactionId || null,
      linkedBillForecastDate: data.linkedBillForecastDate || null,
      notes: data.notes || '',
      createdAt: now,
      isContinuous,
      installmentHistory,
    };

    await saveStoredReceivable(receivable);
    set(state => ({ receivables: [...state.receivables, receivable] }));
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

    // If amount, installments, start due date, or continuous flag changed, regenerate the history
    if (data.totalAmount !== undefined || data.installments !== undefined || data.firstDueDate !== undefined || data.isContinuous !== undefined) {
      const isContinuous = data.isContinuous !== undefined ? data.isContinuous : (existing.isContinuous || false);
      installments = isContinuous ? 24 : (data.installments !== undefined ? data.installments : existing.installments);
      const firstDueDate = data.firstDueDate || (existing.installmentHistory[0]?.dueDate || new Date().toISOString().slice(0, 10));
      const totalAmount = data.totalAmount !== undefined ? data.totalAmount : (existing.originalTotalAmount || existing.totalAmount);
      const installmentAmount = isContinuous ? totalAmount : (totalAmount / installments);

      installmentHistory = Array.from({ length: installments }, (_, i) => {
        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        // Preserve paid status of corresponding installments if possible
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

    const updatedReceivable = {
      ...existing,
      ...data,
      totalAmount: (data.isContinuous || existing.isContinuous) ? ((data.totalAmount || existing.originalTotalAmount || existing.totalAmount) * 24) : (data.totalAmount !== undefined ? data.totalAmount : existing.totalAmount),
      originalTotalAmount: data.totalAmount !== undefined ? data.totalAmount : (existing.originalTotalAmount || existing.totalAmount),
      installments,
      paidInstallments,
      installmentHistory
    };

    await saveStoredReceivable(updatedReceivable);
    set(state => ({
      receivables: state.receivables.map(r => r.id === id ? updatedReceivable : r)
    }));
  },

  /** Remove um recebível do IndexedDB e da lista local */
  deleteReceivable: async (id) => {
    await deleteStoredReceivable(id);
    set(state => ({ receivables: state.receivables.filter(r => r.id !== id) }));
  },

  /** Marca uma parcela específica como paga */
  markInstallmentPaid: async (receivableId, installmentNumber, paidAt) => {
    const receivables = get().receivables.map(r => {
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
    if (target) {
      await saveStoredReceivable(target);
      set({ receivables });
    }
  },
}));
