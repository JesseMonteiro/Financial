import React, { useEffect } from 'react';
import { Landmark, Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useAccountStore } from '../stores/accountStore';
import { formatCurrency } from '../utils/formatters';

export function Loans() {
  const { loans, loadAccounts } = useAccountStore();

  useEffect(() => {
    loadAccounts();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Empréstimos & Financiamentos</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Contratos de crédito reais sincronizados das suas contas do Pluggy.
        </p>
      </div>

      <Card title={`Empréstimos Encontrados (${loans.length})`}>
        {loans.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Info size={36} style={{ color: 'var(--text-muted)' }} />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Nenhum empréstimo ativo</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', maxWidth: 450 }}>
              Você não possui nenhum contrato de empréstimo ou financiamento ativo registrado nas suas contas bancárias sincronizadas.
            </p>
          </div>
        ) : (
          <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
            {loans.map(loan => {
              const pctPaid = Math.round((loan.paidInstallments / loan.totalInstallments) * 100);
              return (
                <Card key={loan.id} className="col-6">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)' }}>
                        <Landmark size={24} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>{loan.name}</h3>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          Taxa de juros: {loan.interestRate}% a.a.
                        </span>
                      </div>
                    </div>
                    <Badge variant="warning">Em Dia</Badge>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Saldo Devedor Atual</span>
                      <h4 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--danger)' }}>
                        {formatCurrency(loan.balance)}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                      <span>Parcela Mensal: <strong>{formatCurrency(loan.monthlyInstallment)}</strong></span>
                      <span>{loan.paidInstallments} de {loan.totalInstallments} pagas ({pctPaid}%)</span>
                    </div>

                    <ProgressBar percent={pctPaid} color="var(--success)" height={10} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
