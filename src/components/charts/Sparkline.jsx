import React, { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

export function Sparkline({ data = [], dataKey = 'value', color = 'var(--primary)', height = 40 }) {
  const reduce = usePrefersReducedMotion();
  const gid = useId().replace(/:/g, '');

  if (!data.length) return null;

  return (
    <div style={{ width: '100%', height, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-${gid})`}
            isAnimationActive={!reduce}
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
