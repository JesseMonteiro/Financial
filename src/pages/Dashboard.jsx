import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  CreditCard,
  Plus,
  Info,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { Stagger, StaggerItem } from '../components/motion/Stagger';
import { BalanceChart } from '../components/charts/BalanceChart';
import { ExpenseByCategoryChart } from '../components/charts/ExpenseByCategoryChart';
import { IncomeVsExpenseChart } from '../components/charts/IncomeVsExpenseChart';
import { InsightsCarousel, KpiCarousel, CreditPurchasesCarousel } from '../components/DashboardCarousels';
import { CategoryIcon } from '../components/CategoryIcon';
import { useAccountStore } from '../stores/accountStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useInvestmentStore } from '../stores/investmentStore';
import { useBudgetStore } from '../stores/budgetStore';
import { useMealBenefitStore } from '../stores/mealBenefitStore';
import { useAuthStore } from '../stores/authStore';
import { useCategoryStore } from '../stores/categoryStore';
import { formatCurrency, formatDateRelative } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import { getCategoryColor } from '../utils/colors';
import {
  buildIncomeExpenseSeries,
  buildNetWorthSeries,
  buildRecentCreditPurchases,
  monthCashflow,
  monthOverMonth,
  weeklyRecap,
  buildInsights,
  currentYm,
  isExpenseTx,
} from '../utils/analytics';
import { calculateNetWorth, sumOpenBillsTotal } from '../utils/calculations';
import { isInitialEmpty } from '../utils/loading';
import { Link } from 'react-router-dom';
import { ItemDetailSheet } from '../components/ItemDetailSheet';
import { fromTransaction, rowActivateProps, categoryOptionsForItem, applyingCategory } from '../utils/lineItemDetail';
import { fetchCategories } from '../services/api';
import { accountById } from '../components/AccountIcon';
import { asOfForBudgetMonth, mergeBudgetRows } from '../utils/budgetPeriod';
import { mealSpendByCategory } from '../utils/mealBenefits';
import { useCreditDataStore } from '../stores/creditDataStore';

function insightAccent(type) {
  if (type === 'positive') return 'var(--success)';
  if (type === 'warning') return 'var(--danger)';
  return 'var(--info)';
}

