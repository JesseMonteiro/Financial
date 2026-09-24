import React, { useEffect, useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { IconBusyButton } from '../components/ui/Spinner';
import { PageLoadingSkeleton, SkeletonList } from '../components/ui/Skeleton';
import { useBudgetStore } from '../stores/budgetStore';
import { useAccountStore } from '../stores/accountStore';
import { useReceivableStore } from '../stores/receivableStore';
import { useCreditDataStore } from '../stores/creditDataStore';
import { useMealBenefitStore } from '../stores/mealBenefitStore';
import { useTransactionStore } from '../stores/transactionStore';
import { formatCurrency } from '../utils/formatters';
import {
  allTranslations,
  translateCategory,
  resolveBudgetCategoryKey,
  canonicalBudgetCategory,
  isSubcategory,
  getParentCategory,
  matchesBudgetCategory,
  CATEGORY_HIERARCHY,
  BASE_KEY_TO_LABEL,
  resolveCategoryLabel,
  PLUGGY_BASE_CATEGORIES,
} from '../utils/categories';
import { useCategoryStore } from '../stores/categoryStore';
import { getCategoryColor } from '../utils/colors';
import {
  isBillPayment,
  signedTxAmount,
  MONTHS_PT,
} from '../utils/creditBillPeriod';
import { isInitialEmpty } from '../utils/loading';
import {
  asOfForBudgetMonth,
  BUDGET_EXCLUDED_CATEGORIES,
  BUDGET_PERIOD_LABELS,
  BUDGET_PERIOD_UNIT,
  BUDGET_PERIODS,
  mergeBudgetRows,
  periodProgressLabel,
} from '../utils/budgetPeriod';
import {
  mealSpendByCategory,
  normalizeMealBenefit,
  normalizeMealPurchase,
  defaultMealCategoryForKind,
} from '../utils/mealBenefits';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function currentDueMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function dueMonthLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MONTHS_PT[parseInt(m, 10) - 1]}/${y}`;
}

/**
 * Groups transactions by budget period (daily, weekly, biweekly, monthly).
 * Returns array of period groups with label, transactions, and total.
 */
function groupTransactionsByPeriod(transactions, period, selectedMonth) {
  if (!transactions || transactions.length === 0) return [];
  
  const groups = {};
  
  transactions.forEach(tx => {
    const [y, m, d] = (tx.date || '').split('-').map(Number);
    if (!y || !m || !d) return;
    
    let periodKey = '';
    let periodLabel = '';
    
    if (period === 'daily') {
      periodKey = tx.date;
      periodLabel = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    } else if (period === 'weekly') {
      const weekNum = Math.ceil(d / 7);
      periodKey = `week-${weekNum}`;
      periodLabel = `Semana ${weekNum}`;
    } else if (period === 'biweekly') {
      const half = d <= 15 ? 1 : 2;
      periodKey = `half-${half}`;
      periodLabel = half === 1 ? '1ª Quinzena' : '2ª Quinzena';
    } else {
      // monthly - single group
      periodKey = 'month';
      periodLabel = 'Mês completo';
    }
    
    if (!groups[periodKey]) {
      groups[periodKey] = {
        key: periodKey,
        label: periodLabel,
        transactions: [],
        total: 0,
        sortDate: tx.date,
      };
    }
    
    groups[periodKey].transactions.push(tx);
    groups[periodKey].total += tx.amount;
  });
  
  // Sort groups by date and sort transactions within each group
  const sorted = Object.values(groups).sort((a, b) => (b.sortDate || '').localeCompare(a.sortDate || ''));
  sorted.forEach(g => {
    g.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  });
  
  return sorted;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function Budget() {
  const { budgets, loadBudgets, updateBudget, deleteBudget, pending } = useBudgetStore();
  const { accounts, loadAccounts, loading: accountsLoading, lastUpdated: accAt } = useAccountStore();
  const { receivables, loadReceivables } = useReceivableStore();
  const {
    benefits: mealBenefits,
    purchases: mealPurchases,
    loadMealBenefits,
  } = useMealBenefitStore();
  const {
    loadForAccounts,
    loading: creditLoading,
    lastUpdatedByAccount,
    transactionsByAccount,
  } = useCreditDataStore();
  const { categories, loadCategories } = useCategoryStore();
  const { loadTransactions } = useTransactionStore();

  // Selected calendar month of the purchase (current by default)
  const [selectedMonth, setSelectedMonth] = useState(currentDueMonthKey);

  // Edit state
  const [editingCat, setEditingCat] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editPeriod, setEditPeriod] = useState('monthly');

  // Add new budget
  const [addingNew, setAddingNew] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newPeriod, setNewPeriod] = useState('monthly');
  const [savingBudget, setSavingBudget] = useState(false);

  // Expanded category state
  const [expandedCat, setExpandedCat] = useState(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => { loadBudgets(); loadAccounts(); loadReceivables(); loadMealBenefits(); loadCategories(); loadTransactions(); }, []);

  const accountIds = useMemo(() => accounts.map((a) => a.id), [accounts]);

  useEffect(() => {
    if (accountsLoading) return;
    if (!accountIds.length) return;
    loadForAccounts(accountIds);
  }, [accountIds.join(','), accountsLoading, loadForAccounts]);

  const allTransactions = useMemo(() => {
    const txs = [];
    for (const id of accountIds) txs.push(...(transactionsByAccount[id] || []));
    return txs;
  }, [accountIds, transactionsByAccount]);

  const hasCached =
    accountIds.length === 0 || accountIds.every((id) => lastUpdatedByAccount[id]);
  const loadingTx = accountIds.length > 0 && !hasCached && creditLoading;

  // ── Compute spending by category for selected CALENDAR month ───────────────
  // Uses purchase date (calendar month), not billing month (due month).
  // Spending is aggregated by Level 1 base keys as well as specific canonical subcategories.
  const { spendingByCategory, subSpend } = useMemo(() => {
    const map = {};
    const sub = {};
    allTransactions.forEach(tx => {
      if (isBillPayment(tx)) return;
      const signed = signedTxAmount(tx);
      if (signed <= 0) return;

      // Use calendar month (purchase date) instead of due month
      const txCalendarMonth = String(tx.date || '').slice(0, 7);
      if (txCalendarMonth !== selectedMonth) return;

      const raw = String(tx.category || '');
      const baseKey = resolveBudgetCategoryKey(raw);
      if (!baseKey) return;
      map[baseKey] = (map[baseKey] || 0) + signed;

      const canonicalSub = canonicalBudgetCategory(raw);
      if (isSubcategory(canonicalSub)) {
        map[canonicalSub] = (map[canonicalSub] || 0) + signed;
      }

      const subLabel = translateCategory(raw);
      const baseLabel = BASE_KEY_TO_LABEL[baseKey] || resolveCategoryLabel(baseKey, categories) || baseKey;
      if (subLabel && subLabel !== baseLabel && subLabel !== baseKey) {
        if (!sub[baseKey]) sub[baseKey] = {};
        sub[baseKey][subLabel] = (sub[baseKey][subLabel] || 0) + signed;
      }
    });
    return { spendingByCategory: map, subSpend: sub };
  }, [allTransactions, selectedMonth, categories]);

  // ── Map transactions by category for expanded view ─────────────────────────
  // Uses allTransactions with CALENDAR MONTH (purchase date) to match spendingByCategory.
  // Grouped by base category key as well as canonical subcategory keys.
  const transactionsByCategory = useMemo(() => {
    const map = {};

    allTransactions.forEach(tx => {
      if (isBillPayment(tx)) return;
      const signed = signedTxAmount(tx);
      if (signed <= 0) return;
      // Use calendar month (purchase date) instead of due month
      const txCalendarMonth = String(tx.date || '').slice(0, 7);
      if (txCalendarMonth !== selectedMonth) return;
      const raw = String(tx.category || '');
      const baseKey = resolveBudgetCategoryKey(raw);
      if (!baseKey) return;
      if (!map[baseKey]) map[baseKey] = [];
      const account = accounts.find(a => a.id === tx.accountId);
      const subLabel = translateCategory(raw);
      const canonicalSub = canonicalBudgetCategory(raw);
      const item = {
        id: tx.id,
        description: tx.description || tx.descriptionTranslated || tx.descriptionRaw || 'Sem descrição',
        date: String(tx.date || '').slice(0, 10),
        amount: signed,
        isMeal: false,
        accountName: account?.name || 'Conta',
        subCategoryLabel: subLabel,
      };
      map[baseKey].push(item);
      if (isSubcategory(canonicalSub)) {
        if (!map[canonicalSub]) map[canonicalSub] = [];
        map[canonicalSub].push(item);
      }
      if (subLabel && subLabel !== baseKey && subLabel !== canonicalSub) {
        if (!map[subLabel]) map[subLabel] = [];
        map[subLabel].push(item);
      }
    });

    // Meal purchases (VA/VR)
    const benefitsById = {};
    mealBenefits.map(normalizeMealBenefit).forEach(b => { if (b.id) benefitsById[b.id] = b; });
    mealPurchases.map(normalizeMealPurchase).forEach(p => {
      if (!String(p.purchasedAt || '').startsWith(selectedMonth)) return;
      const benefit = benefitsById[p.benefitId];
      const rawCategory = p.category || defaultMealCategoryForKind(benefit?.kind);
      const baseKey = resolveBudgetCategoryKey(rawCategory);
      if (!baseKey) return;
      if (!map[baseKey]) map[baseKey] = [];
      const subLabel = translateCategory(rawCategory);
      const canonicalSub = canonicalBudgetCategory(rawCategory);
      const item = {
        id: p.id,
        description: p.description || (benefit?.kind === 'VR' ? 'VR — compra' : 'VA — compra'),
        date: String(p.purchasedAt || '').slice(0, 10),
        amount: p.amount,
        isMeal: true,
        accountName: benefit?.label || (benefit?.kind === 'VR' ? 'VR' : 'VA'),
        subCategoryLabel: subLabel,
      };
      map[baseKey].push(item);
      if (isSubcategory(canonicalSub)) {
        if (!map[canonicalSub]) map[canonicalSub] = [];
        map[canonicalSub].push(item);
      }
      if (subLabel && subLabel !== baseKey && subLabel !== canonicalSub) {
        if (!map[subLabel]) map[subLabel] = [];
        map[subLabel].push(item);
      }
    });

    Object.keys(map).forEach(cat => {
      map[cat].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    return map;
  }, [allTransactions, selectedMonth, mealBenefits, mealPurchases, accounts]);

  const { mealSpendMap, mealSubSpend } = useMemo(() => {
    const rawMealMap = mealSpendByCategory(mealBenefits, mealPurchases, selectedMonth);
    const map = {};
    const sub = {};
    Object.entries(rawMealMap).forEach(([cat, amount]) => {
      const amt = Number(amount || 0);
      const baseKey = resolveBudgetCategoryKey(cat);
      map[baseKey] = (map[baseKey] || 0) + amt;

      const canonicalSub = canonicalBudgetCategory(cat);
      if (isSubcategory(canonicalSub)) {
        map[canonicalSub] = (map[canonicalSub] || 0) + amt;
      }

      const subLabel = translateCategory(cat);
      const baseLabel = BASE_KEY_TO_LABEL[baseKey] || baseKey;
      if (subLabel && subLabel !== baseLabel && subLabel !== baseKey) {
        if (!sub[baseKey]) sub[baseKey] = {};
        sub[baseKey][subLabel] = (sub[baseKey][subLabel] || 0) + amt;
      }
    });
    return { mealSpendMap: map, mealSubSpend: sub };
  }, [mealBenefits, mealPurchases, selectedMonth]);

  const combinedSubSpend = useMemo(() => {
    const res = { ...subSpend };
    Object.entries(mealSubSpend).forEach(([baseKey, subs]) => {
      if (!res[baseKey]) res[baseKey] = {};
      Object.entries(subs).forEach(([subLabel, amt]) => {
        res[baseKey][subLabel] = (res[baseKey][subLabel] || 0) + amt;
      });
    });
    return res;
  }, [subSpend, mealSubSpend]);

  const asOfDate = useMemo(
    () => asOfForBudgetMonth(selectedMonth),
    [selectedMonth],
  );

  const availableMonths = useMemo(() => {
    const months = new Set();
    allTransactions.forEach(tx => {
      if (isBillPayment(tx)) return;
      const m = String(tx.date || '').slice(0, 7);
      if (m) months.add(m);
    });
    mealPurchases.forEach((p) => {
      const m = String(p.purchasedAt || '').slice(0, 7);
      if (m) months.add(m);
    });
    months.add(currentDueMonthKey());
    months.add(selectedMonth);
    return [...months].sort();
  }, [allTransactions, mealPurchases, selectedMonth]);

  const budgetRows = useMemo(() => mergeBudgetRows({
    spentBankMap: spendingByCategory,
    spentMealMap: mealSpendMap,
    budgets,
    ym: selectedMonth,
    asOfDate,
    subSpend: combinedSubSpend,
  }), [spendingByCategory, mealSpendMap, budgets, selectedMonth, asOfDate, combinedSubSpend]);

  const totalSpent = useMemo(
    () => budgetRows.reduce((s, r) => s + r.spent, 0),
    [budgetRows],
  );
  const totalAllowance = useMemo(
    () => budgetRows.filter((r) => r.hasLimit).reduce((s, r) => s + r.allowance, 0),
    [budgetRows],
  );
  const totalMonthCap = useMemo(
    () => budgetRows.filter((r) => r.hasLimit).reduce((s, r) => s + r.monthCap, 0),
    [budgetRows],
  );
  const categoriesOverBudget = useMemo(() =>
    budgetRows.filter(r => r.hasLimit && r.spent > r.limit).length, [budgetRows]);
  const categoriesWithBudget = useMemo(() =>
    budgetRows.filter(r => r.hasLimit).length, [budgetRows]);

  // ── Reimbursements received in selected month ──────────────────────────────
  const reimbursementsReceived = useMemo(() => {
    return receivables.reduce((total, r) => {
      const monthPaid = r.installmentHistory
        .filter(i => i.paidAt && i.paidAt.slice(0, 7) === selectedMonth)
        .reduce((s, i) => s + i.amount, 0);
      return total + monthPaid;
    }, 0);
  }, [receivables, selectedMonth]);

  // ── Historical chart: spending by month for a specific category ────────────
  const chartData = useMemo(() => {
    const last6 = availableMonths.slice(-6);
    return last6.map(m => {
      const monthTxs = allTransactions.filter(tx => {
        if (isBillPayment(tx)) return false;
        if (signedTxAmount(tx) <= 0) return false;
        return String(tx.date || '').slice(0, 7) === m;
      });
      const total = monthTxs.reduce((s, t) => s + signedTxAmount(t), 0);
      const [, mo] = m.split('-');
      return { label: MONTHS_PT[parseInt(mo, 10) - 1].slice(0, 3), total, month: m };
    });
  }, [availableMonths, allTransactions]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSaveEdit = async (cat) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val <= 0 || savingBudget) return;
    setSavingBudget(true);
    try {
      await updateBudget(cat, val, editPeriod);
      setEditingCat(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBudget(false);
    }
  };

  const handleAddNew = async () => {
    const val = parseFloat(newLimit);
    if (!newCat || isNaN(val) || val <= 0 || savingBudget) return;
    setSavingBudget(true);
    try {
      await updateBudget(newCat, val, newPeriod);
      setNewCat('');
      setNewLimit('');
      setNewPeriod('monthly');
      setAddingNew(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBudget(false);
    }
  };

  const hierarchicalBudgetGroups = useMemo(() => {
    const taken = new Set(
      budgets.map(b => canonicalBudgetCategory(b.category))
    );

    const groups = CATEGORY_HIERARCHY.map(group => {
      if (BUDGET_EXCLUDED_CATEGORIES.includes(group.key) || BUDGET_EXCLUDED_CATEGORIES.includes(group.label)) {
        return null;
      }
      const parentAvailable = !taken.has(group.key);
      const availableSubs = (group.subcategories || []).filter(sub => {
        return !taken.has(sub.key) &&
               !BUDGET_EXCLUDED_CATEGORIES.includes(sub.key) &&
               !BUDGET_EXCLUDED_CATEGORIES.includes(sub.label);
      });
      if (!parentAvailable && availableSubs.length === 0) return null;
      return {
        key: group.key,
        label: group.label,
        color: group.color,
        parentAvailable,
        subcategories: availableSubs,
      };
    }).filter(Boolean);

    // Custom user categories
    const customList = categories.filter(c => !c.isBase && c.key && !BUDGET_EXCLUDED_CATEGORIES.includes(c.key) && !BUDGET_EXCLUDED_CATEGORIES.includes(c.label) && !taken.has(c.key));
    if (customList.length > 0) {
      groups.push({
        key: 'custom',
        label: 'Categorias personalizadas',
        color: '#64748b',
        parentAvailable: false,
        subcategories: customList.map(c => ({
          key: c.key,
          label: c.label || c.name || c.key,
          icon: c.icon,
        })),
      });
    }

    return groups;
  }, [budgets, categories]);

  // Navigation
  const monthIdx = availableMonths.indexOf(selectedMonth);
  const canGoPrev = monthIdx > 0;
  const canGoNext = monthIdx < availableMonths.length - 1;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (isInitialEmpty(accounts, accountsLoading, accAt)) {
    return (
      <PageLoadingSkeleton
        kpiCount={4}
        showTimeline={false}
        showChart
        showList
        label="Carregando orçamento…"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Orçamento</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            Meta por categoria com período diário, semanal, quinzenal ou mensal. A verba acumula no mês e zera na virada.
          </p>
        </div>
        <div className="page-header__actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '0.4rem 0.75rem' }}>
            <button
              onClick={() => canGoPrev && setSelectedMonth(availableMonths[monthIdx - 1])}
              disabled={!canGoPrev}
              className="tap-target"
              style={{ border: 'none', background: 'transparent', cursor: canGoPrev ? 'pointer' : 'not-allowed', color: canGoPrev ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', minWidth: 130, textAlign: 'center' }}>
              {dueMonthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => canGoNext && setSelectedMonth(availableMonths[monthIdx + 1])}
              disabled={!canGoNext}
              className="tap-target"
              style={{ border: 'none', background: 'transparent', cursor: canGoNext ? 'pointer' : 'not-allowed', color: canGoNext ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="dashboard-grid">
        <Card className="col-3" style={{ borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>GASTO NAS METAS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: totalSpent > totalAllowance && totalAllowance > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {loadingTx ? '...' : formatCurrency(totalSpent)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {budgetRows.length} {budgetRows.length === 1 ? 'categoria' : 'categorias'} com meta definida
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: '4px solid var(--info)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>VERBA LIBERADA</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0' }}>
            {formatCurrency(totalAllowance)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Teto do mês {formatCurrency(totalMonthCap)} · {categoriesWithBudget} {categoriesWithBudget === 1 ? 'meta' : 'metas'}
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: `4px solid ${totalAllowance > 0 ? (totalSpent <= totalAllowance ? 'var(--success)' : 'var(--danger)') : 'var(--border-color)'}` }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>SALDO DO ORÇAMENTO</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: totalAllowance > 0 ? (totalSpent <= totalAllowance ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)' }}>
            {totalAllowance > 0 ? formatCurrency(Math.abs(totalAllowance - totalSpent)) : '—'}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: totalSpent > totalAllowance && totalAllowance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {totalAllowance > 0 ? (totalSpent <= totalAllowance ? '✓ Dentro da verba acumulada' : '⚠ Verba excedida') : 'Defina metas nas categorias'}
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: `4px solid ${categoriesOverBudget > 0 ? 'var(--danger)' : 'var(--success)'}` }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>CATEGORIAS ESTOURADAS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: categoriesOverBudget > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {categoriesOverBudget}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            de {categoriesWithBudget} com limite definido
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>💰 REEMBOLSOS RECEBIDOS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--success)' }}>
            {formatCurrency(reimbursementsReceived)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Valores a Receber — créditos no mês
          </span>
        </Card>
      </div>

      {/* Monthly spending chart */}
      <Card title="Gasto Total por Mês" subtitle="Histórico de gastos no cartão de crédito (por competência)">
        <div style={{ width: '100%', height: 200, marginTop: '0.5rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke="var(--text-muted)" tickLine={false} />
              <YAxis fontSize={11} stroke="var(--text-muted)" tickLine={false} axisLine={false}
                tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={v => [formatCurrency(v), 'Total']}
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderColor: 'var(--border-color)' }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.month === selectedMonth ? 'var(--warning)' : 'var(--primary)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Budget Categories */}
      <Card
        title={`Orçamento por Categoria — ${dueMonthLabel(selectedMonth)}`}
        subtitle="Gasto de banco/cartão e VA/VR contra a verba já liberada no mês. Clique em ✏ para definir a meta."
        action={
          <Button size="sm" variant="primary" onClick={() => setAddingNew(true)} icon={Plus}>
            Adicionar meta
          </Button>
        }
      >
        {addingNew && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.85rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary)', marginBottom: '1rem' }}>
            <select
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              className="input"
              style={{ flex: '1 1 240px', padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
            >
              <option value="">Selecione a categoria ou subcategoria...</option>
              {hierarchicalBudgetGroups.map(group => (
                <optgroup key={group.key} label={group.label}>
                  {group.parentAvailable && (
                    <option key={group.key} value={group.key}>
                      {group.label} (Principal — todas as despesas)
                    </option>
                  )}
                  {group.subcategories.map(sub => (
                    <option key={sub.key} value={sub.key}>
                      ↳ {sub.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              value={newPeriod}
              onChange={e => setNewPeriod(e.target.value)}
              className="input"
              style={{ padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
            >
              {BUDGET_PERIODS.map((p) => (
                <option key={p} value={p}>{BUDGET_PERIOD_LABELS[p]}</option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>R$</span>
              <input
                type="number"
                placeholder={`Valor${BUDGET_PERIOD_UNIT[newPeriod] || ''}`}
                value={newLimit}
                onChange={e => setNewLimit(e.target.value)}
                className="input"
                style={{ width: 140, padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
              />
            </div>
            <Button size="sm" variant="primary" onClick={handleAddNew} icon={Check} loading={savingBudget}>Salvar</Button>
            <button onClick={() => { setAddingNew(false); setNewCat(''); setNewLimit(''); setNewPeriod('monthly'); }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {loadingTx ? (
          <SkeletonList rows={6} />
        ) : budgetRows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1rem', padding: '2rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <Info size={18} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', margin: 0, marginBottom: '0.5rem', fontWeight: 600 }}>
                Nenhuma meta de orçamento definida
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Use o botão <strong>+ Adicionar meta</strong> acima para definir limites de gasto por categoria. A verba diária, semanal e quinzenal acumula no mês e zera na virada.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
            {budgetRows.map(row => {
              const pct = row.hasLimit && row.limit > 0
                ? Math.min(150, Math.round((row.spent / row.limit) * 100))
                : 0;
              const isOver = row.hasLimit && row.spent > row.limit;
              const isNear = row.hasLimit && !isOver && pct >= 75;
              const barColor = isOver ? 'var(--danger)' : isNear ? 'var(--warning)' : 'var(--success)';
              const isEditing = editingCat === row.category;

              return (
                <div
                  key={row.category}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: `1px solid ${isOver ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  {/* Row header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Category + badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                      <button
                        onClick={() => setExpandedCat(expandedCat === row.category ? null : row.category)}
                        className="tap-target"
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                          transition: 'transform 0.2s',
                          transform: expandedCat === row.category ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}
                        title={expandedCat === row.category ? 'Recolher transações' : 'Ver transações'}
                      >
                        <ChevronDown size={16} />
                      </button>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: getCategoryColor(row.category), flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                            {row.categoryLabel || BASE_KEY_TO_LABEL[row.category] || resolveCategoryLabel(row.category, categories) || row.category}
                          </span>
                          {row.isSubcategory && (
                            <Badge variant="neutral" style={{ fontSize: '10px', padding: '1px 5px' }}>
                              Subcategoria
                            </Badge>
                          )}
                          {isOver && <Badge variant="danger"><AlertTriangle size={10} style={{ marginRight: 3 }} />Estourado</Badge>}
                          {isNear && !isOver && <Badge variant="warning">Atenção</Badge>}
                          <Badge variant="neutral">
                            {formatCurrency(row.periodAmount)}{BUDGET_PERIOD_UNIT[row.period] || ''}
                          </Badge>
                        </div>
                        {row.isSubcategory && row.parentCategoryLabel && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            Subcategoria de {row.parentCategoryLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Spent / Limit + edit controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      {isEditing ? (
                        <>
                          <select
                            value={editPeriod}
                            onChange={e => setEditPeriod(e.target.value)}
                            className="input"
                            style={{ padding: '0.2rem 0.4rem', fontSize: 'var(--font-size-xs)' }}
                          >
                            {BUDGET_PERIODS.map((p) => (
                              <option key={p} value={p}>{BUDGET_PERIOD_LABELS[p]}</option>
                            ))}
                          </select>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>R$</span>
                          <input
                            type="number"
                            defaultValue={row.periodAmount || row.limit || ''}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveEdit(row.category)}
                            autoFocus
                            className="input"
                            style={{ width: 100, padding: '0.2rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                          />
                          <IconBusyButton
                            busy={savingBudget || Boolean(pending[row.category])}
                            onClick={() => handleSaveEdit(row.category)}
                            title="Salvar meta"
                            style={{ color: 'var(--success)' }}
                          >
                            <Check size={15} />
                          </IconBusyButton>
                          <button onClick={() => setEditingCat(null)}
                            disabled={savingBudget}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: isOver ? 'var(--danger)' : 'var(--text-primary)' }}>
                            {formatCurrency(row.spent)}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            / {formatCurrency(row.limit)}
                          </span>
                          <button
                            onClick={() => {
                              setEditingCat(row.category);
                              setEditValue(row.periodAmount || row.limit || '');
                              setEditPeriod(row.period || 'monthly');
                            }}
                            title="Editar meta"
                            className="tap-target"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <IconBusyButton
                            onClick={() => deleteBudget(row.category)}
                            busy={Boolean(pending[row.category])}
                            title="Remover meta"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={13} />
                          </IconBusyButton>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <ProgressBar percent={Math.min(100, pct)} color={barColor} height={9} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {periodProgressLabel(row.period, selectedMonth, asOfDate)} · {pct}% da verba liberada
                    {isOver
                      ? ` • Excedeu em ${formatCurrency(row.spent - row.limit)}`
                      : ` • Restam ${formatCurrency(row.limit - row.spent)}`}
                  </span>
                  {row.spentMeal > 0 && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {formatCurrency(row.spentBank)} banco/cartão · {formatCurrency(row.spentMeal)} VA/VR
                    </span>
                  )}
                  {row.subcategories && row.subcategories.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                      {row.subcategories.map(sub => (
                        <span
                          key={sub.label}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span>{sub.label}:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(sub.spent)}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expanded transactions list */}
                  {expandedCat === row.category && (() => {
                    const allTxs = transactionsByCategory[row.category] || transactionsByCategory[row.categoryLabel] || [];
                    const periodGroups = groupTransactionsByPeriod(allTxs, row.period, selectedMonth);
                    const showPeriodGroups = row.period !== 'monthly' && periodGroups.length > 1;
                    
                    return (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
                            TRANSAÇÕES ({allTxs.length})
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                          {allTxs.length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                              Nenhuma transação encontrada
                            </div>
                          ) : showPeriodGroups ? (
                            periodGroups.map((group, gIdx) => (
                              <div 
                                key={group.key} 
                                style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: '0.5rem',
                                  padding: '0.75rem',
                                  backgroundColor: gIdx % 2 === 0 ? 'rgba(var(--primary-rgb, 99, 102, 241), 0.03)' : 'rgba(var(--success-rgb, 34, 197, 94), 0.03)',
                                  borderRadius: 'var(--radius-md)',
                                  border: `1px solid ${gIdx % 2 === 0 ? 'rgba(var(--primary-rgb, 99, 102, 241), 0.1)' : 'rgba(var(--success-rgb, 34, 197, 94), 0.1)'}`,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '2px solid var(--border-color)', marginBottom: '0.25rem' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {group.label}
                                  </span>
                                  <span style={{ fontSize: '13px', fontWeight: 800, color: gIdx % 2 === 0 ? 'var(--primary)' : 'var(--success)' }}>
                                    {formatCurrency(group.total)}
                                  </span>
                                </div>
                                {group.transactions.map((tx, idx) => {
                                  const [ty, tm, td] = (tx.date || '').split('-');
                                  const dateLabel = ty ? `${td}/${tm}/${ty}` : '—';
                                  return (
                                    <div
                                      key={`${tx.id || idx}-${tx.date}`}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.5rem',
                                        backgroundColor: 'var(--bg-primary)',
                                        borderRadius: 'var(--radius-sm)',
                                        gap: '0.5rem',
                                        border: '1px solid var(--border-color)',
                                      }}
                                    >
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {tx.description}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{dateLabel}</span>
                                          {tx.accountName && (
                                            <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', padding: '0 4px', border: '1px solid var(--border-color)' }}>
                                              {tx.accountName}
                                            </span>
                                          )}
                                          {tx.subCategoryLabel && tx.subCategoryLabel !== (row.categoryLabel || BASE_KEY_TO_LABEL[row.category]) && (
                                            <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--primary)', backgroundColor: 'rgba(var(--primary-rgb, 99, 102, 241), 0.08)', borderRadius: '3px', padding: '0 4px', border: '1px solid rgba(var(--primary-rgb, 99, 102, 241), 0.2)' }}>
                                              {tx.subCategoryLabel}
                                            </span>
                                          )}
                                          {tx.isMeal && (
                                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--info)', backgroundColor: 'rgba(99,179,237,0.15)', borderRadius: '3px', padding: '0 4px' }}>VA/VR</span>
                                          )}
                                        </div>
                                      </div>
                                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                        {formatCurrency(tx.amount)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ))
                          ) : (
                            allTxs.map((tx, idx) => {
                              const [ty, tm, td] = (tx.date || '').split('-');
                              const dateLabel = ty ? `${td}/${tm}/${ty}` : '—';
                              return (
                                <div
                                  key={`${tx.id || idx}-${tx.date}`}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    backgroundColor: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    gap: '0.5rem',
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {tx.description}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px', flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{dateLabel}</span>
                                      {tx.accountName && (
                                        <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', padding: '0 4px', border: '1px solid var(--border-color)' }}>
                                          {tx.accountName}
                                        </span>
                                      )}
                                      {tx.subCategoryLabel && tx.subCategoryLabel !== (row.categoryLabel || BASE_KEY_TO_LABEL[row.category]) && (
                                        <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--primary)', backgroundColor: 'rgba(var(--primary-rgb, 99, 102, 241), 0.08)', borderRadius: '3px', padding: '0 4px', border: '1px solid rgba(var(--primary-rgb, 99, 102, 241), 0.2)' }}>
                                          {tx.subCategoryLabel}
                                        </span>
                                      )}
                                      {tx.isMeal && (
                                        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--info)', backgroundColor: 'rgba(99,179,237,0.15)', borderRadius: '3px', padding: '0 4px' }}>VA/VR</span>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                    {formatCurrency(tx.amount)}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
