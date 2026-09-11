import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useReceivableStore } from '../stores/receivableStore';
import { useCreditDataStore } from '../stores/creditDataStore';
import { getLocalSetting, setLocalSetting, getMonthlySalaries, saveMonthlySalaries } from '../services/storage';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PaidCheckbox } from '../components/ui/PaidCheckbox';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import {
  buildCreditCardBills,
} from '../utils/creditBillPeriod';
import { resolveMonthSalary, withSavedMonthSalary } from '../utils/monthSalary';
import {
  buildFinancialMomentMonthList,
  computeFinancialMomentMonth,
  computeFinancialMomentMonthsStatus,
} from '../utils/financialMomentMonth';
import { attrSelector, bindSnapSelect, centerChild } from '../utils/snapCarousel';
import { useIsMobile } from '../hooks/useMediaQuery';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Save,
  Repeat
} from 'lucide-react';
import { AccountIcon, accountById } from '../components/AccountIcon';

function currentMonthYm(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function FinancialMoment() {
  const { accounts, loadAccounts, loading: accountsLoading, lastUpdated: accountsUpdatedAt } = useAccountStore();
  const { transactions, loadTransactions, setManualPaid, pending } = useTransactionStore();
  const { receivables, loadReceivables } = useReceivableStore();
  const {
    loadForAccounts,
    loading: creditLoading,
    lastUpdatedByAccount,
    transactionsByAccount,
    billsByAccount,
  } = useCreditDataStore();
  const isMobile = useIsMobile();

  const [selectedMonth, setSelectedMonth] = useState('');

  // Salary state
  const [salaries, setSalaries] = useState({});
  const [salaryInput, setSalaryInput] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);

  const timelineRef = useRef(null);
  const ignoreMonthScrollRef = useRef(false);
  const selectedMonthRef = useRef(selectedMonth);
  selectedMonthRef.current = selectedMonth;

  // Load stores + salaries (Supabase with localStorage heal)
  useEffect(() => {
    loadAccounts();
    loadTransactions();
    loadReceivables();

    (async () => {
      const stored = await getMonthlySalaries();
      // Also pull legacy local-only key if getMonthlySalaries returned empty
      const legacy = getLocalSetting('monthly_salaries', {});
      const merged =
        Object.keys(stored || {}).length > 0
          ? stored
          : legacy;
      setSalaries(merged || {});
      if (
        Object.keys(legacy).length > 0 &&
        Object.keys(stored || {}).length === 0
      ) {
        await saveMonthlySalaries(legacy);
      }
    })();
  }, []);

  const creditCards = useMemo(() => accounts.filter(a => a.type === 'CREDIT'), [accounts]);
  const bankAccounts = useMemo(() => accounts.filter(a => a.type === 'BANK'), [accounts]);
  const cardIds = useMemo(() => creditCards.map((c) => c.id), [creditCards]);
  const bankAccountIds = useMemo(() => bankAccounts.map((a) => a.id), [bankAccounts]);
  const bankAccountNameById = useMemo(() => {
    const map = {};
    bankAccounts.forEach((a) => {
      map[a.id] = a.name || a.marketingName || 'Conta conectada';
    });
    return map;
  }, [bankAccounts]);

  useEffect(() => {
    if (accountsLoading) return;
    if (!cardIds.length) return;
    loadForAccounts(cardIds);
  }, [cardIds.join(','), accountsLoading, loadForAccounts]);

  const cardBills = useMemo(() => {
    const bills = [];
    for (const id of cardIds) bills.push(...(billsByAccount[id] || []));
    return bills;
  }, [cardIds, billsByAccount]);

  const cardTransactions = useMemo(() => {
    const txs = [];
    for (const id of cardIds) txs.push(...(transactionsByAccount[id] || []));
    return txs;
  }, [cardIds, transactionsByAccount]);

  const hasCachedCardData =
    cardIds.length === 0 || cardIds.every((id) => lastUpdatedByAccount[id]);
  const isPageLoading =
    accountsLoading ||
    accountsUpdatedAt == null ||
    (cardIds.length > 0 && !hasCachedCardData && creditLoading);

  const creditBillPeriod = useMemo(
    () =>
      buildCreditCardBills({
        transactions: cardTransactions,
        officialBills: cardBills,
        creditCards,
        selectedCardId: 'all',
      }),
    [cardTransactions, cardBills, creditCards]
  );

  // 12-month calendar list around today
  const monthList = useMemo(() => buildFinancialMomentMonthList(), []);

  // Default to current calendar month
  useEffect(() => {
    if (!selectedMonth) {
      setSelectedMonth(currentMonthYm());
    }
  }, [selectedMonth]);

  // Sync salary input when month or salaries change
  useEffect(() => {
    if (selectedMonth) {
      const val = resolveMonthSalary(salaries, selectedMonth);
      setSalaryInput(String(val));
    }
  }, [selectedMonth, salaries]);

  // Auto-scroll selected month tab into view
  useEffect(() => {
    if (!timelineRef.current || !selectedMonth || isPageLoading) return undefined;
    let releaseTimer;
    const timer = setTimeout(() => {
      const container = timelineRef.current;
      const selectedEl = container?.querySelector(attrSelector('data-month-tab', selectedMonth));
      if (!selectedEl) return;
      ignoreMonthScrollRef.current = true;
      const moved = centerChild(container, selectedEl);
      releaseTimer = window.setTimeout(() => { ignoreMonthScrollRef.current = false; }, moved ? 500 : 80);
    }, 80);
    return () => {
      clearTimeout(timer);
      clearTimeout(releaseTimer);
      ignoreMonthScrollRef.current = false;
    };
  }, [selectedMonth, isPageLoading]);

  useEffect(() => {
    if (!isMobile || isPageLoading) return undefined;
    return bindSnapSelect(timelineRef.current, {
      attr: 'data-month-tab',
      ignoreRef: ignoreMonthScrollRef,
      onSelect: (ym) => {
        if (ym === selectedMonthRef.current) return;
        setSelectedMonth(ym);
      },
    });
  }, [isMobile, isPageLoading, monthList.length]);

  const handleSaveSalary = async () => {
    if (savingSalary) return;
    const num = parseFloat(salaryInput) || 0;
    const previous = salaries;
    const updated = withSavedMonthSalary(salaries, selectedMonth, num);
    setSalaries(updated);
    setLocalSetting('monthly_salaries', updated);
    setSavingSalary(true);
    try {
      await saveMonthlySalaries(updated);
    } catch (err) {
      setSalaries(previous);
      setLocalSetting('monthly_salaries', previous);
      console.error(err);
    } finally {
      setSavingSalary(false);
    }
  };

  // ── Calculation details for selected month ──
  const activeMonthData = useMemo(
    () =>
      computeFinancialMomentMonth({
        selectedMonth,
        salaries,
        receivables,
        transactions,
        creditCards,
        cardBills,
        cardTransactions,
        bankAccountIds,
        bankAccountNameById,
        creditBillPeriod,
      }),
    [
      selectedMonth,
      salaries,
      receivables,
      cardBills,
      cardTransactions,
      creditBillPeriod,
      transactions,
      creditCards,
      bankAccountIds,
      bankAccountNameById,
    ]
  );

  const monthsStatus = useMemo(
    () =>
      computeFinancialMomentMonthsStatus({
        monthList,
        salaries,
        receivables,
        transactions,
        creditCards,
        cardBills,
        cardTransactions,
        bankAccountIds,
        creditBillPeriod,
        skipWhileLoading: creditCards.length === 0 && creditLoading,
      }),
    [
      monthList,
      salaries,
      receivables,
      cardBills,
      creditBillPeriod,
      transactions,
      creditCards,
      creditLoading,
      bankAccountIds,
      cardTransactions,
    ]
  );

  const monthIndex = monthList.findIndex(m => m.ym === selectedMonth);
  const handlePrev = () => {
    if (monthIndex > 0) setSelectedMonth(monthList[monthIndex - 1].ym);
  };
  const handleNext = () => {
    if (monthIndex >= 0 && monthIndex < monthList.length - 1) setSelectedMonth(monthList[monthIndex + 1].ym);
  };

  const currentLabel = monthList.find(m => m.ym === selectedMonth)?.label || '';
  const thisMonthYm = currentMonthYm();

  // Calculate overall metrics for UI progress
  const net = activeMonthData?.netBalance || 0;
  const entries = activeMonthData?.entriesTotal || 1;
  const spent = activeMonthData?.expensesTotal || 0;
  const pctSpent = Math.min(100, Math.round((spent / entries) * 100));

  const monthChips = monthList.map((m) => {
    const isSelected = m.ym === selectedMonth;
    const isCurrent = m.ym === thisMonthYm;
    const status = monthsStatus[m.ym];
    const tone = status ? (status.isPositive ? 'is-positive' : 'is-negative') : '';
    const badgeText = status
      ? (status.isPositive ? `+${formatCurrency(status.net)}` : formatCurrency(status.net))
      : '';

    return (
      <div
        key={m.ym}
        role="button"
        tabIndex={0}
        data-month-tab={m.ym}
        className={`moment-month-chip ${tone} ${isSelected ? 'is-selected' : ''}`.trim()}
        onClick={() => setSelectedMonth(m.ym)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedMonth(m.ym);
          }
        }}
      >
        <span className="moment-month-chip__name">{m.label.split(' de ')[0]}</span>
        <span className="moment-month-chip__year">
          {m.year} {isCurrent ? '• Atual' : ''}
        </span>
        {badgeText && <span className="moment-month-chip__net">{badgeText}</span>}
      </div>
    );
  });

  const salaryCard = (
    <Card
      title="Salário Mensal"
      subtitle={isMobile ? undefined : 'Salário líquido deste mês. Ao salvar, vira o padrão dos próximos meses.'}
    >
      <div className="moment-salary-row">
        <div className="moment-salary-field">
          <DollarSign size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="number"
            placeholder="0,00"
            value={salaryInput}
            disabled={savingSalary}
            onChange={e => setSalaryInput(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={handleSaveSalary} icon={Save} loading={savingSalary}>
          Definir
        </Button>
      </div>
    </Card>
  );

  const receivablesCard = activeMonthData && (
    <Card
      title="Valores a Receber (Reembolsos)"
      subtitle={isMobile ? undefined : 'Reembolsos e parcelas a receber de amigos/familiares vencendo neste mês.'}
    >
      {activeMonthData.activeReceivables.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
          Nenhum valor a receber cadastrado para este mês.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {activeMonthData.activeReceivables.map((r, i) => (
            <div key={i} className="list-row" style={{ padding: '0.65rem 0.75rem' }}>
              <div className="list-row-main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                  {r.description}
                </span>
                <div className="list-row-meta" style={{ gap: '0.4rem' }}>
                  <Badge variant="neutral" style={{ backgroundColor: r.personColor + '11', color: r.personColor, fontWeight: 700, fontSize: '9px' }}>
                    {r.personName}
                  </Badge>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Parcela {r.installmentNumber}/{r.totalInstallments}
                  </span>
                  {r.paidAt && <Badge variant="success" style={{ fontSize: '9px' }}>Recebido</Badge>}
                </div>
              </div>
              <span className="list-row-amount" style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--success)' }}>
                + {formatCurrency(r.amount)}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
            <span>Total Reembolsos</span>
            <span style={{ color: 'var(--success)' }}>{formatCurrency(activeMonthData.receivablesTotal)}</span>
          </div>
        </div>
      )}
    </Card>
  );

  const billsCard = activeMonthData && (
    <Card
      className={isMobile ? 'moment-bills-card' : undefined}
      title="Faturas de Cartão de Crédito"
      subtitle={isMobile ? undefined : 'Faturas fechadas e estimadas com vencimento neste mês.'}
    >
      {activeMonthData.activeBills.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
          Nenhuma fatura de cartão vencendo neste mês.
        </p>
      ) : isMobile ? (
        <>
          <div className="chip-scroll moment-bill-strip">
            {activeMonthData.activeBills.map((b, i) => (
              <div
                key={b.cardId || i}
                className={`moment-bill-chip ${b.isPaid ? 'is-paid' : 'is-pending'}`}
              >
                <div className="moment-bill-chip__name">
                  <AccountIcon account={accountById(accounts, b.cardId)} size={16} type="CREDIT" />
                  {b.cardName}
                </div>
                <div className="moment-bill-chip__amount">- {formatCurrency(b.amount)}</div>
                <div className="moment-bill-chip__meta">
                  <span>Vence {b.dueDate ? formatDate(b.dueDate) : '—'}</span>
                  {b.isPaid ? (
                    <Badge variant="success" style={{ fontSize: '9px' }}>Paga</Badge>
                  ) : (
                    <Badge variant="warning" style={{ fontSize: '9px' }}>Pendente</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="moment-bill-total" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.35rem', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
            <span>Total Faturas</span>
            <span style={{ color: 'var(--danger)' }}>{formatCurrency(activeMonthData.creditCardsTotal)}</span>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {activeMonthData.activeBills.map((b, i) => (
            <div key={i} className="list-row" style={{ padding: '0.65rem 0.75rem' }}>
              <div className="list-row-main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AccountIcon account={accountById(accounts, b.cardId)} size={16} type="CREDIT" />
                  {b.cardName}
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.15rem' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Vence {b.dueDate ? formatDate(b.dueDate) : '—'}
                  </span>
                  {b.isPaid ? (
                    <Badge variant="success" style={{ fontSize: '9px' }}>Paga</Badge>
                  ) : (
                    <Badge variant="warning" style={{ fontSize: '9px' }}>Pendente</Badge>
                  )}
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>
                - {formatCurrency(b.amount)}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
            <span>Total Faturas</span>
            <span style={{ color: 'var(--danger)' }}>{formatCurrency(activeMonthData.creditCardsTotal)}</span>
          </div>
        </div>
      )}
    </Card>
  );

  const debitsCard = activeMonthData && (
    <Card
      title="Débito Automático"
      subtitle={isMobile ? undefined : 'Convênios e débitos automáticos das contas bancárias neste mês (energia, celular, financiamentos). PIX e transferências não entram.'}
    >
      {activeMonthData.activeAutomaticDebits.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
          Nenhum débito automático nas contas conectadas para este mês.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {activeMonthData.activeAutomaticDebits.map((t) => (
            <div
              key={t.id}
              className="list-row"
              style={{
                padding: '0.65rem 0.75rem',
                backgroundColor: t.isPending ? 'var(--bg-tertiary)' : undefined,
                border: t.isPending ? '1px solid rgba(245,158,11,0.35)' : undefined,
              }}
            >
              <div className="list-row-main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Repeat size={12} /> {t.description || t.descriptionRaw || 'Débito automático'}
                </span>
                <div className="list-row-meta" style={{ gap: '0.4rem' }}>
                  <Badge variant="neutral" style={{ fontSize: '9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <AccountIcon account={accountById(accounts, t.accountId)} size={12} />
                    {t.accountName}
                  </Badge>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {formatDate(t.date)}
                  </span>
                  {t.isPending ? (
                    <Badge variant="warning" style={{ fontSize: '9px' }}>Agendado</Badge>
                  ) : (
                    <Badge variant="success" style={{ fontSize: '9px' }}>Liquidado</Badge>
                  )}
                </div>
              </div>
              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>
                - {formatCurrency(t.amountAbs)}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
            <span>Total Débitos Automáticos</span>
            <span style={{ color: 'var(--danger)' }}>{formatCurrency(activeMonthData.automaticDebitsTotal)}</span>
          </div>
        </div>
      )}
    </Card>
  );

  const manualsCard = activeMonthData && (
    <Card
      title="Despesas Manuais"
      subtitle={isMobile ? undefined : 'Marque Pago por ocorrência deste mês (só controle; não altera saldo).'}
    >
      {activeMonthData.activeManual.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
          Nenhuma despesa manual registrada para este mês.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {activeMonthData.activeManual.map((m) => (
            <div
              key={m.id}
              className="list-row"
              style={{
                gap: '0.75rem',
                padding: '0.65rem 0.75rem',
                backgroundColor: m.isPaid ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                border: `1px solid ${m.isPaid ? 'rgba(16,185,129,0.35)' : 'var(--border-color)'}`,
              }}
            >
              <div className="list-row-main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                  textDecoration: m.isPaid ? 'line-through' : 'none',
                }}>
                  {m.description}
                </span>
                <div className="list-row-meta" style={{ gap: '0.4rem' }}>
                  <Badge variant="neutral" style={{ fontSize: '9px' }}>
                    {translateCategory(m.category)}
                  </Badge>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {formatDate(m.date)}
                  </span>
                  {m.isPaid && (
                    <Badge variant="success" style={{ fontSize: '9px' }}>Paga</Badge>
                  )}
                </div>
              </div>
              <div className="list-row-amount" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>
                  - {formatCurrency(Math.abs(m.amount))}
                </span>
                <PaidCheckbox
                  checked={Boolean(m.isPaid)}
                  busy={Boolean(pending[m.id])}
                  size={18}
                  onChange={(v) => setManualPaid(m.id, v)}
                />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
            <span>Total Manuais</span>
            <span style={{ color: 'var(--danger)' }}>{formatCurrency(activeMonthData.manualExpensesTotal)}</span>
          </div>
        </div>
      )}
    </Card>
  );

  const payableClear = (activeMonthData?.accountsPayableTotal || 0) <= 0;

  return (
    <div className="moment-page" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 'var(--space-4)' : 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Momento Financeiro</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Visão consolidada de entradas, faturas, débitos automáticos e despesas manuais do mês.
          </p>
        </div>
        <div className="page-header__actions">
          <Button size="sm" variant="outline" onClick={handlePrev} disabled={monthIndex <= 0} className="tap-target">
            <ChevronLeft size={16} /> <span className="hide-mobile">Anterior</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleNext} disabled={monthIndex >= monthList.length - 1} className="tap-target">
            <span className="hide-mobile">Próximo</span> <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {isPageLoading ? (
        <PageLoadingSkeleton
          kpiCount={4}
          showTimeline
          showChart={false}
          showList
          label="Consolidando faturas e movimentações do mês"
        />
      ) : (
      <>
      <Card
        className="moment-month-selector"
        title={isMobile ? undefined : 'Seletor de Período'}
      >
        {isMobile && selectedMonth && selectedMonth !== thisMonthYm && (
          <div className="moment-month-current">
            <Button size="sm" variant="secondary" onClick={() => setSelectedMonth(thisMonthYm)}>
              Mês atual
            </Button>
          </div>
        )}
        <div ref={timelineRef} className="chip-scroll moment-month-strip">
          {monthChips}
        </div>
      </Card>

      {activeMonthData && (
        <>
          {isMobile ? (
            <>
              <div className="moment-kpi-compact">
                <div className="credit-kpi-cell credit-kpi-cell--in">
                  <span className="credit-kpi-label">Entradas</span>
                  <span className="credit-kpi-value">{formatCurrency(activeMonthData.entriesTotal)}</span>
                  <span className="credit-kpi-meta">Salário + {activeMonthData.activeReceivables.length} reembolsos</span>
                </div>
                <div className="credit-kpi-cell credit-kpi-cell--out">
                  <span className="credit-kpi-label">Saídas</span>
                  <span className="credit-kpi-value">{formatCurrency(activeMonthData.expensesTotal)}</span>
                  <span className="credit-kpi-meta">{activeMonthData.activeManual.length} manuais</span>
                </div>
                <div className={`credit-kpi-cell credit-kpi-cell--pay ${payableClear ? 'is-clear' : ''}`}>
                  <span className="credit-kpi-label">A pagar</span>
                  <span className="credit-kpi-value">{formatCurrency(activeMonthData.accountsPayableTotal)}</span>
                  <span className="credit-kpi-meta">
                    {payableClear ? 'Nada pendente' : `${activeMonthData.unpaidBills.length} fat. · ${activeMonthData.unpaidAutomaticDebits.length} déb.`}
                  </span>
                </div>
                <div className={`credit-kpi-cell ${net >= 0 ? 'credit-kpi-cell--net-ok' : 'credit-kpi-cell--net-bad'}`}>
                  <span className="credit-kpi-label">Saldo</span>
                  <span className="credit-kpi-value">{net >= 0 ? '+' : ''}{formatCurrency(net)}</span>
                  <span className="credit-kpi-meta">{net >= 0 ? 'Superávit' : 'Déficit'}</span>
                </div>
              </div>
              <div className="moment-util-compact">
                <div className="moment-util-compact__row">
                  <span>Utilização</span>
                  <span style={{ fontWeight: 700, color: spent > entries ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    {pctSpent}%{spent > entries ? ' estourado' : ''}
                  </span>
                </div>
                <ProgressBar percent={pctSpent} color={spent > entries ? 'var(--danger)' : 'var(--primary)'} height={10} />
              </div>
              <div className="moment-mobile-stack">
                {salaryCard}
                {billsCard}
                {debitsCard}
                {manualsCard}
                {receivablesCard}
              </div>
            </>
          ) : (
            <>
              <div className="dashboard-grid">
                <Card className="col-3" style={{ borderLeft: '4px solid var(--success)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ENTRADAS DO MÊS
                  </span>
                  <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--success)' }}>
                    {formatCurrency(activeMonthData.entriesTotal)}
                  </h2>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Salário + {activeMonthData.activeReceivables.length} reembolsos
                  </span>
                </Card>

                <Card className="col-3" style={{ borderLeft: '4px solid var(--danger)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    SAÍDAS DO MÊS
                  </span>
                  <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--danger)' }}>
                    {formatCurrency(activeMonthData.expensesTotal)}
                  </h2>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Faturas + débitos auto + {activeMonthData.activeManual.length} manuais
                  </span>
                </Card>

                <Card
                  className="col-3"
                  style={{
                    borderLeft: `4px solid ${
                      activeMonthData.accountsPayableTotal > 0 ? 'var(--warning)' : 'var(--success)'
                    }`,
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    CONTAS A PAGAR
                  </span>
                  <h2
                    style={{
                      fontSize: 'var(--font-size-2xl)',
                      fontWeight: 700,
                      margin: '0.4rem 0',
                      color:
                        activeMonthData.accountsPayableTotal > 0 ? 'var(--warning)' : 'var(--success)',
                    }}
                  >
                    {formatCurrency(activeMonthData.accountsPayableTotal)}
                  </h2>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {activeMonthData.accountsPayableTotal > 0
                      ? `${activeMonthData.unpaidBills.length} fatura(s), ${activeMonthData.unpaidAutomaticDebits.length} débito(s) auto e ${activeMonthData.unpaidManual.length} manual(is)`
                      : 'Nada pendente neste mês'}
                  </span>
                </Card>

                <Card className="col-3" style={{ borderLeft: `4px solid ${net >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    SALDO RESIDUAL
                  </span>
                  <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {net >= 0 ? '+' : ''}{formatCurrency(net)}
                  </h2>
                  <Badge variant={net >= 0 ? 'success' : 'danger'}>
                    {net >= 0 ? 'Superavitário' : 'Deficitário'}
                  </Badge>
                </Card>
              </div>

              <Card title="Utilização de Entradas" subtitle={`Percentual de suas entradas consumido por cartões, débitos automáticos e despesas manuais em ${currentLabel}.`}>
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)' }}>
                    <span>Saídas vs Entradas</span>
                    <span style={{ fontWeight: 700, color: spent > entries ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {pctSpent}% {spent > entries ? '(Limite estourado!)' : ''}
                    </span>
                  </div>
                  <ProgressBar percent={pctSpent} color={spent > entries ? 'var(--danger)' : 'var(--primary)'} height={12} />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Suas despesas consomem {pctSpent}% do seu orçamento líquido. Restam {formatCurrency(Math.max(0, net))} livres para investimento ou reserva.
                  </p>
                </div>
              </Card>

              <div className="dashboard-grid">
                <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <TrendingUp size={18} /> Entradas / Créditos ({currentLabel})
                  </h2>
                  {salaryCard}
                  {receivablesCard}
                </div>
                <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <TrendingDown size={18} /> Saídas / Despesas ({currentLabel})
                  </h2>
                  {billsCard}
                  {debitsCard}
                  {manualsCard}
                </div>
              </div>
            </>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
}
export default FinancialMoment;
