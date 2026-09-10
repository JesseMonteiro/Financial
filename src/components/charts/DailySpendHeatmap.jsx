import React, { useMemo, useState } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { formatCurrency } from '../../utils/formatters';
import { ChartEmpty } from './ChartEmpty';

export function DailySpendHeatmap({ data = [], height }) {
  const isMobile = useIsMobile();
  const chartHeight = height ?? (isMobile ? 140 : 160);
  const [hover, setHover] = useState(null);

  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value || 0)), [data]);

  if (!data.length) {
    return <ChartEmpty message="Sem gastos diários no mês" height={chartHeight} />;
  }

  return (
    <div style={{ width: '100%', minHeight: chartHeight, position: 'relative' }}>
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
              className="heatmap-cell"
              onMouseEnter={(e) => setHover({ ...d, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover({ ...d, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              style={{
                background: d.value
                  ? `color-mix(in srgb, var(--danger) ${Math.round(20 + intensity * 70)}%, var(--bg-tertiary))`
                  : 'var(--bg-tertiary)',
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
      {hover && (
        <div
          className="chart-tooltip"
          style={{
            position: 'fixed',
            left: hover.x + 12,
            top: hover.y + 12,
            zIndex: 80,
            pointerEvents: 'none',
          }}
        >
          <p className="tooltip-title">Dia {hover.day}</p>
          <p style={{ fontWeight: 600 }}>{formatCurrency(hover.value)}</p>
        </div>
      )}
    </div>
  );
}
