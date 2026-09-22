import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { getCategoryColor } from '../../utils/colors';
import { expensesByCategory } from '../../utils/analytics';
import { useTransactionStore } from '../../stores/transactionStore';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { ChartEmpty } from './ChartEmpty';

const CustomTooltip = ({ active, payload, total }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
    return (
      <div className="chart-tooltip">
        <p className="tooltip-title">{data.name}</p>
        <p style={{ fontWeight: 600, color: data.payload.fill, margin: '2px 0' }}>
          {formatCurrency(data.value)} ({pct}%)
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

  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    return expensesByCategory(transactions || [], { limit: 6, ym });
  }, [data, transactions, ym]);

  const total = useMemo(
    () => (chartData || []).reduce((sum, row) => sum + (Number(row.value) || 0), 0),
    [chartData]
  );

  if (!chartData || chartData.length === 0) {
    return <ChartEmpty message="Sem dados de despesas por categoria" height={height ?? 220} />;
  }

  const donutHeight = isMobile ? 150 : 165;

  return (
    <div className="chart-category-wrap" style={height ? { minHeight: height } : undefined}>
      <div className="chart-donut-stage" style={{ height: donutHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? 42 : 50}
              outerRadius={isMobile ? 64 : 74}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              isAnimationActive={!reduce}
              animationDuration={700}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={getCategoryColor(entry.name)} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="chart-donut-center">
          <strong>{formatCurrency(total)}</strong>
          <span>total</span>
        </div>
      </div>

      <div className="chart-category-legend">
        {chartData.map((entry) => {
          const color = getCategoryColor(entry.name);
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
          return (
            <div
              key={entry.name}
              className="chart-category-item"
              title={`${entry.name}: ${formatCurrency(entry.value)} (${pct}%)`}
            >
              <span className="chart-category-bullet" style={{ backgroundColor: color }} />
              <span className="chart-category-name">{entry.name}</span>
              <span className="chart-category-val">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