export function Dashboard() {
  const { loadAccounts, accounts, loans, loading: accLoading, lastUpdated: accAt } = useAccountStore();
  const { loadTransactions, transactions, loading: txLoading, lastUpdated: txAt, updateOpenFinanceCategory } = useTransactionStore();
  const { loadInvestments, investments, getTotalInvested } = useInvestmentStore();
  const { loadBudgets, budgets } = useBudgetStore();
  const { loadMealBenefits, benefits: mealBenefits, purchases: mealPurchases } = useMealBenefitStore();
  const { loadCategories, categories: purchaseCategories } = useCategoryStore();
  const { loadForAccounts, transactionsByAccount } = useCreditDataStore();
  const user = useAuthStore((s) => s.user);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pluggyCategories, setPluggyCategories] = useState([]);
  const [showAllInsights, setShowAllInsights] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadTransactions();
    loadInvestments();
    loadBudgets();
    loadMealBenefits();
    loadCategories();
    fetchCategories({ force: true }).then((list) => setPluggyCategories(Array.isArray(list) ? list : [])).catch(() => setPluggyCategories([]));
  }, []);

  const creditCards = useMemo(() => accounts.filter((a) => a.type === 'CREDIT'), [accounts]);
  const creditCardIds = useMemo(() => creditCards.map((c) => c.id).filter(Boolean), [creditCards]);

  useEffect(() => {
    if (accLoading || creditCardIds.length === 0) return;
    loadForAccounts(creditCardIds);
  }, [accLoading, creditCardIds.join(','), loadForAccounts]);

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
    const mealMap = mealSpendByCategory(mealBenefits, mealPurchases, ym);
    const rows = mergeBudgetRows({
      spentBankMap: map,
      spentMealMap: mealMap,
      budgets,
      ym,
      asOfDate: asOfForBudgetMonth(ym),
    });
    return rows
      .map((row) => ({
        category: row.category,
        spent: row.spent,
        limit: row.hasLimit ? row.limit : Math.max(1000, Math.ceil(row.spent * 1.25)),
        hasLimit: row.hasLimit,
        period: row.period,
        spentMeal: row.spentMeal,
      }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 6);
  }, [transactions, budgets, ym, mealBenefits, mealPurchases]);

  const bankCount = accounts.filter((a) => a.type === 'BANK').length;
  const creditCount = creditCards.length;
  const openBillsTotal = useMemo(() => sumOpenBillsTotal(accounts), [accounts]);
  const recentCreditPurchases = useMemo(() => {
    const fromLedger = creditCardIds.flatMap((id) => transactionsByAccount[id] || []);
    const pool = fromLedger.length > 0 ? fromLedger : transactions;
    return buildRecentCreditPurchases(pool, creditCards, { days: 15, limit: 24 });
  }, [creditCardIds, creditCards, transactionsByAccount, transactions]);
  const isInitialLoad =
    isInitialEmpty(accounts, accLoading, accAt) || isInitialEmpty(transactions, txLoading, txAt);

  if (isInitialLoad) {
    return (
      <PageLoadingSkeleton
        showKpis
        kpiCount={2}
        showTimeline={false}
        showChart
        showList
        label="Carregando dashboard…"
      />
    );
  }

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

      <Stagger className="dashboard-summary-row">
        <StaggerItem>
          <InsightsCarousel
            insights={insights}
            onShowAll={insights.length > 0 ? () => setShowAllInsights(true) : undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCarousel
            summary={summary}
            totalInvestments={totalInvestments}
            bankCount={bankCount}
            cashflow={cashflow}
            mom={mom}
            netWorthSeries={netWorthSeries}
            incomeExpenseSeries={incomeExpenseSeries}
          />
        </StaggerItem>
      </Stagger>

      <CreditPurchasesCarousel
        purchases={recentCreditPurchases}
        onSelect={(purchase) =>
          setSelectedItem(
            fromTransaction(purchase.source, purchase.accountName || undefined)
          )
        }
      />

      {recap.current.total > 0 && (
        <Card title="Recap da Semana" subtitle="Últimos 7 dias">
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
              {creditCount} cartão(ões) · fatura aberta {formatCurrency(openBillsTotal)}
            </div>
            <Link to="/agenda" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Ver agenda de contas →
            </Link>
          </div>
        </Card>
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
                <div
                  key={tx.id}
                  {...rowActivateProps(() => setSelectedItem(fromTransaction(tx, accountById(accounts, tx.accountId)?.name)))}
                  style={{ padding: '0.6rem 0.85rem' }}
                >
                  <div className="list-row-main" style={{ gap: '0.75rem' }}>
                    <CategoryIcon
                      category={tx.category}
                      categories={purchaseCategories}
                      isCredit={tx.amount >= 0}
                      title={tx.description}
                      merchant={tx.merchant}
                      size={32}
                    />
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
          subtitle="Gasto do mês (banco/cartão e VA/VR) contra a verba já liberada"
          action={
            <Link to="/budget" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              Gerenciar metas →
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
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {pct}% da verba{b.hasLimit ? ' liberada' : ''}
                    {b.spentMeal > 0 ? ` · ${formatCurrency(b.spentMeal)} VA/VR` : ''}
                  </span>
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
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>SALDO DEVEDOR</span>
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
      {showAllInsights && (
        <div className="modal-overlay" onClick={() => setShowAllInsights(false)} role="presentation">
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="Insights"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>Insights</h3>
              <button
                type="button"
                onClick={() => setShowAllInsights(false)}
                style={{
                  appearance: 'none',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Fechar
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '60vh', overflow: 'auto' }}>
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: `linear-gradient(145deg, color-mix(in srgb, ${insightAccent(ins.type)} 28%, transparent), color-mix(in srgb, ${insightAccent(ins.type)} 12%, transparent)), var(--bg-tertiary)`,
                    border: `1px solid color-mix(in srgb, ${insightAccent(ins.type)} 40%, var(--border-color))`,
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {ins.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          categoryOptions={categoryOptionsForItem(selectedItem, pluggyCategories, purchaseCategories)}
          onChangeCategory={async (option) => {
            await updateOpenFinanceCategory(selectedItem.sourceId, option.value, option.label);
            setSelectedItem(applyingCategory(selectedItem, option));
          }}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

function ymFromMatch(t, ym) {
  const d = t?.date ? String(t.date).slice(0, 7) : null;
  return d === ym;
}
