import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { getCategoryColor } from '../../utils/colors';
import { translateCategory } from '../../utils/categories';
import { useTransactionStore } from '../../stores/transactionStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="custom-chart-tooltip">
        <p className="tooltip-title">{data.name}</p>
        <p style={{ fontWeight: 600, color: data.payload.fill }}>
          {formatCurrency(data.value)}
        </p>
      </div>
    );
  }
  return null;
};

export function ExpenseByCategoryChart({ data = null, height }) {
  const { transactions } = useTransactionStore();
  const isMobile = useIsMobile();
  const chartHeight = height ?? (isMobile ? 200 : 280);

  // If data prop is passed explicitly, use it; otherwise compute from real Pluggy transactions
  const chartData = useMemo(() => {
    if (data && data.length > 0) {
      return data;
    }

    if (!transactions || transactions.length === 0) {
      return [];
    }

    const map = {};
    transactions.forEach(t => {
      // Exclude credit card payment receipts from expense category breakdown
      if (t.description?.toUpperCase().includes('PAGAMENTO DE FATURA')) return;

      // Count debits / expenses
      if (t.amount < 0 || t.type === 'DEBIT' || t.amount > 0) {
        const catLabel = translateCategory(t.category);
        const amt = Math.abs(t.amount);
        if (!map[catLabel]) map[catLabel] = 0;
        map[catLabel] += amt;
      }
    });

    const list = Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    return list.slice(0, 7); // Top 7 categories
  }, [data, transactions]);

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ width: '100%', height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
        Sem dados de despesas por categoria
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={isMobile ? 40 : 55}
            outerRadius={isMobile ? 70 : 85}
            paddingAngle={4}
            dataKey="value"
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
    </div>
  );
}
