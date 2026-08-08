import React, { useEffect, useMemo } from 'react';
import { Repeat, Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useTransactionStore } from '../stores/transactionStore';
import { useAccountStore } from '../stores/accountStore';
import { useCreditDataStore } from '../stores/creditDataStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { detectSubscriptions, groupSubscriptionsByKind } from '../utils/subscriptions';

const FREQ_LABEL = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  yearly: 'Anual',
};

export function Subscriptions() {
  const { loadTransactions, transactions } = useTransactionStore();
  const { loadAccounts, accounts } = useAccountStore();
  const { loadForAccounts, getMerged, transactionsByAccount } = useCreditDataStore();

  const creditCards = useMemo(() => accounts.filter((a) => a.type === 'CREDIT'), [accounts]);
  const creditIds = useMemo(() => creditCards.map((c) => c.id), [creditCards]);

  useEffect(() => {
    loadTransactions();
    loadAccounts();
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Assinaturas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Assinaturas e cobranças recorrentes detectadas nas suas compras (streaming, telecom, serviços…).
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card className="col-6">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
            COMPROMETIDO / MÊS
          </span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--primary)' }}>
            {formatCurrency(monthlyTotal)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Equivalente mensal estimado
          </span>
        </Card>
        <Card className="col-6">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
            ASSINATURAS ATIVAS
          </span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0' }}>
            {subscriptions.length}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {groupedSubscriptions.length} categoria(s)
          </span>
        </Card>
      </div>

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
    </div>
  );
}
