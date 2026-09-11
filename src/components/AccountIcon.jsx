import React from 'react';
import { Building2, CreditCard } from 'lucide-react';

function FallbackGlyph({ type, size }) {
  const Icon = type === 'CREDIT' ? CreditCard : Building2;
  return <Icon size={Math.max(12, Math.round(size * 0.5))} />;
}

/**
 * Bank/card mark. Uses resolved `account.iconUrl` when present.
 */
export function AccountIcon({
  account,
  src,
  type,
  size = 24,
  onClick,
  title,
  className = '',
  style,
}) {
  const [broken, setBroken] = React.useState(false);
  const url = src || account?.iconUrl || null;
  const showImg = Boolean(url) && !broken;
  const kind = type || account?.type || 'BANK';
  const bg = account?.iconColor || account?.bankData?.primaryColor || 'var(--primary)';
  const radius = Math.max(6, Math.round(size * 0.22));

  React.useEffect(() => {
    setBroken(false);
  }, [url]);

  const body = (
    <span
      className={`account-icon ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: showImg ? 'var(--bg-tertiary)' : bg,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: showImg ? 'inset 0 0 0 1px var(--border-color)' : undefined,
        ...style,
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <FallbackGlyph type={kind} size={size} />
      )}
    </span>
  );

  if (!onClick) return body;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || 'Alterar ícone'}
      className="account-icon-btn tap-target"
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        display: 'inline-flex',
        borderRadius: radius,
        lineHeight: 0,
      }}
    >
      {body}
    </button>
  );
}

export function AccountLabel({ account, size = 16, name, style }) {
  if (!account && !name) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, ...style }}>
      <AccountIcon account={account} size={size} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name || account?.name}
      </span>
    </span>
  );
}

export function accountById(accounts, id) {
  if (!id || !accounts?.length) return null;
  return accounts.find((acc) => acc.id === id) || null;
}
