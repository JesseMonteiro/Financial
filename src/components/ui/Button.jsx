import React from 'react';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'danger'
  size = 'md',
  icon: Icon,
  className = '',
  disabled = false,
  loading = false,
  onClick,
  type = 'button'
}) {
  const isDisabled = disabled || loading;
  const iconSize = size === 'sm' || size === 'xs' ? 14 : 18;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} ${loading ? 'is-loading' : ''} ${className}`}
    >
      {loading ? (
        <Loader2 className="spinner" size={iconSize} aria-hidden />
      ) : (
        Icon && <Icon size={iconSize} />
      )}
      {children}
    </button>
  );
}
