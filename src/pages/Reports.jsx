import React, { useEffect, useMemo, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { BalanceChart } from '../components/charts/BalanceChart';
import { ExpenseByCategoryChart } from '../components/charts/ExpenseByCategoryChart';
import { IncomeVsExpenseChart } from '../components/charts/IncomeVsExpenseChart';
import { CategoryTrendChart } from '../components/charts/CategoryTrendChart';
import { MerchantSpendChart } from '../components/charts/MerchantSpendChart';
import { CashflowSankeyChart } from '../components/charts/CashflowSankeyChart';
import { DailySpendHeatmap } from '../components/charts/DailySpendHeatmap';
import { useTransactionStore } from '../stores/transactionStore';
import { useAccountStore } from '../stores/accountStore';
import { useInvestmentStore } from '../stores/investmentStore';
import { formatCurrency } from '../utils/formatters';
import {
  buildIncomeExpenseSeries,
  buildNetWorthSeries,
  buildCategoryTrend,
  getTopCategoriesForTrend,
  expensesByMerchant,
  expensesByCategory,
  buildCashflowSankey,
  dailyExpenseHeatmap,
  filterTransactions,
  monthCashflow,
  exportReportCsv,
  currentYm,
  lastNMonths,
  monthLabel,
} from '../utils/analytics';
import { isInitialEmpty } from '../utils/loading';

const PERIOD_OPTIONS = [
  { id: '3', label: '3 meses', months: 3 },
  { id: '6', label: '6 meses', months: 6 },
  { id: '12', label: '12 meses', months: 12 },
];

export function Reports() {
  const { loadTransactions, transactions, loading: txLoading, lastUpdated: txAt } = useTransactionStore();
  const { loadAccounts, accounts, loans, loading: accLoading, lastUpdated: accAt } = useAccountStore();
  const { loadInvestments, investments } = useInvestmentStore();
  const [monthsCount, setMonthsCount] = useState(6);
  const [accountId, setAccountId] = useState('all');
  const [tab, setTab] = useState('overview');

  const ym = currentYm();

  useEffect(() => {
    loadTransactions();
    loadAccounts();
    loadInvestments();
  }, []);

  const filtered = useMemo(() => {
    const fromYm = lastNMonths(monthsCount, ym)[0];
    return filterTransactions(transactions, { accountId, fromYm, toYm: ym });
  }, [transactions, accountId, monthsCount, ym]);

  const netWorthSeries = useMemo(
    () => buildNetWorthSeries(filtered, accounts, investments, loans, monthsCount, ym),
    [filtered, accounts, investments, loans, monthsCount, ym]
  );
  const incomeExpense = useMemo(
    () => buildIncomeExpenseSeries(filtered, monthsCount, ym),
    [filtered, monthsCount, ym]
  );
  const trendCats = useMemo(
    () => getTopCategoriesForTrend(filtered, monthsCount, 5, ym),
    [filtered, monthsCount, ym]
  );
  const categoryTrend = useMemo(
    () => buildCategoryTrend(filtered, monthsCount, 5, ym),
    [filtered, monthsCount, ym]
  );
  const merchants = useMemo(() => expensesByMerchant(filtered, { limit: 10, ym }), [filtered, ym]);
  const categories = useMemo(() => expensesByCategory(filtered, { limit: 10, ym }), [filtered, ym]);
  const sankey = useMemo(() => buildCashflowSankey(filtered, ym, 6), [filtered, ym]);
  const heatmap = useMemo(() => dailyExpenseHeatmap(filtered, ym), [filtered, ym]);
  const monthFlow = useMemo(() => monthCashflow(filtered, ym), [filtered, ym]);

  const handleExportCsv = () => {
    const csv = exportReportCsv({ incomeExpense, categories, merchants });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meuflux-relatorio-${ym}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
  };

  const bankAccounts = accounts.filter((a) => a.type === 'BANK' || a.type === 'CREDIT');
  const isInitialLoad =
    isInitialEmpty(transactions, txLoading, txAt) || isInitialEmpty(accounts, accLoading, accAt);

  if (isInitialLoad) {
    return (
      <PageLoadingSkeleton
        showKpis={false}
        showTimeline={false}
        showChart
        showList={false}
        label="Carregando relatórios…"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }} className="reports-page">
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Relatórios & Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Análise do período · {monthLabel(ym)} · líquido {formatCurrency(monthFlow.net)}
          </p>
        </div>
        <div className="page-header__actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="outline" icon={Download} onClick={handleExportCsv}>
            CSV
          </Button>
          <Button variant="outline" icon={Download} onClick={handleExportPdf}>
            <span className="hide-mobile">Exportar PDF</span>
            <span className="show-mobile">PDF</span>
          </Button>
        </div>
      </div>

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <SegmentedControl
            layoutId="reports-period"
            value={String(monthsCount)}
            onChange={(id) => setMonthsCount(Number(id))}
            options={PERIOD_OPTIONS.map((opt) => ({ id: String(opt.months), label: opt.label }))}
          />
          <select
            className="input"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            style={{ maxWidth: 220, fontSize: 'var(--font-size-sm)' }}
          >
            <option value="all">Todas as contas</option>
            {bankAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div style={{ marginLeft: 'auto' }}>
            <SegmentedControl
              layoutId="reports-tab"
              value={tab}
              onChange={setTab}
              options={[
                { id: 'overview', label: 'Visão geral' },
                { id: 'trends', label: 'Tendências' },
                { id: 'flow', label: 'Fluxo Sankey' },
              ]}
            />
          </div>
        </div>
      </Card>

      {tab === 'overview' && (
        <>
          <div className="dashboard-grid">
            <Card className="col-8" title="Evolução Patrimonial Consolidada">
              <BalanceChart data={netWorthSeries} height={300} />
            </Card>
            <Card className="col-4" title="Despesas por Categoria (mês)">
              <ExpenseByCategoryChart data={categories.slice(0, 7)} height={300} />
            </Card>
          </div>
          <div className="dashboard-grid">
            <Card className="col-12" title="Balanço Mensal (Receita vs Despesa)">
              <IncomeVsExpenseChart data={incomeExpense} height={320} />
            </Card>
          </div>
          <div className="dashboard-grid">
            <Card className="col-6" title="Ranking de Merchants (mês)">
              <MerchantSpendChart data={merchants} height={300} />
            </Card>
            <Card className="col-6" title={`Calendário de gastos · ${monthLabel(ym)}`}>
              <DailySpendHeatmap data={heatmap} />
            </Card>
          </div>
        </>
      )}

      {tab === 'trends' && (
        <div className="dashboard-grid">
          <Card className="col-12" title="Tendência por categoria (empilhado)">
            <CategoryTrendChart data={categoryTrend} categories={trendCats} height={340} />
          </Card>
          <Card className="col-6" title="Top merchants">
            <MerchantSpendChart data={merchants} height={300} />
          </Card>
          <Card className="col-6" title="Categorias do mês">
            <ExpenseByCategoryChart data={categories.slice(0, 7)} height={300} />
          </Card>
        </div>
      )}

      {tab === 'flow' && (
        <div className="dashboard-grid">
          <Card className="col-12" title={`Fluxo de caixa · ${monthLabel(ym)}`} subtitle="Receitas → categorias / saldo">
            <CashflowSankeyChart data={sankey} height={380} />
            {sankey.summary && (
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem', fontSize: 'var(--font-size-sm)' }}>
                <span>Receitas: <strong style={{ color: 'var(--success)' }}>{formatCurrency(sankey.summary.income)}</strong></span>
                <span>Despesas: <strong style={{ color: 'var(--danger)' }}>{formatCurrency(sankey.summary.expense)}</strong></span>
                <span>Líquido: <strong>{formatCurrency(sankey.summary.net)}</strong></span>
                {sankey.summary.savingsRate != null && (
                  <span>Poupança: <strong>{sankey.summary.savingsRate}%</strong></span>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
