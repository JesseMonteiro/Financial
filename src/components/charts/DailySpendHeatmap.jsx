import React, { useMemo } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { formatCurrency } from '../../utils/formatters';

export function DailySpendHeatmap({ data = [], height }) {
  const isMobile = useIsMobile();
  const chartHeight = height ?? (isMobile ? 140 : 160);

  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value || 0)), [data]);

  if (!data.length) {
    return (
      <div style={{ width: '100%', height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
        Sem gastos diários no mês
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minHeight: chartHeight }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${isMobile ? 7 : 10}, minmax(0, 1fr))`,
          gap: 6,
        }}
      >
        {data.map((d) => {
          const intensity = d.value / max;
          return (
            <div
              key={d.day}
              title={`Dia ${d.day}: ${formatCurrency(d.value)}`}
              style={{
                aspectRatio: '1',
                borderRadius: 6,
                background: d.value
                  ? `color-mix(in srgb, var(--danger) ${Math.round(20 + intensity * 70)}%, var(--bg-tertiary))`
                  : 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {d.day}
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        Intensidade = valor gasto no dia. Passe o mouse para ver o total.
      </p>
    </div>
  );
}
