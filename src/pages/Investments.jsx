import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useInvestmentStore } from '../stores/investmentStore';
import { useAccountStore } from '../stores/accountStore';
import { useJointStore } from '../stores/jointStore';
import { formatCurrency } from '../utils/formatters';
import { getCategoryColor } from '../utils/colors';
import { investmentAllocation, investmentByIssuer } from '../utils/analytics';
import { calculateNetWorth } from '../utils/calculations';
import { isInitialEmpty } from '../utils/loading';
import { useIsMobile } from '../hooks/useMediaQuery';
import { AccountIcon, accountById } from '../components/AccountIcon';

const SCOPE_OPTIONS = [
  { id: 'personal', label: 'Pessoal' },
  { id: 'joint', label: 'Conjunta' },
];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-title">{payload[0].name || payload[0].payload?.name}</p>
      <p style={{ fontWeight: 600 }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

function totalFromInvestments(list) {
  return (list || []).reduce((acc, i) => acc + (i.balance || i.amount || 0), 0);
}

function PortfolioView({
  investments,
  accounts,
  loans = [],
  showOwner = false,
  listTitle,
  emptyMessage,
  isMobile,
}) {
  const totalInvested = useMemo(() => totalFromInvestments(investments), [investments]);
  const allocation = useMemo(() => investmentAllocation(investments), [investments]);
  const byIssuer = useMemo(() => investmentByIssuer(investments), [investments]);
  const nw = useMemo(() => calculateNetWorth(accounts, investments, loans), [accounts, investments, loans]);
  const pctOfWealth = nw.totalAssets > 0 ? Math.round((totalInvested / nw.totalAssets) * 100) : 0;

  return (
    <>
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

      <Card title={`${listTitle} (${investments.length})`}>
        {investments.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={32} style={{ marginBottom: '0.5rem' }} />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {investments.map((inv) => {
              const value = inv.balance || inv.amount || 0;
              const share = totalInvested > 0 ? Math.round((value / totalInvested) * 100) : 0;
              const subtypeLabel = inv.subtype === 'CAIXINHA' ? 'Caixinha' : (inv.subtype || inv.type);
              const ownerName = inv.ownerLabel || inv.owner;
              return (
                <div
                  key={`${inv.ownerUserId || 'self'}-${inv.id}`}
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
                      <Badge variant="info">{subtypeLabel}</Badge>
                      {showOwner && ownerName ? (
                        <Badge variant="neutral" style={{ fontSize: '9px' }}>{ownerName}</Badge>
                      ) : null}
                    </div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      Emissor: {inv.issuer || inv.institution || 'Banco'} · {share}% da carteira
                      {inv.sourceAccountName ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          · Conta: <AccountIcon account={accountById(accounts, inv.sourceAccountId)} size={14} /> {inv.sourceAccountName}
                        </span>
                      ) : null}
                      {!showOwner && inv.owner ? ` · Titular: ${inv.owner}` : ''}
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
    </>
  );
}

export function Investments() {
  const { investments, loadInvestments, loading: invLoading, lastUpdated: invAt } = useInvestmentStore();
  const { loadAccounts, accounts, loans, loading: accLoading, lastUpdated: accAt } = useAccountStore();
  const hasJoint = useJointStore((s) => s.link?.status === 'active');
  const loadJointInvestments = useJointStore((s) => s.loadInvestments);
  const jointInvestments = useJointStore((s) => s.investments);
  const jointAccounts = useJointStore((s) => s.investmentAccounts);
  const jointInvLoading = useJointStore((s) => s.investmentsLoading);
  const jointInvAt = useJointStore((s) => s.investmentsLoadedAt);
  const isMobile = useIsMobile();
  const [scope, setScope] = useState('personal');

  useEffect(() => {
    loadInvestments();
    loadAccounts();
  }, []);

  useEffect(() => {
    if (!hasJoint) {
      setScope('personal');
      return;
    }
    loadJointInvestments().catch(console.error);
  }, [hasJoint, loadJointInvestments]);

  const isJoint = hasJoint && scope === 'joint';
  const displayInvestments = isJoint ? jointInvestments : investments;
  const displayAccounts = isJoint ? jointAccounts : accounts;
  const displayLoans = isJoint ? [] : loans;

  const personalLoading = isInitialEmpty(investments, invLoading, invAt)
    || isInitialEmpty(accounts, accLoading, accAt);
  const jointLoading = isJoint && isInitialEmpty(jointInvestments, jointInvLoading, jointInvAt);
  const showSkeleton = isJoint ? jointLoading : personalLoading;

  if (!hasJoint && personalLoading) {
    return (
      <PageLoadingSkeleton
        kpiCount={3}
        showTimeline={false}
        showChart
        showList
        label="Carregando investimentos…"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Investimentos & Portfólio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          {isJoint
            ? 'Visão consolidada das posições de vocês dois, via Open Finance.'
            : 'Posições sincronizadas via Open Finance, com alocação por tipo e emissor.'}
        </p>
        {hasJoint && (
          <div style={{ marginTop: '0.85rem' }}>
            <SegmentedControl
              layoutId="investments-scope"
              value={scope}
              onChange={setScope}
              options={SCOPE_OPTIONS}
            />
          </div>
        )}
      </div>

      {showSkeleton ? (
        <PageLoadingSkeleton
          kpiCount={3}
          showTimeline={false}
          showChart
          showList
          label={isJoint ? 'Carregando carteira conjunta…' : 'Carregando investimentos…'}
        />
      ) : (
        <PortfolioView
          investments={displayInvestments}
          accounts={displayAccounts}
          loans={displayLoans}
          showOwner={isJoint}
          listTitle={isJoint ? 'Carteira conjunta' : 'Sua Carteira'}
          emptyMessage={
            isJoint
              ? 'Nenhum investimento ativo encontrado nas contas conectadas de vocês dois.'
              : 'Nenhum investimento ativo encontrado nas suas contas conectadas.'
          }
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
