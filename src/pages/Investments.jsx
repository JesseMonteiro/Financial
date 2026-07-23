import React, { useEffect, useMemo } from 'react';
import { Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useInvestmentStore } from '../stores/investmentStore';
import { useAccountStore } from '../stores/accountStore';
import { formatCurrency } from '../utils/formatters';
import { getCategoryColor } from '../utils/colors';
import { investmentAllocation, investmentByIssuer } from '../utils/analytics';
import { calculateNetWorth } from '../utils/calculations';
import { useIsMobile } from '../hooks/useMediaQuery';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-chart-tooltip">
      <p className="tooltip-title">{payload[0].name || payload[0].payload?.name}</p>
      <p style={{ fontWeight: 600 }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export function Investments() {
  const { investments, loadInvestments, getTotalInvested } = useInvestmentStore();
  const { loadAccounts, accounts, loans } = useAccountStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    loadInvestments();
    loadAccounts();
  }, []);

  const totalInvested = getTotalInvested();
  const allocation = useMemo(() => investmentAllocation(investments), [investments]);
  const byIssuer = useMemo(() => investmentByIssuer(investments), [investments]);
  const nw = useMemo(() => calculateNetWorth(accounts, investments, loans), [accounts, investments, loans]);
  const pctOfWealth = nw.totalAssets > 0 ? Math.round((totalInvested / nw.totalAssets) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Investimentos & Portfólio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Posições sincronizadas via Open Finance, com alocação por tipo e emissor.
        </p>
      </div>

      <div className="dashboard-grid">
        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL EM INVESTIMENTOS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0', color: 'var(--primary)' }}>
            {formatCurrency(totalInvested)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {pctOfWealth}% dos ativos totais
          </span>
        </Card>

        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>ATIVOS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0' }}>
            {investments.length}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Posições sincronizadas
          </span>
        </Card>

        <Card className="col-4">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>TIPOS</span>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.5rem 0' }}>
            {allocation.length}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Classes / subtipos na carteira
          </span>
        </Card>
      </div>

      {investments.length > 0 && (
        <div className="dashboard-grid">
          <Card className="col-6" title="Alocação por tipo">
            <div style={{ width: '100%', height: isMobile ? 220 : 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 40 : 55}
                    outerRadius={isMobile ? 70 : 90}
                    paddingAngle={3}
                  >
                    {allocation.map((entry) => (
                      <Cell key={entry.name} fill={getCategoryColor(entry.name)} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="col-6" title="Por emissor / instituição">
            <div style={{ width: '100%', height: isMobile ? 220 : 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byIssuer} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={11} stroke="var(--text-muted)" />
                  <YAxis type="category" dataKey="name" width={isMobile ? 70 : 110} fontSize={11} stroke="var(--text-muted)" tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" fill="var(--info)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <Card title={`Sua Carteira (${investments.length})`}>
        {investments.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={32} style={{ marginBottom: '0.5rem' }} />
            <p>Nenhum investimento ativo encontrado nas suas contas conectadas.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {investments.map((inv) => {
              const value = inv.balance || inv.amount || 0;
              const share = totalInvested > 0 ? Math.round((value / totalInvested) * 100) : 0;
              return (
                <div
                  key={inv.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', margin: 0 }}>{inv.name}</h3>
                      <Badge variant={inv.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {inv.status === 'ACTIVE' ? 'Ativo' : inv.status || 'Posição'}
                      </Badge>
                      <Badge variant="info">{inv.subtype || inv.type}</Badge>
                    </div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Emissor: {inv.issuer || inv.institution || 'Banco'} · {share}% da carteira
                      {inv.dueDate ? ` · Venc. ${new Date(inv.dueDate).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>
                      {formatCurrency(value)}
                    </span>
                    {inv.rate && (
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)', margin: 0 }}>
                        Rentabilidade: {inv.rate}% {inv.rateType || 'CDI'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
