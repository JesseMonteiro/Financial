import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAccountStore } from '../stores/accountStore';
import { useTransactionStore } from '../stores/transactionStore';
import { useReceivableStore } from '../stores/receivableStore';
import { fetchTransactions, fetchBills } from '../services/api';
import { getLocalSetting, setLocalSetting } from '../services/storage';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
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
  Save
} from 'lucide-react';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function isBillPayment(tx) {
  return (tx.description || '').toUpperCase().includes('PAGAMENTO DE FATURA') ||
         (tx.description || '').toUpperCase().includes('PAGAMENTO RECEBIDO');
}

function getForecastKey(t, officialBills) {
  let key = t.creditCardMetadata?.billForecastDate;
  if (key) return key;

  const billId = t.creditCardMetadata?.billId || t.billId;
  if (billId) {
    const bill = officialBills.find(b => b.id === billId);
    if (bill && bill.dueDate) {
      const dueYM = bill.dueDate.slice(0, 7);
      const [y, m] = dueYM.split('-').map(Number);
      let prevM = m - 1;
      let prevY = y;
      if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
      }
      return `${prevY}-${prevM < 10 ? '0' + prevM : prevM}`;
    }
  }

  if (t.date) return t.date.slice(0, 7);
  return 'Outros';
}

function forecastKeyToDueMonth(ymKey) {
  if (!ymKey || ymKey === 'Outros') return null;
  const [y, m] = ymKey.split('-').map(Number);
  let nm = m + 1, ny = y;
  if (nm > 12) { nm = 1; ny += 1; }
  return `${ny}-${nm < 10 ? '0' + nm : nm}`;
}

