import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useJointStore } from '../stores/jointStore';
import { saveMonthlySalaries, saveStoredManualTransaction } from '../services/storage';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import { buildCreditCardBills } from '../utils/creditBillPeriod';
import { resolveMonthSalary, withSavedMonthSalary } from '../utils/monthSalary';
import {
  buildFinancialMomentMonthList,
  computeFinancialMomentMonth,
  computeFinancialMomentMonthsStatus,
} from '../utils/financialMomentMonth';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Save,
  CheckCircle2,
  Repeat,
  Users,
  Settings,
} from 'lucide-react';

function toCamelManualFromApi(row) {
  // moment-data already normalized in store; keep defensive
  return row;
}

export function JointFinancialMoment() {
  const {
    link,
    members,
    accounts,
    transactions: pluggyTxs,
    billsByAccount,
    manuals,
    receivables,
    statusLoading,
    momentLoading,
    loadStatus,
    loadMomentData,
    patchManualPaid,
    patchMemberSalaries,
    error,
  } = useJointStore();

  const [selectedMonth, setSelectedMonth] = useState('');
  const [salaryInputs, setSalaryInputs] = useState({});
  const timelineRef = useRef(null);

  useEffect(() => {
    (async () => {
      const current = await loadStatus({ force: true });
      if (current?.status === 'active') {
        await loadMomentData({ force: true }).catch(console.error);
      }
    })();
  }, [loadStatus, loadMomentData]);

  const creditCards = useMemo(
    () => (accounts || []).filter((a) => a.type === 'CREDIT'),
    [accounts]
  );
  const bankAccounts = useMemo(
    () => (accounts || []).filter((a) => a.type === 'BANK'),
    [accounts]
  );
  const bankAccountIds = useMemo(() => bankAccounts.map((a) => a.id), [bankAccounts]);
  const bankAccountNameById = useMemo(() => {
    const map = {};
    bankAccounts.forEach((a) => {
      map[a.id] = a.name || a.marketingName || 'Conta conectada';
    });
    return map;
  }, [bankAccounts]);

  const cardBills = useMemo(() => {
    const bills = [];
    for (const card of creditCards) {
      const list = billsByAccount[card.id] || [];
      bills.push(...list.map((b) => ({ ...b, accountId: b.accountId || card.id })));
    }
    return bills;
  }, [creditCards, billsByAccount]);

  const cardTransactions = useMemo(() => {
    const cardIds = new Set(creditCards.map((c) => c.id));
    return (pluggyTxs || []).filter((t) => cardIds.has(t.accountId));
  }, [pluggyTxs, creditCards]);

  const allTransactions = useMemo(() => {
    const manualsNorm = (manuals || []).map(toCamelManualFromApi);
    return [...(pluggyTxs || []), ...manualsNorm];
  }, [pluggyTxs, manuals]);

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

  const monthList = useMemo(() => buildFinancialMomentMonthList(), []);

  useEffect(() => {
    if (!selectedMonth) {
      const now = new Date();
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (!selectedMonth || !members.length) return;
    const next = {};
    members.forEach((m) => {
      next[m.id] = String(resolveMonthSalary(m.monthlySalaries || {}, selectedMonth));
    });
    setSalaryInputs(next);
  }, [selectedMonth, members]);

  useEffect(() => {
    if (timelineRef.current && selectedMonth) {
      const selectedEl = timelineRef.current.querySelector(`[data-month-tab="${selectedMonth}"]`);
      if (selectedEl) {
        const container = timelineRef.current;
        container.scrollTo({
          left: selectedEl.offsetLeft - container.clientWidth / 2 + selectedEl.clientWidth / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [selectedMonth]);

  const resolveCombinedSalary = (ym) =>
    (members || []).reduce(
      (sum, m) => sum + resolveMonthSalary(m.monthlySalaries || {}, ym),
      0
    );

  const activeMonthData = useMemo(
    () =>
      computeFinancialMomentMonth({
        selectedMonth,
        salary: resolveCombinedSalary(selectedMonth),
        receivables,
        transactions: allTransactions,
        creditCards,
        cardBills,
        cardTransactions,
        bankAccountIds,
        bankAccountNameById,
        creditBillPeriod,
      }),
    [
      selectedMonth,
      members,
      receivables,
      allTransactions,
      creditCards,
      cardBills,
      cardTransactions,
      bankAccountIds,
      bankAccountNameById,
      creditBillPeriod,
    ]
  );

  const monthsStatus = useMemo(
    () =>
      computeFinancialMomentMonthsStatus({
        monthList,
        resolveSalary: resolveCombinedSalary,
        receivables,
        transactions: allTransactions,
        creditCards,
        cardBills,
        cardTransactions,
        bankAccountIds,
        creditBillPeriod,
        skipWhileLoading: momentLoading && !accounts.length,
      }),
    [
      monthList,
      members,
      receivables,
      allTransactions,
      creditCards,
      cardBills,
      cardTransactions,
      bankAccountIds,
      creditBillPeriod,
      momentLoading,
      accounts.length,
    ]
  );

  const handleSaveSalary = async (memberId) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const num = parseFloat(salaryInputs[memberId]) || 0;
    const updated = withSavedMonthSalary(member.monthlySalaries || {}, selectedMonth, num);
    patchMemberSalaries(memberId, updated);
    await saveMonthlySalaries(updated, { userId: memberId });
  };

  const handleManualPaid = async (manual, isPaid) => {
    const updated = {
      ...manual,
      isPaid: Boolean(isPaid),
      paidAt: isPaid ? new Date().toISOString() : null,
      userId: manual.ownerUserId || manual.userId,
      ownerUserId: manual.ownerUserId || manual.userId,
    };
    patchManualPaid(manual.id, isPaid);
    await saveStoredManualTransaction(updated);
  };

  const monthIndex = monthList.findIndex((m) => m.ym === selectedMonth);
  const handlePrev = () => {
    if (monthIndex > 0) setSelectedMonth(monthList[monthIndex - 1].ym);
  };
  const handleNext = () => {
    if (monthIndex >= 0 && monthIndex < monthList.length - 1) {
      setSelectedMonth(monthList[monthIndex + 1].ym);
    }
  };

  const currentLabel = monthList.find((m) => m.ym === selectedMonth)?.label || '';
  const net = activeMonthData?.netBalance || 0;
  const entries = activeMonthData?.entriesTotal || 1;
  const spent = activeMonthData?.expensesTotal || 0;
  const pctSpent = Math.min(100, Math.round((spent / entries) * 100));

  const isPageLoading = statusLoading || (link?.status === 'active' && momentLoading && !accounts.length);

  if (!statusLoading && (!link || link.status !== 'active')) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Conta conjunta</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Momento Financeiro consolidado das duas contas vinculadas.
          </p>
        </div>
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Users size={40} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', maxWidth: 420 }}>
              Nenhuma conta conjunta ativa. Vá em Configurações, gere um código e compartilhe com a outra pessoa — ou aceite o código dela.
            </p>
            <Link to="/settings" style={{ textDecoration: 'none' }}>
              <Button icon={Settings}>Abrir Configurações</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Conta conjunta</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Visão unificada de {members.map((m) => m.displayName).join(' + ') || 'ambas as contas'}.
            {error && <span style={{ color: 'var(--danger)' }}> {error}</span>}
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
          label="Consolidando dados das duas contas"
        />
      ) : (
        <>
          <Card title="Seletor de Período">
            <div ref={timelineRef} className="chip-scroll" style={{ padding: '0.5rem 0.25rem' }}>
              {monthList.map((m) => {
                const isSelected = m.ym === selectedMonth;
                const now = new Date();
                const isCurrent =
                  m.ym === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
                      fontWeight: isSelected ? 700 : 500,
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
              <div className="dashboard-grid">
                <Card className="col-3" style={{ borderLeft: '4px solid var(--success)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ENTRADAS DO MÊS
                  </span>
                  <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--success)' }}>
                    {formatCurrency(activeMonthData.entriesTotal)}
                  </h2>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Salários + {activeMonthData.activeReceivables.length} reembolsos
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

              <Card title="Utilização de Entradas" subtitle={`Percentual das entradas consolidadas consumido em ${currentLabel}.`}>
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: 'var(--font-size-xs)' }}>
                    <span>Saídas vs Entradas</span>
                    <span style={{ fontWeight: 700, color: spent > entries ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {pctSpent}% {spent > entries ? '(Limite estourado!)' : ''}
                    </span>
                  </div>
                  <ProgressBar percent={pctSpent} color={spent > entries ? 'var(--danger)' : 'var(--primary)'} height={12} />
                </div>
              </Card>

              <div className="dashboard-grid">
                <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <TrendingUp size={18} /> Entradas / Créditos ({currentLabel})
                  </h2>

                  {members.map((member) => (
                    <Card
                      key={member.id}
                      title={`Salário — ${member.displayName}`}
                      subtitle="Salário líquido deste mês. Ao salvar, vira o padrão dos próximos meses."
                    >
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                          <DollarSign size={16} style={{ color: 'var(--text-muted)' }} />
                          <input
                            type="number"
                            placeholder="0,00"
                            value={salaryInputs[member.id] ?? ''}
                            onChange={(e) =>
                              setSalaryInputs((prev) => ({ ...prev, [member.id]: e.target.value }))
                            }
                            style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: 'var(--font-size-sm)' }}
                          />
                        </div>
                        <Button size="sm" onClick={() => handleSaveSalary(member.id)} icon={Save}>
                          Definir
                        </Button>
                      </div>
                    </Card>
                  ))}

                  <Card title="Valores a Receber (Reembolsos)" subtitle="Parcelas a receber das duas contas neste mês.">
                    {activeMonthData.activeReceivables.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
                        Nenhum valor a receber cadastrado para este mês.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {activeMonthData.activeReceivables.map((r, i) => (
                          <div key={i} className="list-row" style={{ padding: '0.65rem 0.75rem' }}>
                            <div className="list-row-main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{r.description}</span>
                              <div className="list-row-meta" style={{ gap: '0.4rem' }}>
                                {r.ownerLabel && (
                                  <Badge variant="neutral" style={{ fontSize: '9px' }}>{r.ownerLabel}</Badge>
                                )}
                                <Badge variant="neutral" style={{ backgroundColor: (r.personColor || '#6366f1') + '11', color: r.personColor, fontWeight: 700, fontSize: '9px' }}>
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
                </div>

                <div className="col-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <TrendingDown size={18} /> Saídas / Despesas ({currentLabel})
                  </h2>

                  <Card title="Faturas de Cartão de Crédito" subtitle="Faturas das duas contas com vencimento neste mês.">
                    {activeMonthData.activeBills.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
                        Nenhuma fatura neste mês.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {activeMonthData.activeBills.map((b, i) => (
                          <div key={i} className="list-row" style={{ padding: '0.65rem 0.75rem' }}>
                            <div className="list-row-main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{b.cardName}</span>
                              <div className="list-row-meta" style={{ gap: '0.4rem' }}>
                                {b.ownerLabel && (
                                  <Badge variant="neutral" style={{ fontSize: '9px' }}>{b.ownerLabel}</Badge>
                                )}
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  Vence {formatDate(b.dueDate)}
                                </span>
                                {b.isPaid ? (
                                  <Badge variant="success" style={{ fontSize: '9px' }}>Paga</Badge>
                                ) : (
                                  <Badge variant="warning" style={{ fontSize: '9px' }}>Pendente</Badge>
                                )}
                                {b.isFallback && (
                                  <Badge variant="neutral" style={{ fontSize: '9px' }}>Estimada</Badge>
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

                  <Card title="Débitos Automáticos" subtitle="Débitos em contas bancárias conectadas.">
                    {activeMonthData.activeAutomaticDebits.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
                        Nenhum débito automático neste mês.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {activeMonthData.activeAutomaticDebits.map((t) => (
                          <div key={t.id} className="list-row" style={{ padding: '0.65rem 0.75rem' }}>
                            <div className="list-row-main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                              <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{t.description || t.merchant?.name}</span>
                              <div className="list-row-meta" style={{ gap: '0.4rem' }}>
                                {t.ownerLabel && (
                                  <Badge variant="neutral" style={{ fontSize: '9px' }}>{t.ownerLabel}</Badge>
                                )}
                                <Badge variant="neutral" style={{ fontSize: '9px' }}>
                                  <Repeat size={10} style={{ marginRight: 2 }} /> {t.accountName}
                                </Badge>
                                {t.isPending && <Badge variant="warning" style={{ fontSize: '9px' }}>Pendente</Badge>}
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

                  <Card title="Despesas Manuais" subtitle="Marque Pago em qualquer despesa das duas contas (só controle).">
                    {activeMonthData.activeManual.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '1rem' }}>
                        Nenhuma despesa manual neste mês.
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
                                {(m.ownerLabel) && (
                                  <Badge variant="neutral" style={{ fontSize: '9px' }}>{m.ownerLabel}</Badge>
                                )}
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
                              <label
                                className="tap-target"
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
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(m.isPaid)}
                                  onChange={(e) => handleManualPaid(m, e.target.checked)}
                                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--success)' }}
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
