import React, { useEffect, useMemo } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  ArrowDownRight, 
  ArrowUpRight, 
  CreditCard, 
  Plus, 
  Sparkles,
  ShieldAlert,
  Info
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
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
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { loadAccounts, accounts, getSummary, loading: accLoading } = useAccountStore();
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

  const summary = getSummary();
  const totalInvestments = getTotalInvested();
  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'usuário';

  // Dynamic budget calculations based on real transaction category expenses
  const dynamicCategoryBudgets = useMemo(() => {
    const map = {};

    // Calculate real category expenses from Pluggy transactions
    transactions.forEach(t => {
      if (t.description?.toUpperCase().includes('PAGAMENTO DE FATURA')) return;
      const catLabel = translateCategory(t.category);
      const amt = Math.abs(t.amount);
      if (!map[catLabel]) map[catLabel] = 0;
      map[catLabel] += amt;
    });

    // Merge with user configured budgets or set default targets
    const list = Object.entries(map).map(([category, spent]) => {
      const existingBudget = budgets.find(b => b.category === category);
      const limit = existingBudget ? existingBudget.limit : Math.max(1000, Math.ceil(spent * 1.25));
      return {
        category,
        spent: Number(spent.toFixed(2)),
        limit
      };
    }).sort((a, b) => b.spent - a.spent);

    return list.slice(0, 6); // Top 6 budget categories
  }, [transactions, budgets]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header Greeting & Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Olá, {displayName}! 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Visão consolidada das suas contas sincronizadas via Pluggy.ai.
          </p>
        </div>
        <Link to="/connect" style={{ textDecoration: 'none' }}>
          <Button icon={Plus}>Conectar Nova Conta</Button>
        </Link>
      </div>

      {/* KPI Cards Row - Strictly Real Data */}
      <div className="dashboard-grid">
        {/* Net Worth Card */}
        <Card className="col-3" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Patrimônio Líquido Real
            </span>
            <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: summary.netWorth >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
            {formatCurrency(summary.netWorth)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Ativos: {formatCurrency(summary.bankBalance + totalInvestments)} • Faturas: -{formatCurrency(summary.creditDebt)}
          </span>
        </Card>

        {/* Bank Accounts Balance */}
        <Card className="col-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Saldo em Conta Corrente
            </span>
            <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
              <Wallet size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--text-primary)' }}>
            {formatCurrency(summary.bankBalance)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {accounts.filter(a => a.type === 'BANK').length} Conta Banco Santander
          </span>
        </Card>

        {/* Investments Card */}
        <Card className="col-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Investimentos Reais
            </span>
            <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--info)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--text-primary)' }}>
            {formatCurrency(totalInvestments)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)' }}>
            CDB Santander (100% CDI)
          </span>
        </Card>

        {/* Credit Debt Card */}
        <Card className="col-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Fatura Cartão Santander
            </span>
            <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-md)', background: 'rgba(244, 63, 94, 0.12)', color: 'var(--danger)' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--danger)' }}>
            {formatCurrency(summary.creditDebt)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Santander Unique Visa Infinite
          </span>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="dashboard-grid">
        {/* Evolution Chart */}
        <Card className="col-8" title="Evolução de Saldos Reais" subtitle="Banco Santander">
          <BalanceChart />
        </Card>

        {/* Expense By Category (Automated from real Pluggy data) */}
        <Card className="col-4" title="Gastos por Categoria Real" subtitle="Principais despesas das transações">
          <ExpenseByCategoryChart />
        </Card>
      </div>

      {/* Cashflow and Transactions Row */}
      <div className="dashboard-grid">
        {/* Income vs Expense Chart */}
        <Card className="col-6" title="Fluxo de Caixa Real" subtitle="Entradas e saídas Santander">
          <IncomeVsExpenseChart />
        </Card>

        {/* Recent Transactions List */}
        <Card 
          className="col-6" 
          title={`Últimas Transações Reais (${transactions.length})`} 
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
              {transactions.slice(0, 5).map(tx => (
                <div key={tx.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: tx.amount < 0 ? 'var(--danger-bg)' : 'var(--success-bg)',
                      color: tx.amount < 0 ? 'var(--danger)' : 'var(--success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {tx.amount < 0 ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                        {tx.description}
                      </p>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {translateCategory(tx.category)} • {formatDateRelative(tx.date)}
                      </span>
                    </div>
                  </div>
                  <span style={{
                    fontWeight: 700,
                    fontSize: 'var(--font-size-sm)',
                    color: tx.amount < 0 ? 'var(--text-primary)' : 'var(--success)'
                  }}>
                    {tx.amount < 0 ? `- ${formatCurrency(Math.abs(tx.amount))}` : `+ ${formatCurrency(tx.amount)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Budget Progress Summary from Real Category Expenses */}
      {dynamicCategoryBudgets.length > 0 && (
        <Card 
          title="Resumo do Orçamento Mensal Real" 
          subtitle="Acompanhamento de gastos por categoria baseado nas suas despesas reais"
          action={
            <Link to="/budget" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Gerenciar Limites →
            </Link>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginTop: '0.75rem' }}>
            {dynamicCategoryBudgets.map(b => {
              const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
              const color = getCategoryColor(b.category);
              return (
                <div key={b.category} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.category}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(b.spent)} / {formatCurrency(b.limit)}</span>
                  </div>
                  <ProgressBar percent={pct} color={color} height={8} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {pct}% do teto utilizado
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
