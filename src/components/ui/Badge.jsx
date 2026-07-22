import React from 'react';

export function Badge({ children, variant = 'neutral', className = '', style }) {
  return (
    <span className={`badge badge-${variant} ${className}`} style={style}>
      {children}
    </span>
  );
}
