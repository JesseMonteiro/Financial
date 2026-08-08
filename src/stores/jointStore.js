import { create } from 'zustand';
import {
  fetchJointStatus,
  generateJointInvite,
  acceptJointInvite,
  unlinkJoint,
  fetchJointMomentData,
} from '../services/api';

function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const newObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    newObj[camelKey] = value;
  }
  return newObj;
}

function normalizeManual(row) {
  const camel = toCamelCase(row);
  return {
    ...camel,
    isManual: true,
    accountId: 'manual',
    ownerUserId: camel.ownerUserId || camel.userId,
    ownerLabel: camel.ownerLabel,
    isPaid: Boolean(camel.isPaid),
  };
}

function normalizeReceivable(row) {
  const camel = toCamelCase(row);
  const history = Array.isArray(row.installment_history)
    ? row.installment_history.map((h) => toCamelCase(h))
    : Array.isArray(camel.installmentHistory)
      ? camel.installmentHistory.map((h) => (typeof h === 'object' ? toCamelCase(h) : h))
      : [];
  return {
    ...camel,
    installmentHistory: history,
    ownerUserId: camel.ownerUserId || camel.userId,
    ownerLabel: camel.ownerLabel,
  };
}

export const useJointStore = create((set, get) => ({
  link: null,
  members: [],
  accounts: [],
  transactions: [],
  billsByAccount: {},
  manuals: [],
  receivables: [],
  statusLoading: false,
  momentLoading: false,
  error: null,
  lastLoadedAt: null,

  isActive: () => get().link?.status === 'active',

  loadStatus: async ({ force = false } = {}) => {
    set({ statusLoading: true, error: null });
    try {
      const link = await fetchJointStatus({ force });
      set({ link, statusLoading: false });
      return link;
    } catch (err) {
      set({ statusLoading: false, error: err.message, link: null });
      return null;
    }
  },

  invite: async () => {
    const token = await generateJointInvite();
    await get().loadStatus({ force: true });
    return token;
  },

  accept: async (token) => {
    const result = await acceptJointInvite(token);
    await get().loadStatus({ force: true });
    return result;
  },

  unlink: async () => {
    const result = await unlinkJoint();
    set({
      link: null,
      members: [],
      accounts: [],
      transactions: [],
      billsByAccount: {},
      manuals: [],
      receivables: [],
      lastLoadedAt: null,
    });
    return result;
  },

  loadMomentData: async ({ force = false } = {}) => {
    set({ momentLoading: true, error: null });
    try {
      const data = await fetchJointMomentData({ force });
      set({
        link: data.link || get().link,
        members: data.members || [],
        accounts: data.accounts || [],
        transactions: data.transactions || [],
        billsByAccount: data.billsByAccount || {},
        manuals: (data.manuals || []).map(normalizeManual),
        receivables: (data.receivables || []).map(normalizeReceivable),
        momentLoading: false,
        lastLoadedAt: Date.now(),
      });
      return data;
    } catch (err) {
      set({ momentLoading: false, error: err.message });
      throw err;
    }
  },

  /** Patch a manual paid flag locally after a successful save. */
  patchManualPaid: (id, isPaid) => {
    set((state) => ({
      manuals: state.manuals.map((m) =>
        m.id === id
          ? { ...m, isPaid: Boolean(isPaid), paidAt: isPaid ? new Date().toISOString() : null }
          : m
      ),
    }));
  },

  patchMemberSalaries: (userId, salaries) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.id === userId ? { ...m, monthlySalaries: salaries } : m
      ),
    }));
  },
}));
