import React, { useMemo } from 'react';
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { getCategoryColor } from '../../utils/colors';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { ChartEmpty } from './ChartEmpty';

function SankeyNode({ x, y, width, height, index, payload }) {
  const color =
    payload.name === 'Receitas' || payload.name === 'Despesas'
      ? 'var(--primary)'
      : payload.name === 'Saldo positivo'
        ? 'var(--success)'
        : getCategoryColor(payload.name);
  return (
    <Layer key={`node-${index}`}>
      <Rectangle x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.85} radius={4} />
      <text
        x={x + width + 6}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={11}
        fill="var(--text-secondary)"
      >
        {payload.name}
      </text>
    </Layer>
  );
}

function SankeyLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  index,
  payload,
}) {
  const targetName = payload?.target?.name || payload?.payload?.target?.name || '';
  const color =
    targetName === 'Saldo positivo'
      ? 'var(--success)'
      : targetName === 'Despesas' || targetName === 'Receitas'
        ? 'var(--primary)'
        : getCategoryColor(targetName) || 'var(--primary)';
  return (
    <path
      d={`
        M${sourceX},${sourceY}
        C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
      `}
      fill="none"
      stroke={color}
      strokeOpacity={0.35}
      strokeWidth={linkWidth}
      key={`link-${index}`}
    />
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const value = p.value ?? p.payload?.value;
  const name = p.name || `${p.source?.name || ''} → ${p.target?.name || ''}`;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-title">{name}</p>
      {value != null && <p style={{ fontWeight: 600 }}>{formatCurrency(value)}</p>}
    </div>
  );
};

export function CashflowSankeyChart({ data, height }) {
  const isMobile = useIsMobile();
  const chartHeight = height ?? (isMobile ? 260 : 360);

  const sankeyData = useMemo(() => {
    if (!data?.nodes?.length || !data?.links?.length) return null;
    return { nodes: data.nodes, links: data.links };
  }, [data]);

  if (!sankeyData) {
    return <ChartEmpty message="Sem fluxo suficiente para o diagrama Sankey" height={chartHeight} />;
  }

  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={sankeyData}
          nodeWidth={12}
          nodePadding={28}
          margin={{ left: 8, right: isMobile ? 80 : 120, top: 12, bottom: 12 }}
          linkCurvature={0.5}
          node={<SankeyNode />}
          link={<SankeyLink />}
        >
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
