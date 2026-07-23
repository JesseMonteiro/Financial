import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { getCategoryColor } from '../../utils/colors';
import { useIsMobile } from '../../hooks/useMediaQuery';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-chart-tooltip">
      <p className="tooltip-title">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontSize: 12 }}>
          {p.name}: {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  );
};

export function CategoryTrendChart({ data = [], categories = [], height }) {
  const isMobile = useIsMobile();
  const chartHeight = height ?? (isMobile ? 220 : 300);

  if (!data.length || !categories.length) {
    return (
      <div style={{ width: '100%', height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
        Sem tendência de categorias no período
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mês" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {categories.map((cat) => (
            <Bar key={cat} dataKey={cat} stackId="a" fill={getCategoryColor(cat)} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
