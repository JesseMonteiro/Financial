import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { useIsMobile } from '../../hooks/useMediaQuery';

const sampleData = [
  { mês: 'Mar', receita: 11000, despesa: 4800 },
  { mês: 'Abr', receita: 11500, despesa: 5200 },
  { mês: 'Mai', receita: 11200, despesa: 4900 },
  { mês: 'Jun', receita: 12000, despesa: 5500 },
  { mês: 'Jul', receita: 12745, despesa: 5263 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-chart-tooltip">
        <p className="tooltip-title">{label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ color: 'var(--success)' }}>Receitas: {formatCurrency(payload[0].value)}</span>
          <span style={{ color: 'var(--danger)' }}>Despesas: {formatCurrency(payload[1].value)}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function IncomeVsExpenseChart({ data = sampleData, height }) {
  const isMobile = useIsMobile();
  const chartHeight = height ?? (isMobile ? 200 : 280);
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
          <Bar dataKey="receita" name="Receita" fill="var(--success)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="despesa" name="Despesa" fill="var(--danger)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
