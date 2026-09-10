import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ChartEmpty } from './ChartEmpty';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-title">{label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: 'var(--success)' }}>Receitas: {formatCurrency(payload[0]?.value)}</span>
          <span style={{ color: 'var(--danger)' }}>Despesas: {formatCurrency(payload[1]?.value)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function IncomeVsExpenseChart({ data = [], height }) {
  const isMobile = useIsMobile();
  const reduce = usePrefersReducedMotion();
  const chartHeight = height ?? (isMobile ? 200 : 280);

  if (!data || data.length === 0) {
    return <ChartEmpty message="Sem dados de fluxo de caixa para o período" height={chartHeight} />;
  }

  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="mês" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
          {!isMobile && (
            <YAxis
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar
            dataKey="receita"
            name="Receita"
            fill="var(--success)"
            radius={[8, 8, 0, 0]}
            isAnimationActive={!reduce}
            animationDuration={800}
          />
          <Bar
            dataKey="despesa"
            name="Despesa"
            fill="var(--danger)"
            radius={[8, 8, 0, 0]}
            isAnimationActive={!reduce}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
