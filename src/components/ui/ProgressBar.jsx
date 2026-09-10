import React from 'react';

export function ProgressBar({ percent = 0, color = 'var(--primary)', height = 8 }) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div
      className="progress-track"
      style={{ height: `${height}px` }}
    >
      <div
        className="progress-fill"
        style={{
          width: `${clampedPercent}%`,
          backgroundColor: color,
          '--progress-color': color,
        }}
      />
    </div>
  );
}
