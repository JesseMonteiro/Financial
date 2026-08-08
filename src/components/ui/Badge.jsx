import React from 'react';

export function Badge({ children, variant = 'neutral', className = '', style, ...rest }) {
  return (
    <span className={`badge badge-${variant} ${className}`} style={style} {...rest}>
      {children}
    </span>
  );
}
