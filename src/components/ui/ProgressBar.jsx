import React from 'react';

export function ProgressBar({ percent = 0, color = 'var(--primary)', height = 8 }) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  
  return (
    <div style={{
      width: '100%',
      backgroundColor: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-full)',
      height: `${height}px`,
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${clampedPercent}%`,
        backgroundColor: color,
        height: '100%',
        borderRadius: 'var(--radius-full)',
        transition: 'width var(--transition-normal)'
      }} />
    </div>
  );
}
