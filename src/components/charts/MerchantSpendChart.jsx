import React, { useId } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ChartEmpty } from './ChartEmpty';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-title">{payload[0].payload.name}</p>
      <p style={{ fontWeight: 600 }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export function MerchantSpendChart({ data = [], height }) {
  const isMobile = useIsMobile();
  const reduce = usePrefersReducedMotion();
  const chartHeight = height ?? (isMobile ? 240 : 320);
  const chartData = [...data].reverse();
  const gid = useId().replace(/:/g, '');

  if (!data.length) {
    return <ChartEmpty message="Sem dados de merchants no período" height={chartHeight} />;
  }

  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id={`merchantFill-${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.75} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
          <YAxis
            type="category"
            dataKey="name"
            width={isMobile ? 90 : 140}
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            tickFormatter={(v) => (v.length > 18 ? `${v.slice(0, 16)}…` : v)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="value"
            name="Gasto"
            fill={`url(#merchantFill-${gid})`}
            radius={[0, 8, 8, 0]}
            isAnimationActive={!reduce}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
