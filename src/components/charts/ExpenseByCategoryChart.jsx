import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { getCategoryColor } from '../../utils/colors';
import { expensesByCategory } from '../../utils/analytics';
import { useTransactionStore } from '../../stores/transactionStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ChartEmpty } from './ChartEmpty';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="chart-tooltip">
        <p className="tooltip-title">{data.name}</p>
        <p style={{ fontWeight: 600, color: data.payload.fill }}>
          {formatCurrency(data.value)}
        </p>
      </div>
    );
  }
  return null;
};

export function ExpenseByCategoryChart({ data = null, height, ym }) {
  const { transactions } = useTransactionStore();
  const isMobile = useIsMobile();
  const reduce = usePrefersReducedMotion();
  const chartHeight = height ?? (isMobile ? 200 : 280);

  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    return expensesByCategory(transactions || [], { limit: 7, ym });
  }, [data, transactions, ym]);

  const total = useMemo(
    () => (chartData || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0),
    [chartData]
  );

  if (!chartData || chartData.length === 0) {
    return <ChartEmpty message="Sem dados de despesas por categoria" height={chartHeight} />;
  }

  return (
    <div className="chart-donut-wrap" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="46%"
            innerRadius={isMobile ? 44 : 62}
            outerRadius={isMobile ? 72 : 88}
            paddingAngle={6}
            dataKey="value"
            stroke="none"
            isAnimationActive={!reduce}
            animationDuration={800}
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={getCategoryColor(entry.name)} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={42}
            formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="chart-donut-center">
        <strong>{formatCurrency(total)}</strong>
        <span>total</span>
      </div>
    </div>
  );
}
