import React, { useEffect, useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Check,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Info
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useBudgetStore } from '../stores/budgetStore';
import { useAccountStore } from '../stores/accountStore';
import { useReceivableStore } from '../stores/receivableStore';
import { fetchTransactions } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import { getCategoryColor } from '../utils/colors';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

/**
 * billForecastDate (YYYY-MM) for current open = the month WHOSE transactions
 * make up the bill that will be due next month.
 * Today is July 2026 → currentForecastKey = '2026-07' (Fatura Agosto/2026).
 * For the budget screen we show spending by the FORECAST month since that is
 * how transactions are tagged by the API.
 */
function currentForecastKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function forecastKeyLabel(ym) {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]}/${y}`;
}

function addMonths(ym, n) {
  let [y, m] = ym.split('-').map(Number);
  m += n;
  if (m > 12) { y += Math.floor((m - 1) / 12); m = ((m - 1) % 12) + 1; }
  if (m < 1) { y -= Math.ceil(Math.abs(m) / 12 + 1); m = ((m - 1 + 12 * 100) % 12) + 1; }
  return `${y}-${m < 10 ? '0' + m : m}`;
}

function isBillPayment(tx) {
  return (tx.description || '').toUpperCase().includes('PAGAMENTO DE FATURA') ||
         (tx.description || '').toUpperCase().includes('PAGAMENTO RECEBIDO');
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function Budget() {
  const { budgets, loadBudgets, updateBudget, deleteBudget } = useBudgetStore();
  const { accounts, loadAccounts } = useAccountStore();
  const { receivables, loadReceivables } = useReceivableStore();

  const [allTransactions, setAllTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);

  // Selected forecast month (current by default)
  const [selectedMonth, setSelectedMonth] = useState(currentForecastKey);

  // Edit state
  const [editingCat, setEditingCat] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Add new budget
  const [addingNew, setAddingNew] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newLimit, setNewLimit] = useState('');

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => { loadBudgets(); loadAccounts(); loadReceivables(); }, []);

  useEffect(() => {
    async function loadTxs() {
      setLoadingTx(true);
      try {
        // Load from all credit accounts
        const creditAccounts = accounts.filter(a => a.type === 'CREDIT');
        if (creditAccounts.length === 0 && accounts.length > 0) {
          setLoadingTx(false);
          return;
        }
        // If no accounts yet loaded, wait
        if (accounts.length === 0) { setLoadingTx(false); return; }

        let txs = [];
        for (const acc of creditAccounts) {
          const res = await fetchTransactions({ accountId: acc.id });
          const results = res.results || res || [];
          txs = txs.concat(results);
        }
        // Also load bank account transactions (e.g. rent, salary)
        const bankAccounts = accounts.filter(a => a.type === 'BANK');
        for (const acc of bankAccounts) {
          const res = await fetchTransactions({ accountId: acc.id });
          const results = res.results || res || [];
          txs = txs.concat(results);
        }
        setAllTransactions(txs);
      } catch (e) {
        console.warn('[Budget] error loading transactions:', e);
      } finally {
        setLoadingTx(false);
      }
    }
    if (accounts.length > 0) loadTxs();
  }, [accounts]);

  // ── Compute spending by category for selected month ────────────────────────
  /**
   * Group credit card transactions by billForecastDate for the selected month.
   * Bank account transactions are grouped by their actual date month.
   */
  const spendingByCategory = useMemo(() => {
    const map = {};
    allTransactions.forEach(tx => {
      if (isBillPayment(tx)) return;
      if (tx.amount > 0) return; // skip credits/income

      // Determine which month this tx belongs to
      const meta = tx.creditCardMetadata;
      const txMonth = meta?.billForecastDate || (tx.date || '').slice(0, 7);

      if (txMonth !== selectedMonth) return;

      const label = translateCategory(tx.category);
      map[label] = (map[label] || 0) + Math.abs(tx.amount);
    });
    return map; // { 'Aluguel de Carros': 1916.66, ... }
  }, [allTransactions, selectedMonth]);

  // All available months in transactions
  const availableMonths = useMemo(() => {
    const months = new Set();
    allTransactions.forEach(tx => {
      const meta = tx.creditCardMetadata;
      const m = meta?.billForecastDate || (tx.date || '').slice(0, 7);
      if (m && m !== 'Outros') months.add(m);
    });
    return [...months].sort();
  }, [allTransactions]);

  // ── Merge real spending with user-defined limits ───────────────────────────
  /**
   * budgetRows = all categories that either:
   *   (a) have real spending in selected month, OR
   *   (b) have a user-defined budget limit stored in IndexedDB
   * Each row: { category (PT label), spent, limit (0 if not set), hasLimit }
   */
  const budgetRows = useMemo(() => {
    const rows = {};

    // Add real spending categories
    Object.entries(spendingByCategory).forEach(([cat, spent]) => {
      rows[cat] = { category: cat, spent, limit: 0, hasLimit: false };
    });

    // Overlay user-defined limits
    budgets.forEach(b => {
      if (rows[b.category]) {
        rows[b.category].limit = b.limit;
        rows[b.category].hasLimit = true;
      } else {
        // Budget defined but no spending this month
        rows[b.category] = { category: b.category, spent: 0, limit: b.limit, hasLimit: true };
      }
    });

    // Sort: over budget first, then by spending desc
    return Object.values(rows).sort((a, b) => {
      const aOver = a.hasLimit && a.spent > a.limit;
      const bOver = b.hasLimit && b.spent > b.limit;
      if (aOver !== bOver) return aOver ? -1 : 1;
      return b.spent - a.spent;
    });
  }, [spendingByCategory, budgets]);

  // ── KPI totals ─────────────────────────────────────────────────────────────
  const totalSpent = useMemo(() =>
    Object.values(spendingByCategory).reduce((s, v) => s + v, 0), [spendingByCategory]);
  const totalLimit = useMemo(() =>
    budgets.reduce((s, b) => s + b.limit, 0), [budgets]);
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
    // Show last 6 available months
    const last6 = availableMonths.slice(-6);
    return last6.map(m => {
      const txMonth = allTransactions.filter(tx => {
        if (isBillPayment(tx) || tx.amount > 0) return false;
        const meta = tx.creditCardMetadata;
        return (meta?.billForecastDate || (tx.date || '').slice(0, 7)) === m;
      });
      const total = txMonth.reduce((s, t) => s + Math.abs(t.amount), 0);
      const [, mo] = m.split('-');
      return { label: MONTH_NAMES[parseInt(mo, 10) - 1].slice(0, 3), total, month: m };
    });
  }, [availableMonths, allTransactions]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSaveEdit = (cat) => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val > 0) updateBudget(cat, val);
    setEditingCat(null);
  };

  const handleAddNew = () => {
    const val = parseFloat(newLimit);
    if (newCat && !isNaN(val) && val > 0) {
      updateBudget(newCat, val);
      setNewCat('');
      setNewLimit('');
      setAddingNew(false);
    }
  };

  // All PT category labels from real transactions (for the add-new dropdown)
  const allRealCategories = useMemo(() => {
    const cats = new Set(Object.keys(spendingByCategory));
    budgets.forEach(b => cats.add(b.category));
    // Also add all translated categories from all transactions
    allTransactions.forEach(tx => {
      if (tx.category) cats.add(translateCategory(tx.category));
    });
    return [...cats].sort();
  }, [spendingByCategory, budgets, allTransactions]);

  // Navigation
  const monthIdx = availableMonths.indexOf(selectedMonth);
  const canGoPrev = monthIdx > 0;
  const canGoNext = monthIdx < availableMonths.length - 1;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Orçamento Mensal</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            Gastos reais por categoria com limites definidos por você • Dados Pluggy/Santander
          </p>
        </div>
        {/* Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '0.4rem 0.75rem' }}>
          <button
            onClick={() => canGoPrev && setSelectedMonth(availableMonths[monthIdx - 1])}
            disabled={!canGoPrev}
            style={{ border: 'none', background: 'transparent', cursor: canGoPrev ? 'pointer' : 'not-allowed', color: canGoPrev ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', minWidth: 130, textAlign: 'center' }}>
            {forecastKeyLabel(selectedMonth)}
          </span>
          <button
            onClick={() => canGoNext && setSelectedMonth(availableMonths[monthIdx + 1])}
            disabled={!canGoNext}
            style={{ border: 'none', background: 'transparent', cursor: canGoNext ? 'pointer' : 'not-allowed', color: canGoNext ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.2rem' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="dashboard-grid">
        <Card className="col-3" style={{ borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>GASTO REAL NO MÊS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: totalSpent > totalLimit && totalLimit > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
            {loadingTx ? '...' : formatCurrency(totalSpent)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {Object.keys(spendingByCategory).length} categorias detectadas
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: '4px solid var(--info)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>ORÇAMENTO DEFINIDO</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0' }}>
            {formatCurrency(totalLimit)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {categoriesWithBudget} {categoriesWithBudget === 1 ? 'categoria' : 'categorias'} com limite definido
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: `4px solid ${totalLimit > 0 ? (totalSpent <= totalLimit ? 'var(--success)' : 'var(--danger)') : 'var(--border-color)'}` }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>SALDO DO ORÇAMENTO</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: totalLimit > 0 ? (totalSpent <= totalLimit ? 'var(--success)' : 'var(--danger)') : 'var(--text-muted)' }}>
            {totalLimit > 0 ? formatCurrency(Math.abs(totalLimit - totalSpent)) : '—'}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: totalSpent > totalLimit && totalLimit > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {totalLimit > 0 ? (totalSpent <= totalLimit ? '✓ Dentro do orçamento' : '⚠ Orçamento excedido') : 'Defina limites nas categorias'}
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
        title={`Orçamento por Categoria — ${forecastKeyLabel(selectedMonth)}`}
        subtitle="Gastos reais da Pluggy. Clique em ✏ para definir um limite para a categoria."
        action={
          <Button size="sm" variant="primary" onClick={() => setAddingNew(true)} icon={Plus}>
            Adicionar Limite
          </Button>
        }
      >
        {/* Add new budget row */}
        {addingNew && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.85rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary)', marginBottom: '1rem' }}>
            <select
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              className="input"
              style={{ flex: 2, padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
            >
              <option value="">Selecione a categoria...</option>
              {allRealCategories
                .filter(c => !budgets.some(b => b.category === c))
                .map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>R$</span>
              <input
                type="number"
                placeholder="Limite mensal"
                value={newLimit}
                onChange={e => setNewLimit(e.target.value)}
                className="input"
                style={{ width: 140, padding: '0.4rem 0.6rem', fontSize: 'var(--font-size-xs)' }}
              />
            </div>
            <Button size="sm" variant="primary" onClick={handleAddNew} icon={Check}>Salvar</Button>
            <button onClick={() => { setAddingNew(false); setNewCat(''); setNewLimit(''); }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {loadingTx ? (
          <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
            Carregando transações reais...
          </p>
        ) : budgetRows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
            Nenhuma transação encontrada para {forecastKeyLabel(selectedMonth)}.
          </p>
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
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: getCategoryColor(row.category), flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', truncate: 'ellipsis' }}>
                        {row.category}
                      </span>
                      {isOver && <Badge variant="danger"><AlertTriangle size={10} style={{ marginRight: 3 }} />Estourado</Badge>}
                      {isNear && !isOver && <Badge variant="warning">Atenção</Badge>}
                      {!row.hasLimit && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>sem limite definido</span>
                      )}
                    </div>

                    {/* Spent / Limit + edit controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      {isEditing ? (
                        <>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>R$</span>
                          <input
                            type="number"
                            defaultValue={row.limit || ''}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveEdit(row.category)}
                            autoFocus
                            className="input"
                            style={{ width: 100, padding: '0.2rem 0.5rem', fontSize: 'var(--font-size-xs)' }}
                          />
                          <button onClick={() => handleSaveEdit(row.category)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--success)' }}>
                            <Check size={15} />
                          </button>
                          <button onClick={() => setEditingCat(null)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: isOver ? 'var(--danger)' : 'var(--text-primary)' }}>
                            {formatCurrency(row.spent)}
                          </span>
                          {row.hasLimit && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                              / {formatCurrency(row.limit)}
                            </span>
                          )}
                          <button
                            onClick={() => { setEditingCat(row.category); setEditValue(row.limit || ''); }}
                            title="Definir limite"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          {row.hasLimit && (
                            <button
                              onClick={() => deleteBudget(row.category)}
                              title="Remover limite"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '0.2rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar (only if limit defined) */}
                  {row.hasLimit && row.limit > 0 && (
                    <>
                      <ProgressBar percent={Math.min(100, pct)} color={barColor} height={9} />
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {pct}% utilizado
                        {isOver
                          ? ` • Excedeu em ${formatCurrency(row.spent - row.limit)}`
                          : ` • Restam ${formatCurrency(row.limit - row.spent)}`}
                      </span>
                    </>
                  )}

                  {/* No limit: just show the spend bar relative to month total */}
                  {!row.hasLimit && totalSpent > 0 && (
                    <>
                      <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (row.spent / totalSpent) * 100)}%`, backgroundColor: getCategoryColor(row.category), borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {Math.round((row.spent / totalSpent) * 100)}% do total gasto no mês • Clique em ✏ para definir um limite
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Hint when no limits are set */}
        {!loadingTx && budgets.length === 0 && budgetRows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <Info size={18} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>
              Você ainda não definiu limites de orçamento. Clique no ícone <strong>✏</strong> ao lado de qualquer categoria ou use o botão <strong>+ Adicionar Limite</strong> para começar a controlar seus gastos.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
