import React, { useEffect } from 'react';
import { TrendingUp, ArrowUpRight, DollarSign, Award, Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useInvestmentStore } from '../stores/investmentStore';
import { formatCurrency } from '../utils/formatters';

export function Investments() {
  const { investments, loadInvestments, getTotalInvested, loading } = useInvestmentStore();

  useEffect(() => {
    loadInvestments();
  }, []);

  const totalInvested = getTotalInvested();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Investimentos & Portfólio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Posições e ativos reais sincronizados das suas contas do Pluggy.
        </p>
      </div>

      {/* Summary Row */}
      <div className="dashboard-grid">
        <Card className="col-6">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL EM INVESTIMENTOS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--primary)' }}>
            {formatCurrency(totalInvested)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Soma dos saldos atuais nas suas contas
          </span>
        </Card>

        <Card className="col-6">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL DE ATIVOS ENCONTRADOS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0' }}>
            {investments.length} {investments.length === 1 ? 'Ativo' : 'Ativos'}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Sincronizado via Open Finance
          </span>
        </Card>
      </div>

      {/* Investments List */}
      <Card title={`Sua Carteira de Ativos Reais (${investments.length})`}>
        {investments.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={32} style={{ marginBottom: '0.5rem' }} />
            <p>Nenhum investimento ativo encontrado nas suas contas conectadas.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {investments.map(inv => (
              <div key={inv.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>{inv.name}</h3>
                    <Badge variant={inv.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {inv.status === 'ACTIVE' ? 'Ativo' : inv.status || 'Posição'}
                    </Badge>
                    <Badge variant="info">{inv.subtype || inv.type}</Badge>
                  </div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Emissor: {inv.issuer || inv.institution || 'Banco'} • Vencimento: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('pt-BR') : 'Indeterminado'}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>
                    {formatCurrency(inv.balance || inv.amount)}
                  </span>
                  {inv.rate && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)' }}>
                      Rentabilidade: {inv.rate}% {inv.rateType || 'CDI'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
