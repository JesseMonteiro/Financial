import React from 'react';

/**
 * Shimmer placeholder block. Uses global `.skeleton-shimmer` from animations.css.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 'var(--radius-md)',
  style = {},
  className = '',
}) {
  return (
    <div
      className={`skeleton-shimmer ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/** Rounded card shell with shimmer lines — matches KPI / panel layout. */
export function SkeletonCard({ lines = 3, className = '', style = {} }) {
  const widths = ['40%', '70%', '55%', '85%', '45%'];
  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            width={widths[i % widths.length]}
            height={i === 1 ? 28 : 12}
          />
        ))}
      </div>
    </div>
  );
}

/** Horizontal strip of bill/month chips. */
export function SkeletonTimeline({ count = 5 }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', overflow: 'hidden', padding: '0.5rem 0' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          width={170}
          height={96}
          borderRadius="var(--radius-lg)"
        />
      ))}
    </div>
  );
}

/** List of transaction / detail rows. */
export function SkeletonList({ rows = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <Skeleton width={36} height={36} borderRadius="50%" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <Skeleton width={`${55 + (i % 3) * 12}%`} height={14} />
            <Skeleton width={`${35 + (i % 4) * 8}%`} height={10} />
          </div>
          <Skeleton width={72} height={16} />
        </div>
      ))}
    </div>
  );
}

/** Full-page loading layout for credit / financial screens. */
export function PageLoadingSkeleton({
  showKpis = true,
  kpiCount = 4,
  showTimeline = true,
  showChart = false,
  showList = true,
  label = 'Carregando dados…',
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}
    >
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        {label}
      </span>

      {showKpis && (
        <div className="dashboard-grid">
          {Array.from({ length: kpiCount }).map((_, i) => (
            <SkeletonCard
              key={i}
              className={kpiCount <= 3 ? 'col-4' : 'col-3'}
              lines={3}
            />
          ))}
        </div>
      )}

      {showTimeline && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
          }}
        >
          <Skeleton width="30%" height={14} style={{ marginBottom: '0.75rem' }} />
          <SkeletonTimeline count={6} />
        </div>
      )}

      {showChart && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
          }}
        >
          <Skeleton width="40%" height={14} style={{ marginBottom: '1rem' }} />
          <Skeleton width="100%" height={200} borderRadius="var(--radius-md)" />
        </div>
      )}

      {showList && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
          }}
        >
          <Skeleton width="45%" height={14} style={{ marginBottom: '1rem' }} />
          <SkeletonList rows={5} />
        </div>
      )}
    </div>
  );
}
