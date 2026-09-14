import { create } from 'zustand';
import {
  fetchJointStatus,
  generateJointInvite,
  acceptJointInvite,
  unlinkJoint,
  fetchJointMomentData,
  fetchJointInvestments,
} from '../services/api';
import { CACHE_TTL_MS, isFreshTimestamp } from '../services/clientCache';
import { mergeInvestmentsWithReserved } from '../utils/reservedBalances';
import { normalizeMealBenefit, normalizeMealPurchase } from '../utils/mealBenefits';

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
    accountId: camel.accountId || row.account_id || 'manual',
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
  mealBenefits: [],
  mealBenefitPurchases: [],
  investments: [],
  investmentAccounts: [],
  statusLoading: false,
  momentLoading: false,
  investmentsLoading: false,
  error: null,
  investmentsError: null,
  lastLoadedAt: null,
  investmentsLoadedAt: null,
  pending: {},

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
      investments: [],
      investmentAccounts: [],
      lastLoadedAt: null,
      investmentsLoadedAt: null,
      investmentsError: null,
    });
    return result;
  },

  loadInvestments: async ({ force = false } = {}) => {
    const { investments, investmentsLoadedAt } = get();
    if (
      !force &&
      investments.length > 0 &&
      isFreshTimestamp(investmentsLoadedAt, CACHE_TTL_MS)
    ) {
      return;
    }

    const silent = investments.length > 0;
    if (!silent) set({ investmentsLoading: true, investmentsError: null });
    else set({ investmentsError: null });

    try {
      const data = await fetchJointInvestments({ force });
      const accounts = data.accounts || [];
      set({
        link: data.link || get().link,
        members: data.members?.length ? data.members : get().members,
        investments: mergeInvestmentsWithReserved(data.investments || [], accounts),
        investmentAccounts: accounts,
        investmentsLoading: false,
        investmentsError: null,
        investmentsLoadedAt: new Date(),
      });
      return data;
    } catch (err) {
      set({
        investmentsLoading: false,
        investmentsError: err.message,
        investmentsLoadedAt: new Date(),
      });
      throw err;
    }
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
        mealBenefits: (data.mealBenefits || []).map((row) =>
          normalizeMealBenefit({ ...toCamelCase(row), ownerUserId: row.ownerUserId || row.user_id, ownerLabel: row.ownerLabel })
        ),
        mealBenefitPurchases: (data.mealBenefitPurchases || []).map((row) =>
          normalizeMealPurchase({ ...toCamelCase(row), ownerUserId: row.ownerUserId || row.user_id, ownerLabel: row.ownerLabel })
        ),
        momentLoading: false,
        lastLoadedAt: Date.now(),
      });
      return data;
    } catch (err) {
      set({ momentLoading: false, error: err.message });
      throw err;
    }
  },

  isPending: (id) => Boolean(get().pending[id]),

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

  restoreManual: (manual) => {
    if (!manual?.id) return;
    set((state) => ({
      manuals: state.manuals.map((m) => (m.id === manual.id ? manual : m)),
    }));
  },

  setPending: (id, on) => {
    set((state) => {
      const pending = { ...state.pending };
      if (on) pending[id] = true;
      else delete pending[id];
      return { pending };
    });
  },

  patchMemberSalaries: (userId, salaries) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.id === userId ? { ...m, monthlySalaries: salaries } : m
      ),
    }));
  },
}));
