import React from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ size = 20, className = '' }) {
  return <Loader2 className={`spinner ${className}`.trim()} size={size} aria-hidden />;
}

export function SavingOverlay({ active, label = 'Salvando alterações…' }) {
  if (!active) return null;
  return (
    <div className="saving-overlay" role="status" aria-live="polite" aria-busy="true">
      <Spinner size={28} />
      <span>{label}</span>
    </div>
  );
}

export function SavingScope({ active, children, label, className = '' }) {
  return (
    <div className={`saving-scope ${className}`.trim()}>
      {children}
      <SavingOverlay active={active} label={label} />
    </div>
  );
}

export function IconBusyButton({
  busy = false,
  onClick,
  title,
  children,
  className = 'tap-target',
  disabled = false,
  style,
  type = 'button',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={className}
      style={{
        border: 'none',
        background: 'transparent',
        cursor: busy || disabled ? 'not-allowed' : 'pointer',
        padding: 2,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {busy ? <Spinner size={16} /> : children}
    </button>
  );
}