export function FinancialMoment() {
  const { accounts, loadAccounts } = useAccountStore();
  const { transactions, loadTransactions } = useTransactionStore();
  const { receivables, loadReceivables } = useReceivableStore();

  const [cardBills, setCardBills] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  
  // Salary state
  const [salaries, setSalaries] = useState({});
  const [salaryInput, setSalaryInput] = useState('');

  const timelineRef = useRef(null);

  // Load stores
  useEffect(() => {
    loadAccounts();
    loadTransactions();
    loadReceivables();
    
    // Load salaries from storage
    const storedSalaries = getLocalSetting('monthly_salaries', {});
    setSalaries(storedSalaries);
  }, []);

  const creditCards = useMemo(() => accounts.filter(a => a.type === 'CREDIT'), [accounts]);

  // Load official bills for all credit cards
  useEffect(() => {
    async function loadBills() {
      if (creditCards.length === 0) {
        setLoadingCards(false);
        return;
      }
      setLoadingCards(true);
      try {
        const allBills = [];
        for (const card of creditCards) {
          const res = await fetchBills(card.id);
          const bills = (res || []).map(b => ({ ...b, accountId: card.id }));
          allBills.push(...bills);
        }
        setCardBills(allBills);
      } catch (e) {
        console.warn('[FinancialMoment] Failed to load bills:', e);
      } finally {
        setLoadingCards(false);
      }
    }
    if (accounts.length > 0) loadBills();
  }, [creditCards, accounts.length]);

  // 12-month calendar list around July 2026
  const monthList = useMemo(() => {
    const list = [];
    const baseDate = new Date('2026-07-21');
    // Generate 6 months past, current, and 5 months future
    for (let i = -6; i <= 5; i++) {
      const d = new Date(baseDate);
      d.setMonth(baseDate.getMonth() + i);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({
        ym,
        label: `${MONTHS[d.getMonth()]} de ${d.getFullYear()}`,
        year: d.getFullYear(),
        month: d.getMonth() + 1
      });
    }
    return list;
  }, []);

  // Default to current month (2026-07)
  useEffect(() => {
    if (!selectedMonth) {
      setSelectedMonth('2026-07');
    }
  }, [selectedMonth]);

  // Sync salary input when month or salaries change
  useEffect(() => {
    if (selectedMonth) {
      const val = salaries[selectedMonth] !== undefined ? salaries[selectedMonth] : 5000;
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

  const handleSaveSalary = () => {
    const num = parseFloat(salaryInput) || 0;
    const updated = { ...salaries, [selectedMonth]: num };
    setSalaries(updated);
    setLocalSetting('monthly_salaries', updated);
  };

  // ── Calculation details for selected month ──
  const activeMonthData = useMemo(() => {
    if (!selectedMonth) return null;
    
    // 1. Incomes - Salary
    const salary = salaries[selectedMonth] !== undefined ? salaries[selectedMonth] : 5000;

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

    // 3. Expenses - Credit Card bills due in this month
    // In our system, the due month is closingMonth + 1. So if we look at month 2026-07:
    // The credit card bills due in 2026-07 have forecast month 2026-06!
    // So we lookup bills whose dueDate is in the selectedMonth (starts with YYYY-MM)
    const activeBills = [];
    let creditCardsTotal = 0;

    creditCards.forEach(card => {
      const matchingBill = cardBills.find(b => b.accountId === card.id && b.dueDate?.startsWith(selectedMonth));
      if (matchingBill) {
        activeBills.push({
          cardName: card.name,
          dueDate: matchingBill.dueDate,
          amount: matchingBill.totalAmount || 0,
          isPaid: matchingBill.payments?.length > 0
        });
        creditCardsTotal += matchingBill.totalAmount || 0;
      } else {
        // Fallback: sum transactions for this card matching selected month (due date)
        const cardTxs = transactions.filter(t => 
          t.accountId === card.id && 
          t.isManual !== true && 
          !isBillPayment(t)
        );

        const map = {};
        cardTxs.forEach(t => {
          const k = getForecastKey(t, cardBills);
          if (!map[k]) map[k] = [];
          map[k].push(t);
        });

        // Project installments from base month '2026-07'
        const openKey = '2026-07';
        if (map[openKey]) {
          const activeInstallments = map[openKey].filter(t =>
            t.creditCardMetadata?.totalInstallments &&
            t.creditCardMetadata?.installmentNumber &&
            t.creditCardMetadata.installmentNumber < t.creditCardMetadata.totalInstallments
          );

          activeInstallments.forEach(t => {
            const meta = t.creditCardMetadata;
            const baseForecastKey = meta.billForecastDate || openKey;
            const [baseY, baseM] = baseForecastKey.split('-').map(Number);
            const remaining = meta.totalInstallments - meta.installmentNumber;

            for (let step = 1; step <= remaining; step++) {
              let nm = baseM + step, ny = baseY;
              if (nm > 12) { ny += Math.floor((nm - 1) / 12); nm = ((nm - 1) % 12) + 1; }
              const futureKey = `${ny}-${nm < 10 ? '0' + nm : nm}`;

              if (!map[futureKey]) map[futureKey] = [];

              const projId = `proj_${t.id}_${futureKey}`;
              if (!map[futureKey].some(e => e.id === projId)) {
                map[futureKey].push({
                  ...t,
                  id: projId,
                  amount: t.amount,
                  isProjected: true
                });
              }
            }
          });
        }

        // Selected month due corresponds to forecastKey = selectedMonth - 1 month
        const [y, m] = selectedMonth.split('-').map(Number);
        let prevM = m - 1, prevY = y;
        if (prevM < 1) { prevM = 12; prevY -= 1; }
        const forecastKey = `${prevY}-${prevM < 10 ? '0' + prevM : prevM}`;

        const sumTxs = (map[forecastKey] || []).reduce((s, t) => s + Math.abs(t.amount), 0);
        if (sumTxs > 0) {
          activeBills.push({
            cardName: card.name,
            dueDate: `${selectedMonth}-10`,
            amount: sumTxs,
            isPaid: false,
            isFallback: true
          });
          creditCardsTotal += sumTxs;
        }
      }
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
  }, [selectedMonth, salaries, receivables, cardBills, transactions, creditCards]);

  const monthsStatus = useMemo(() => {
    const statuses = {};
    if (creditCards.length === 0 && loadingCards) return statuses;

    monthList.forEach(m => {
      const ym = m.ym;
      const salary = salaries[ym] !== undefined ? salaries[ym] : 5000;

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
        const matchingBill = cardBills.find(b => b.accountId === card.id && b.dueDate?.startsWith(ym));
        if (matchingBill) {
          creditCardsTotal += matchingBill.totalAmount || 0;
        } else {
          const cardTxs = transactions.filter(t => 
            t.accountId === card.id && 
            t.isManual !== true && 
            !isBillPayment(t)
          );

          const map = {};
          cardTxs.forEach(t => {
            const k = getForecastKey(t, cardBills);
            if (!map[k]) map[k] = [];
            map[k].push(t);
          });

          const openKey = '2026-07';
          if (map[openKey]) {
            const activeInstallments = map[openKey].filter(t =>
              t.creditCardMetadata?.totalInstallments &&
              t.creditCardMetadata?.installmentNumber &&
              t.creditCardMetadata.installmentNumber < t.creditCardMetadata.totalInstallments
            );

            activeInstallments.forEach(t => {
              const meta = t.creditCardMetadata;
              const baseForecastKey = meta.billForecastDate || openKey;
              const [baseY, baseM] = baseForecastKey.split('-').map(Number);
              const remaining = meta.totalInstallments - meta.installmentNumber;

              for (let step = 1; step <= remaining; step++) {
                let nm = baseM + step, ny = baseY;
                if (nm > 12) { ny += Math.floor((nm - 1) / 12); nm = ((nm - 1) % 12) + 1; }
                const futureKey = `${ny}-${nm < 10 ? '0' + nm : nm}`;

                if (!map[futureKey]) map[futureKey] = [];

                const projId = `proj_${t.id}_${futureKey}`;
                if (!map[futureKey].some(e => e.id === projId)) {
                  map[futureKey].push({
                    ...t,
                    id: projId,
                    amount: t.amount,
                    isProjected: true
                  });
                }
              }
            });
          }

          const [y, mVal] = ym.split('-').map(Number);
          let prevM = mVal - 1, prevY = y;
          if (prevM < 1) { prevM = 12; prevY -= 1; }
          const forecastKey = `${prevY}-${prevM < 10 ? '0' + prevM : prevM}`;

          const sumTxs = (map[forecastKey] || []).reduce((s, t) => s + Math.abs(t.amount), 0);
          creditCardsTotal += sumTxs;
        }
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
  }, [monthList, salaries, receivables, cardBills, transactions, creditCards, loadingCards]);

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
      <Card title="Seletor de Período">
        <div
          ref={timelineRef}
          style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', padding: '0.5rem 0.25rem', scrollbarWidth: 'thin' }}
        >
          {monthList.map(m => {
            const isSelected = m.ym === selectedMonth;
            const isCurrent = m.ym === '2026-07';
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

      {loadingCards ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>
          Consolidando faturas e movimentações do mês...
        </p>
      ) : activeMonthData && (
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
              <Card title="Salário Mensal" subtitle="Informe seu salário líquido esperado para este mês.">
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
              <Card title="Despesas Manuais" subtitle="Despesas extras registradas manualmente para este período.">
                {activeMonthData.activeManual.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
                    Nenhuma despesa manual registrada para este mês.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {activeMonthData.activeManual.map((m, i) => (
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
                            {m.description}
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.15rem' }}>
                            <Badge variant="neutral" style={{ fontSize: '9px' }}>
                              {translateCategory(m.category)}
                            </Badge>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {formatDate(m.date)}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>
                          - {formatCurrency(Math.abs(m.amount))}
                        </span>
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
    </div>
  );
}
export default FinancialMoment;
