import React from 'react';
import { BarChart3 } from 'lucide-react';

export function ChartEmpty({ message = 'Sem dados para o período', height = 200, icon: Icon = BarChart3 }) {
  return (
    <div className="chart-empty" style={{ height }}>
      <Icon size={28} strokeWidth={1.6} aria-hidden />
      <p>{message}</p>
    </div>
  );
}
