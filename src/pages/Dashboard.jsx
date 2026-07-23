import React, { useEffect, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  CreditCard,
  Plus,
  Sparkles,
  Info,
  PiggyBank,
  Percent,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { BalanceChart } from '../components/charts/BalanceChart';
import { ExpenseByCategoryChart } from '../components/charts/ExpenseByCategoryChart';
import { IncomeVsExpenseChart } from '../components/charts/IncomeVsExpenseChart';
import { useAccountStore } from '../stores/accountStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useInvestmentStore } from '../stores/investmentStore';
import { useBudgetStore } from '../stores/budgetStore';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency, formatDateRelative } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import { getCategoryColor } from '../utils/colors';
import {
  buildIncomeExpenseSeries,
  buildNetWorthSeries,
  monthCashflow,
  monthOverMonth,
  weeklyRecap,
  buildInsights,
  currentYm,
  isExpenseTx,
} from '../utils/analytics';
import { calculateNetWorth } from '../utils/calculations';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { loadAccounts, accounts, loans } = useAccountStore();
  const { loadTransactions, transactions } = useTransactionStore();
  const { loadInvestments, investments, getTotalInvested } = useInvestmentStore();
  const { loadBudgets, budgets } = useBudgetStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    loadAccounts();
    loadTransactions();
    loadInvestments();
    loadBudgets();
  }, []);

  const summary = useMemo(
    () => calculateNetWorth(accounts, investments, loans),
    [accounts, investments, loans]
  );
  const totalInvestments = getTotalInvested();
  const ym = currentYm();
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'usuário';

  const netWorthSeries = useMemo(
    () => buildNetWorthSeries(transactions, accounts, investments, loans, 6, ym),
    [transactions, accounts, investments, loans, ym]
  );

  const incomeExpenseSeries = useMemo(
    () => buildIncomeExpenseSeries(transactions, 6, ym),
    [transactions, ym]
  );

  const cashflow = useMemo(() => monthCashflow(transactions, ym), [transactions, ym]);
  const mom = useMemo(() => monthOverMonth(transactions, ym), [transactions, ym]);
  const recap = useMemo(() => weeklyRecap(transactions), [transactions]);
  const insights = useMemo(() => buildInsights(transactions, ym), [transactions, ym]);

  const dynamicCategoryBudgets = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      if (!isExpenseTx(t)) return;
      if (ymFromMatch(t, ym)) {
        const catLabel = translateCategory(t.category);
        map[catLabel] = (map[catLabel] || 0) + Math.abs(t.amount);
      }
    });

    return Object.entries(map)
      .map(([category, spent]) => {
        const existingBudget = budgets.find((b) => b.category === category);
        const limit = existingBudget ? existingBudget.limit : Math.max(1000, Math.ceil(spent * 1.25));
        return { category, spent: Number(spent.toFixed(2)), limit };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);
  }, [transactions, budgets, ym]);

  const bankCount = accounts.filter((a) => a.type === 'BANK').length;
  const creditCount = accounts.filter((a) => a.type === 'CREDIT').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Olá, {displayName}!
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Visão consolidada das suas contas sincronizadas via Open Finance.
          </p>
        </div>
        <div className="page-header__actions">
          <Link to="/connect" style={{ textDecoration: 'none' }}>
            <Button icon={Plus}>Conectar Nova Conta</Button>
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card className="col-3" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Patrimônio Líquido
            </span>
            <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: summary.netWorth >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
            {formatCurrency(summary.netWorth)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Ativos: {formatCurrency(summary.bankBalance + totalInvestments)} • Dívidas: -{formatCurrency(summary.creditDebt)}
          </span>
        </Card>

        <Card className="col-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Saldo em Contas
            </span>
            <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--text-primary)' }}>
            {formatCurrency(summary.bankBalance)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {bankCount} {bankCount === 1 ? 'conta bancária' : 'contas bancárias'}
          </span>
        </Card>

        <Card className="col-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Taxa de Poupança
            </span>
            <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--info)' }}>
              <Percent size={18} />
            </div>
          </div>
          <h2
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 700,
              margin: '0.5rem 0',
              color: (cashflow.savingsRate ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {cashflow.savingsRate == null ? '—' : `${cashflow.savingsRate.toFixed(0)}%`}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Líquido do mês: {formatCurrency(cashflow.net)}
          </span>
        </Card>

        <Card className="col-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Gastos vs Mês Ant.
            </span>
            <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'rgba(244, 63, 94, 0.12)', color: 'var(--danger)' }}>
              <PiggyBank size={18} />
            </div>
          </div>
          <h2
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 700,
              margin: '0.5rem 0',
              color: mom.expenseDeltaPct > 0 ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {mom.expenseDeltaPct > 0 ? '+' : ''}
            {mom.expenseDeltaPct.toFixed(0)}%
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Este mês {formatCurrency(cashflow.expense)} · ant. {formatCurrency(mom.previous.expense)}
          </span>
        </Card>
      </div>

      {(insights.length > 0 || recap.current.total > 0) && (
        <div className="dashboard-grid">
          <Card className="col-8" title="Insights" subtitle="O que mudou nas suas finanças">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.35rem' }}>
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderLeft: `3px solid ${
                      ins.type === 'positive' ? 'var(--success)' : ins.type === 'warning' ? 'var(--danger)' : 'var(--info)'
                    }`,
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {ins.text}
                </div>
              ))}
              {insights.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Conecte contas e sincronize transações para ver insights.
                </p>
              )}
            </div>
          </Card>

          <Card className="col-4" title="Recap da Semana" subtitle="Últimos 7 dias">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.35rem' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>GASTOS</span>
                <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: '0.25rem 0' }}>
                  {formatCurrency(recap.current.total)}
                </h3>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: recap.deltaPct > 0 ? 'var(--danger)' : 'var(--success)',
                  }}
                >
                  {recap.deltaPct > 0 ? '+' : ''}
                  {recap.deltaPct}% vs semana anterior
                </span>
              </div>
              {recap.current.topCategory && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  Maior categoria: <strong>{recap.current.topCategory.name}</strong>
                  {' · '}
                  {formatCurrency(recap.current.topCategory.value)}
                </div>
              )}
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {creditCount} cartão(ões) · fatura aberta {formatCurrency(summary.creditDebt)}
              </div>
              <Link to="/subscriptions" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Ver assinaturas e agenda →
              </Link>
            </div>
          </Card>
        </div>
      )}

      <div className="dashboard-grid">
        <Card className="col-8" title="Evolução Patrimonial" subtitle="Reconstruída a partir do fluxo mensal">
          <BalanceChart data={netWorthSeries} />
        </Card>
        <Card className="col-4" title="Gastos por Categoria" subtitle="Mês atual">
          <ExpenseByCategoryChart ym={ym} />
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card className="col-6" title="Fluxo de Caixa" subtitle="Receitas vs despesas">
          <IncomeVsExpenseChart data={incomeExpenseSeries} />
        </Card>

        <Card
          className="col-6"
          title={`Últimas Transações (${transactions.length})`}
          subtitle="Sincronizadas via Open Finance"
          action={
            <Link to="/transactions" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Ver todas →
            </Link>
          }
        >
          {transactions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Info size={24} style={{ marginBottom: '0.5rem' }} />
              <p>Nenhuma transação recente encontrada.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="list-row" style={{ padding: '0.6rem 0.85rem' }}>
                  <div className="list-row-main" style={{ gap: '0.75rem' }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: tx.amount < 0 ? 'var(--danger-bg)' : 'var(--success-bg)',
                        color: tx.amount < 0 ? 'var(--danger)' : 'var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {tx.amount < 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 600,
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          margin: 0,
                        }}
                      >
                        {tx.description}
                      </p>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {translateCategory(tx.category)} • {formatDateRelative(tx.date)}
                      </span>
                    </div>
                  </div>
                  <span
                    className="list-row-amount"
                    style={{
                      fontWeight: 700,
                      fontSize: 'var(--font-size-sm)',
                      color: tx.amount < 0 ? 'var(--text-primary)' : 'var(--success)',
                    }}
                  >
                    {tx.amount < 0 ? `- ${formatCurrency(Math.abs(tx.amount))}` : `+ ${formatCurrency(tx.amount)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {dynamicCategoryBudgets.length > 0 && (
        <Card
          title="Resumo do Orçamento"
          subtitle="Gastos do mês por categoria"
          action={
            <Link to="/budget" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Gerenciar Limites →
            </Link>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '1.25rem', marginTop: '0.75rem' }}>
            {dynamicCategoryBudgets.map((b) => {
              const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
              const color = getCategoryColor(b.category);
              return (
                <div
                  key={b.category}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.category}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(b.spent)} / {formatCurrency(b.limit)}
                    </span>
                  </div>
                  <ProgressBar percent={pct} color={color} height={8} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}% do teto utilizado</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="dashboard-grid">
        <Card className="col-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>INVESTIMENTOS</span>
              <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: '0.35rem 0' }}>{formatCurrency(totalInvestments)}</h3>
              <Link to="/investments" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Ver carteira →
              </Link>
            </div>
            <TrendingUp size={20} style={{ color: 'var(--info)' }} />
          </div>
        </Card>
        <Card className="col-6">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>FATURAS / CRÉDITO</span>
              <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: '0.35rem 0', color: 'var(--danger)' }}>
                {formatCurrency(summary.creditDebt)}
              </h3>
              <Link to="/credit-cards" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                Ver cartões →
              </Link>
            </div>
            <CreditCard size={20} style={{ color: 'var(--danger)' }} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ymFromMatch(t, ym) {
  const d = t?.date ? String(t.date).slice(0, 7) : null;
  return d === ym;
}
