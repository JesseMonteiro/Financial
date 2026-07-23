import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useReceivableStore } from '../stores/receivableStore';
import { useCreditDataStore } from '../stores/creditDataStore';
import { getLocalSetting, setLocalSetting, getMonthlySalaries, saveMonthlySalaries } from '../services/storage';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import {
  buildCreditCardBills,
  isBillPayment,
  isBillSettled,
  sumCycleCharges,
  MONTHS_PT,
} from '../utils/creditBillPeriod';
import { resolveMonthSalary, withSavedMonthSalary } from '../utils/monthSalary';
import { 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  PlusCircle, 
  ArrowUpRight, 
  Calendar,
  Save,
  CheckCircle2
} from 'lucide-react';

export function FinancialMoment() {
  const { accounts, loadAccounts, loading: accountsLoading, lastUpdated: accountsUpdatedAt } = useAccountStore();
  const { transactions, loadTransactions, setManualPaid } = useTransactionStore();
  const { receivables, loadReceivables } = useReceivableStore();
  const {
    loadForAccounts,
    loading: creditLoading,
    lastUpdatedByAccount,
    transactionsByAccount,
    billsByAccount,
  } = useCreditDataStore();

  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Salary state
  const [salaries, setSalaries] = useState({});
  const [salaryInput, setSalaryInput] = useState('');

  const timelineRef = useRef(null);

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
  const cardIds = useMemo(() => creditCards.map((c) => c.id), [creditCards]);

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
  const monthList = useMemo(() => {
    const list = [];
    const baseDate = new Date();
    for (let i = -6; i <= 5; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({
        ym,
        label: `${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`,
        year: d.getFullYear(),
        month: d.getMonth() + 1
      });
    }
    return list;
  }, []);

  // Default to current calendar month
  useEffect(() => {
    if (!selectedMonth) {
      const now = new Date();
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
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
    if (timelineRef.current && selectedMonth) {
      const selectedEl = timelineRef.current.querySelector(`[data-month-tab="${selectedMonth}"]`);
      if (selectedEl) {
        const container = timelineRef.current;
        const containerWidth = container.clientWidth;
        const elementLeft = selectedEl.offsetLeft;
        const elementWidth = selectedEl.clientWidth;
        container.scrollTo({
          left: elementLeft - (containerWidth / 2) + (elementWidth / 2),
          behavior: 'smooth'
        });
      }
    }
  }, [selectedMonth]);

  const handleSaveSalary = async () => {
    const num = parseFloat(salaryInput) || 0;
    const updated = withSavedMonthSalary(salaries, selectedMonth, num);
    setSalaries(updated);
    setLocalSetting('monthly_salaries', updated);
    await saveMonthlySalaries(updated);
  };

  /** Amount for one card in a due-month — never use outstanding balance. */
  const cardBillAmountForMonth = (card, ym) => {
    const matchingBill = cardBills.find(
      (b) => b.accountId === card.id && String(b.dueDate || '').startsWith(ym)
    );
    if (matchingBill) {
      return {
        amount: Number(matchingBill.totalAmount) || 0,
        dueDate: matchingBill.dueDate,
        // Inter often leaves payments[] empty; settle via payment txs too
        isPaid: isBillSettled(matchingBill, {
          transactions: cardTransactions,
          officialBills: cardBills,
          forecastToDueOffset: creditBillPeriod.forecastToDueOffset || 0,
        }),
        isFallback: false,
      };
    }

    const periodBill = creditBillPeriod.bills[ym];
    if (!periodBill) return null;

    const openKey = creditBillPeriod.openDueKey;
    const includeProjected = ym >= openKey;
    const scoped = periodBill.items.filter(
      (t) => (!t.accountId || t.accountId === card.id) && !isBillPayment(t)
    );
    const amount = sumCycleCharges(scoped, { includeProjected });
    if (amount <= 0) return null;

    return {
      amount,
      dueDate: periodBill.dueDate || `${ym}-10`,
      isPaid: false,
      isFallback: true,
    };
  };

  // ── Calculation details for selected month ──
  const activeMonthData = useMemo(() => {
    if (!selectedMonth) return null;
    
    // 1. Incomes - Salary
    const salary = resolveMonthSalary(salaries, selectedMonth);

    // 2. Incomes - Receivables due in this month (format: YYYY-MM-DD starts with YYYY-MM)
    const activeReceivables = [];
    let receivablesTotal = 0;

    receivables.forEach(r => {
      (r.installmentHistory || []).forEach(inst => {
        if ((inst.dueDate || '').startsWith(selectedMonth)) {
          activeReceivables.push({
            personName: r.personName,
            personColor: r.personColor,
            description: r.description,
            amount: inst.amount,
            installmentNumber: inst.installmentNumber,
            totalInstallments: r.installments,
            paidAt: inst.paidAt
          });
          // All installments due in this month count as credit/receivable entries
          receivablesTotal += inst.amount;
        }
      });
    });

    const entriesTotal = salary + receivablesTotal;

    // 3. Expenses - Credit Card bills due in this month (canonical due-month index)
    const activeBills = [];
    let creditCardsTotal = 0;

    creditCards.forEach(card => {
      const bill = cardBillAmountForMonth(card, selectedMonth);
      if (!bill) return;
      activeBills.push({
        cardName: card.name,
        dueDate: bill.dueDate,
        amount: bill.amount,
        isPaid: bill.isPaid,
        isFallback: bill.isFallback,
      });
      creditCardsTotal += bill.amount;
    });

    // 4. Expenses - Manual expenses dated in this month
    const activeManual = transactions.filter(t => 
      t.isManual === true && 
      t.date?.startsWith(selectedMonth)
    );
    const manualExpensesTotal = activeManual.reduce((s, t) => s + Math.abs(t.amount), 0);

    const expensesTotal = creditCardsTotal + manualExpensesTotal;
    const netBalance = entriesTotal - expensesTotal;

    return {
      salary,
      activeReceivables,
      receivablesTotal,
      entriesTotal,
      activeBills,
      creditCardsTotal,
      activeManual,
      manualExpensesTotal,
      expensesTotal,
      netBalance
    };
  }, [selectedMonth, salaries, receivables, cardBills, cardTransactions, creditBillPeriod, transactions, creditCards]);

  const monthsStatus = useMemo(() => {
    const statuses = {};
    if (creditCards.length === 0 && creditLoading) return statuses;

    monthList.forEach(m => {
      const ym = m.ym;
      const salary = resolveMonthSalary(salaries, ym);

      let receivablesTotal = 0;
      receivables.forEach(r => {
        (r.installmentHistory || []).forEach(inst => {
          if ((inst.dueDate || '').startsWith(ym)) {
            receivablesTotal += inst.amount;
          }
        });
      });

      const entriesTotal = salary + receivablesTotal;

      let creditCardsTotal = 0;
      creditCards.forEach(card => {
        const bill = cardBillAmountForMonth(card, ym);
        if (bill) creditCardsTotal += bill.amount;
      });

      const manualExpensesTotal = transactions
        .filter(t => t.isManual === true && t.date?.startsWith(ym))
        .reduce((s, t) => s + Math.abs(t.amount), 0);

      const expensesTotal = creditCardsTotal + manualExpensesTotal;
      const netVal = entriesTotal - expensesTotal;

      statuses[ym] = {
        isPositive: netVal >= 0,
        net: netVal
      };
    });

    return statuses;
  }, [monthList, salaries, receivables, cardBills, creditBillPeriod, transactions, creditCards, creditLoading]);

  const monthIndex = monthList.findIndex(m => m.ym === selectedMonth);
  const handlePrev = () => {
    if (monthIndex > 0) setSelectedMonth(monthList[monthIndex - 1].ym);
  };
  const handleNext = () => {
    if (monthIndex >= 0 && monthIndex < monthList.length - 1) setSelectedMonth(monthList[monthIndex + 1].ym);
  };

  const currentLabel = monthList.find(m => m.ym === selectedMonth)?.label || '';

  // Calculate overall metrics for UI progress
  const net = activeMonthData?.netBalance || 0;
  const entries = activeMonthData?.entriesTotal || 1;
  const spent = activeMonthData?.expensesTotal || 0;
  const pctSpent = Math.min(100, Math.round((spent / entries) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Momento Financeiro</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Visão consolidada de entradas, faturas de cartão de crédito e despesas manuais do mês.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button size="sm" variant="outline" onClick={handlePrev} disabled={monthIndex <= 0}>
            <ChevronLeft size={16} /> Anterior
          </Button>
          <Button size="sm" variant="outline" onClick={handleNext} disabled={monthIndex >= monthList.length - 1}>
            Próximo <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Month Seletor Tabs */}
      {isPageLoading ? (
        <PageLoadingSkeleton
          kpiCount={3}
          showTimeline
          showChart={false}
          showList
          label="Consolidando faturas e movimentações do mês"
        />
      ) : (
      <>
      <Card title="Seletor de Período">
        <div
          ref={timelineRef}
          style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', padding: '0.5rem 0.25rem', scrollbarWidth: 'thin' }}
        >
          {monthList.map(m => {
            const isSelected = m.ym === selectedMonth;
            const isCurrent = m.ym === (() => {
              const n = new Date();
              return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
            })();
            const status = monthsStatus[m.ym];
            
            let cardBg = 'var(--bg-tertiary)';
            let cardBorder = '1px solid var(--border-color)';
            let textColor = 'var(--text-primary)';
            let subColor = 'var(--text-muted)';
            let badgeText = '';

            if (status) {
              if (status.isPositive) {
                cardBg = isSelected ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.05)';
                cardBorder = isSelected ? '2px solid var(--success)' : '1px solid rgba(34,197,94,0.3)';
                textColor = 'var(--success)';
                badgeText = `+${formatCurrency(status.net)}`;
              } else {
                cardBg = isSelected ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.05)';
                cardBorder = isSelected ? '2px solid var(--danger)' : '1px solid rgba(239,68,68,0.3)';
                textColor = 'var(--danger)';
                badgeText = `${formatCurrency(status.net)}`;
              }
            }

            return (
              <div
                key={m.ym}
                data-month-tab={m.ym}
                onClick={() => setSelectedMonth(m.ym)}
                style={{
                  minWidth: 155,
                  flexShrink: 0,
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  border: cardBorder,
                  backgroundColor: cardBg,
                  transition: 'all 0.2s ease',
                  fontWeight: isSelected ? 700 : 500
                }}
              >
                <span style={{ fontSize: 'var(--font-size-xs)', display: 'block', color: textColor }}>
                  {m.label.split(' de ')[0]}
                </span>
                <span style={{ fontSize: '10px', color: subColor, display: 'block', margin: '2px 0' }}>
                  {m.year} {isCurrent ? '• Atual' : ''}
                </span>
                {badgeText && (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: textColor }}>
                    {badgeText}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {activeMonthData && (
        <>
          {/* Summary KPIs */}
          <div className="dashboard-grid">
            <Card className="col-4" style={{ borderLeft: '4px solid var(--success)' }}>
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

            <Card className="col-4" style={{ borderLeft: '4px solid var(--danger)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                SAÍDAS DO MÊS
              </span>
              <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--danger)' }}>
                {formatCurrency(activeMonthData.expensesTotal)}
              </h2>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Faturas + {activeMonthData.activeManual.length} despesas manuais
              </span>
            </Card>

            <Card className="col-4" style={{ borderLeft: `4px solid ${net >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
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

          {/* Progress / Cash Flow health */}
          <Card title="Utilização de Entradas" subtitle={`Percentual de suas entradas consumido por cartões e despesas manuais em ${currentLabel}.`}>
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

          {/* Detail Columns */}
          <div className="dashboard-grid">
            
            {/* INCOMES COLUMN */}
            <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingUp size={18} /> Entradas / Créditos ({currentLabel})
              </h2>

              {/* Salary Configuration */}
              <Card title="Salário Mensal" subtitle="Salário líquido deste mês. Ao salvar, vira o padrão dos próximos meses.">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <DollarSign size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="number"
                      placeholder="0,00"
                      value={salaryInput}
                      onChange={e => setSalaryInput(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: 'var(--font-size-sm)' }}
                    />
                  </div>
                  <Button size="sm" onClick={handleSaveSalary} icon={Save}>
                    Definir
                  </Button>
                </div>
              </Card>

              {/* Receivables List */}
              <Card title="Valores a Receber (Reembolsos)" subtitle="Reembolsos e parcelas a receber de amigos/familiares vencendo neste mês.">
                {activeMonthData.activeReceivables.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
                    Nenhum valor a receber cadastrado para este mês.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {activeMonthData.activeReceivables.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                            {r.description}
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.15rem' }}>
                            <Badge variant="neutral" style={{ backgroundColor: r.personColor + '11', color: r.personColor, fontWeight: 700, fontSize: '9px' }}>
                              👤 {r.personName}
                            </Badge>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Parcela {r.installmentNumber}/{r.totalInstallments}
                            </span>
                            {r.paidAt && <Badge variant="success" style={{ fontSize: '9px' }}>Recebido</Badge>}
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--success)' }}>
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
            </div>

            {/* EXPENSES COLUMN */}
            <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingDown size={18} /> Saídas / Despesas ({currentLabel})
              </h2>

              {/* Credit Card Bills */}
              <Card title="Faturas de Cartão de Crédito" subtitle="Faturas fechadas e estimadas com vencimento neste mês.">
                {activeMonthData.activeBills.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
                    Nenhuma fatura de cartão vencendo neste mês.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {activeMonthData.activeBills.map((b, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                            💳 {b.cardName}
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

              {/* Manual Expenses */}
              <Card
                title="Despesas Manuais"
                subtitle="Marque Pago por ocorrência deste mês (só controle; não altera saldo)."
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
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-md)',
                          backgroundColor: m.isPaid ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                          border: `1px solid ${m.isPaid ? 'rgba(16,185,129,0.35)' : 'var(--border-color)'}`,
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: 'var(--font-size-xs)',
                            textDecoration: m.isPaid ? 'line-through' : 'none',
                          }}>
                            {m.description}
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.15rem', flexWrap: 'wrap', alignItems: 'center' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>
                            - {formatCurrency(Math.abs(m.amount))}
                          </span>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              cursor: 'pointer',
                              fontSize: '10px',
                              fontWeight: 600,
                              color: m.isPaid ? 'var(--success)' : 'var(--text-muted)',
                              userSelect: 'none',
                              whiteSpace: 'nowrap',
                            }}
                            title="Marcar como pago (apenas controle; não altera saldo)"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(m.isPaid)}
                              onChange={(e) => setManualPaid(m.id, e.target.checked)}
                              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--success)' }}
                            />
                            {m.isPaid ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                <CheckCircle2 size={11} /> Pago
                              </span>
                            ) : (
                              'Pago'
                            )}
                          </label>
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
            </div>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
export default FinancialMoment;
