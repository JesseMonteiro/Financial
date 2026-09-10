import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Spinner } from './Spinner';

export function PaidCheckbox({
  checked,
  onChange,
  busy = false,
  label = 'Pago',
  size = 14,
}) {
  return (
    <label
      className="tap-target paid-checkbox"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        cursor: busy ? 'wait' : 'pointer',
        fontSize: size <= 14 ? '11px' : '10px',
        fontWeight: 600,
        color: checked ? 'var(--success)' : 'var(--text-muted)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        opacity: busy ? 0.85 : 1,
        minWidth: 'auto',
        padding: '0 0.25rem',
      }}
      title={busy ? 'Salvando…' : 'Marcar como pago (apenas controle; não altera saldo)'}
      aria-busy={busy || undefined}
    >
      {busy ? (
        <Spinner size={size} />
      ) : (
        <input
          type="checkbox"
          checked={Boolean(checked)}
          disabled={busy}
          onChange={(e) => {
            if (busy) return;
            onChange(e.target.checked);
          }}
          style={{
            width: size,
            height: size,
            cursor: 'pointer',
            accentColor: 'var(--success)',
          }}
        />
      )}
      {checked ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <CheckCircle2 size={Math.max(11, size - 2)} /> {label}
        </span>
      ) : (
        label
      )}
    </label>
  );
}
