import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Repeat, CalendarDays, Info, CreditCard, HandCoins } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useTransactionStore } from '../stores/transactionStore';
import { useAccountStore } from '../stores/accountStore';
import { useReceivableStore } from '../stores/receivableStore';
import { useCreditDataStore } from '../stores/creditDataStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { isExpenseTx } from '../utils/analytics';
import { detectSubscriptions, groupSubscriptionsByKind } from '../utils/subscriptions';
import { formatDueMonthShort, buildCreditCardBills } from '../utils/creditBillPeriod';

const FREQ_LABEL = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  yearly: 'Anual',
};

export function Subscriptions() {
  const location = useLocation();
  const { loadTransactions, transactions } = useTransactionStore();
  const { loadAccounts, accounts, loans } = useAccountStore();
  const { loadReceivables, receivables } = useReceivableStore();
  const { loadForAccounts, getMerged, transactionsByAccount } = useCreditDataStore();
  const initialTab = location.pathname.includes('/calendar') ? 'calendar' : 'subscriptions';
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    setTab(location.pathname.includes('/calendar') ? 'calendar' : 'subscriptions');
  }, [location.pathname]);

  const creditCards = useMemo(() => accounts.filter((a) => a.type === 'CREDIT'), [accounts]);
  const creditIds = useMemo(() => creditCards.map((c) => c.id), [creditCards]);

  useEffect(() => {
    loadTransactions();
    loadAccounts();
    loadReceivables();
  }, []);

  useEffect(() => {
    if (creditIds.length) loadForAccounts(creditIds);
  }, [creditIds.join(',')]);

  const allExpenseSources = useMemo(() => {
    const { transactions: cardTxs } = getMerged(creditIds);
    const seen = new Set();
    const merged = [];
    [...transactions, ...(cardTxs || [])].forEach((t) => {
      const id = t?.id;
      if (id != null) {
        if (seen.has(id)) return;
        seen.add(id);
      }
      merged.push(t);
    });
    return merged;
  }, [transactions, creditIds, getMerged, transactionsByAccount]);

  const subscriptions = useMemo(() => detectSubscriptions(allExpenseSources), [allExpenseSources]);
  const groupedSubscriptions = useMemo(() => groupSubscriptionsByKind(subscriptions), [subscriptions]);
  const monthlyTotal = useMemo(
    () => subscriptions.reduce((s, r) => s + (r.monthlyEquivalent || 0), 0),
    [subscriptions]
  );

  const calendarEvents = useMemo(() => {
    const events = [];
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 45);

    subscriptions.forEach((sub) => {
      const next = new Date(sub.nextDate);
      if (next >= now && next <= horizon) {
        events.push({
          id: `sub_${sub.id}`,
          date: next.toISOString().slice(0, 10),
          title: sub.name,
          amount: sub.amount,
          type: 'subscription',
          meta: sub.subscriptionKindLabel || FREQ_LABEL[sub.frequency] || sub.frequency,
        });
      }
    });

    transactions
      .filter((t) => t.isManual && isExpenseTx(t) && !t.isPaid)
      .forEach((t) => {
        const d = String(t.date).slice(0, 10);
        const dt = new Date(d);
        if (dt >= now && dt <= horizon) {
          events.push({
            id: `manual_${t.id}`,
            date: d,
            title: t.originalDescription || t.description,
            amount: Math.abs(Number(t.amount) || 0),
            type: 'manual',
            meta: 'Despesa manual',
          });
        }
      });

    if (creditCards.length) {
      try {
        const { transactions: cardTxs, bills: officialBills } = getMerged(creditIds);
        const built = buildCreditCardBills({
          transactions: cardTxs,
          officialBills,
          creditCards,
          selectedCardId: 'all',
        });
        Object.entries(built.bills || {}).forEach(([dueYm, bill]) => {
          if (bill.isPaid) return;
          const due = bill.dueDate ? String(bill.dueDate).slice(0, 10) : `${dueYm}-10`;
          const dt = new Date(due);
          if (dt < now || dt > horizon) return;
          events.push({
            id: `bill_${dueYm}`,
            date: due,
            title: `Fatura cartão (${dueYm})`,
            amount: Math.abs(Number(bill.total || 0)),
            type: 'bill',
            meta: formatDueMonthShort(dueYm, due),
          });
        });
      } catch {
        /* incomplete credit data */
      }
    }

    (loans || []).forEach((loan) => {
      const due = loan.dueDate || loan.nextPaymentDate;
      if (!due) return;
      const d = String(due).slice(0, 10);
      const dt = new Date(d);
      if (dt < now || dt > horizon) return;
      events.push({
        id: `loan_${loan.id}`,
        date: d,
        title: loan.name || 'Empréstimo',
        amount: Math.abs(Number(loan.installmentAmount || loan.paymentAmount || 0)),
        type: 'loan',
        meta: 'Parcela',
      });
    });

    (receivables || []).forEach((r) => {
      (r.installmentHistory || []).forEach((inst, idx) => {
        if (inst.paidAt) return;
        const due = inst.dueDate || inst.expectedAt;
        if (!due) return;
        const d = String(due).slice(0, 10);
        const dt = new Date(d);
        if (dt < now || dt > horizon) return;
        events.push({
          id: `recv_${r.id}_${idx}`,
          date: d,
          title: `A receber · ${r.personName || 'Contato'}`,
          amount: Math.abs(Number(inst.amount || 0)),
          type: 'receivable',
          meta: 'Recebível',
        });
      });
    });

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }, [subscriptions, transactions, creditCards, creditIds, loans, receivables, transactionsByAccount, getMerged]);

  const daysUntil = (isoDate) => {
    const d = new Date(isoDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.round((d - now) / (1000 * 60 * 60 * 24));
  };

  const typeIcon = (type) => {
    if (type === 'bill') return <CreditCard size={16} />;
    if (type === 'receivable') return <HandCoins size={16} />;
    if (type === 'subscription') return <Repeat size={16} />;
    return <CalendarDays size={16} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Assinaturas & Agenda</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Assinaturas detectadas nas compras (streaming, telecom, serviços…) e vencimentos dos próximos 45 dias.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
            COMPROMETIDO / MÊS
          </span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--primary)' }}>
            {formatCurrency(monthlyTotal)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {subscriptions.length} assinatura(s) · {groupedSubscriptions.length} categoria(s)
          </span>
        </Card>
        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
            PRÓXIMOS VENCIMENTOS
          </span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0' }}>
            {calendarEvents.length}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Nos próximos 45 dias
          </span>
        </Card>
        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
            ALERTAS (até 7 dias)
          </span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--danger)' }}>
            {calendarEvents.filter((e) => daysUntil(e.date) <= 7).length}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Faturas, despesas e assinaturas
          </span>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[
          { id: 'subscriptions', label: 'Assinaturas', icon: Repeat },
          { id: 'calendar', label: 'Calendário', icon: CalendarDays },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="input"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.45rem 0.9rem',
              cursor: 'pointer',
              background: tab === t.id ? 'var(--primary)' : 'var(--bg-tertiary)',
              color: tab === t.id ? '#fff' : 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'subscriptions' && (
        <>
          {subscriptions.length === 0 ? (
            <Card title="Assinaturas">
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Info size={32} style={{ marginBottom: 8 }} />
                <p>
                  Nenhuma assinatura detectada ainda. Conecte contas com cobranças recorrentes de streaming,
                  telecom ou serviços digitais.
                </p>
              </div>
            </Card>
          ) : (
            groupedSubscriptions.map((group) => (
              <Card
                key={group.kind}
                title={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {group.label}
                    <Badge variant="neutral">{group.items.length}</Badge>
                    <span style={{ fontWeight: 500, fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      ~{formatCurrency(group.monthlyTotal)}/mês
                    </span>
                  </span>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.5rem' }}>
                  {group.items.map((sub) => (
                    <div
                      key={sub.id}
                      className="list-row"
                      style={{ padding: '0.85rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}
                    >
                      <div className="list-row-main" style={{ gap: '0.75rem', minWidth: 0 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Repeat size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', margin: 0 }}>{sub.name}</h3>
                            <Badge variant="info">{FREQ_LABEL[sub.frequency] || sub.frequency}</Badge>
                            {sub.isManual && <Badge variant="neutral">Manual</Badge>}
                          </div>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            {sub.category} · {sub.occurrences} ocorrências · próxima {formatDate(sub.nextDate)}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700 }}>{formatCurrency(sub.amount)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          ~{formatCurrency(sub.monthlyEquivalent)}/mês
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {tab === 'calendar' && (
        <Card title="Próximos vencimentos (45 dias)">
          {calendarEvents.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Info size={32} style={{ marginBottom: 8 }} />
              <p>Nenhum vencimento nos próximos 45 dias.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.5rem' }}>
              {calendarEvents.map((ev) => {
                const days = daysUntil(ev.date);
                const urgent = days <= 7;
                return (
                  <div
                    key={ev.id}
                    className="list-row"
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      borderLeft: `3px solid ${urgent ? 'var(--danger)' : 'var(--primary)'}`,
                    }}
                  >
                    <div className="list-row-main" style={{ gap: '0.75rem' }}>
                      <div style={{ color: urgent ? 'var(--danger)' : 'var(--primary)' }}>{typeIcon(ev.type)}</div>
                      <div>
                        <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', margin: 0 }}>{ev.title}</h3>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {formatDate(ev.date)} · {ev.meta} ·{' '}
                          {days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: ev.type === 'receivable' ? 'var(--success)' : 'var(--text-primary)' }}>
                      {ev.type === 'receivable' ? '+' : '-'}
                      {formatCurrency(ev.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
