import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { useIsMobile } from '../../hooks/useMediaQuery';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-chart-tooltip">
      <p className="tooltip-title">{payload[0].payload.name}</p>
      <p style={{ fontWeight: 600 }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export function MerchantSpendChart({ data = [], height }) {
  const isMobile = useIsMobile();
  const chartHeight = height ?? (isMobile ? 240 : 320);
  const chartData = [...data].reverse();

  if (!data.length) {
    return (
      <div style={{ width: '100%', height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
        Sem dados de merchants no período
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
          <Bar dataKey="value" name="Gasto" fill="var(--primary)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
