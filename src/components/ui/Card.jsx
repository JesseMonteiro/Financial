import React from 'react';

export function Card({ children, className = '', title, subtitle, action, onClick }) {
  return (
    <div 
      className={`glass-card ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      style={{ padding: 'var(--card-padding)' }}
    >
      {(title || subtitle || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            {title && <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>}
            {subtitle && <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
