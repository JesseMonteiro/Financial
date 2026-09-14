import { create } from 'zustand';
import {
  getStoredMealBenefits,
  saveStoredMealBenefit,
  deleteStoredMealBenefit,
  getStoredMealBenefitPurchases,
  saveStoredMealBenefitPurchase,
  deleteStoredMealBenefitPurchase,
} from '../services/storage';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';
import { normalizeMealBenefit, normalizeMealPurchase, todayISO } from '../utils/mealBenefits';

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

export const useMealBenefitStore = create((set, get) => ({
  benefits: [],
  purchases: [],
  loading: false,
  lastUpdated: null,
  pending: {},

  isPending: (id) => Boolean(get().pending[id]),

  loadMealBenefits: async ({ force = false } = {}) => {
    const { benefits, lastUpdated } = get();
    if (
      !force &&
      lastUpdated &&
      isFreshTimestamp(lastUpdated, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = benefits.length > 0 || (get().purchases || []).length > 0;
    if (!silent) set({ loading: true });

    try {
      const [rawBenefits, rawPurchases] = await Promise.all([
        getStoredMealBenefits(),
        getStoredMealBenefitPurchases(),
      ]);
      set({
        benefits: (rawBenefits || []).map(normalizeMealBenefit),
        purchases: (rawPurchases || []).map(normalizeMealPurchase),
        loading: false,
        lastUpdated: Date.now(),
      });
    } catch (e) {
      console.error('[mealBenefitStore] Erro ao carregar:', e);
      set({ benefits: [], purchases: [], loading: false });
    }
  },

  addBenefit: async (data) => {
    const now = new Date().toISOString();
    const benefit = normalizeMealBenefit({
      id: crypto.randomUUID(),
      kind: data.kind === 'VR' ? 'VR' : 'VA',
      label: data.label || '',
      monthlyAmount: Number(data.monthlyAmount) || 0,
      creditDay: Number(data.creditDay) || 1,
      startsOn: data.startsOn || todayISO(),
      openingBalance: Number(data.openingBalance) || 0,
      showInMoment: Boolean(data.showInMoment),
      createdAt: now,
      updatedAt: now,
    });

    const snapshot = get().benefits;
    set((state) => ({
      benefits: [...state.benefits, benefit],
      pending: addPending(state.pending, [benefit.id]),
    }));
    try {
      await saveStoredMealBenefit(benefit);
    } catch (err) {
      set({ benefits: snapshot });
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, [benefit.id]) }));
    }
    return benefit;
  },

  updateBenefit: async (id, patch) => {
    if (get().pending[id]) return;
    const snapshot = get().benefits;
    const current = snapshot.find((b) => b.id === id);
    if (!current) return;
    const next = normalizeMealBenefit({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    set((state) => ({
      benefits: state.benefits.map((b) => (b.id === id ? next : b)),
      pending: addPending(state.pending, [id]),
    }));
    try {
      await saveStoredMealBenefit(next);
    } catch (err) {
      set({ benefits: snapshot });
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, [id]) }));
    }
  },

  removeBenefit: async (id) => {
    if (get().pending[id]) return;
    const snapshotBenefits = get().benefits;
    const snapshotPurchases = get().purchases;
    set((state) => ({
      benefits: state.benefits.filter((b) => b.id !== id),
      purchases: state.purchases.filter((p) => p.benefitId !== id),
      pending: addPending(state.pending, [id]),
    }));
    try {
      await deleteStoredMealBenefit(id);
    } catch (err) {
      set({ benefits: snapshotBenefits, purchases: snapshotPurchases });
      console.error(err);
    } finally {
      set((state) => ({ pending: removePending(state.pending, [id]) }));
    }
  },

  addPurchase: async (data) => {
    const now = new Date().toISOString();
    const purchase = normalizeMealPurchase({
      id: crypto.randomUUID(),
      benefitId: data.benefitId,
      amount: Number(data.amount) || 0,
      purchasedAt: data.purchasedAt || todayISO(),
      description: data.description || '',
      createdAt: now,
    });
    const snapshot = get().purchases;
    set((state) => ({
      purchases: [...state.purchases, purchase],
      pending: addPending(state.pending, [purchase.id]),
    }));
    try {
      await saveStoredMealBenefitPurchase(purchase);
    } catch (err) {
      set({ purchases: snapshot });
      throw err;
    } finally {
      set((state) => ({ pending: removePending(state.pending, [purchase.id]) }));
    }
    return purchase;
  },

  removePurchase: async (id) => {
    if (get().pending[id]) return;
    const snapshot = get().purchases;
    set((state) => ({
      purchases: state.purchases.filter((p) => p.id !== id),
      pending: addPending(state.pending, [id]),
    }));
    try {
      await deleteStoredMealBenefitPurchase(id);
    } catch (err) {
      set({ purchases: snapshot });
      console.error(err);
    } finally {
      set((state) => ({ pending: removePending(state.pending, [id]) }));
    }
  },
}));
