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
  const [srcIndex, setSrcIndex] = React.useState(0);
  const candidateKey = Array.isArray(src)
    ? src.filter(Boolean).join('\n')
    : String(src || account?.iconUrl || '');
  const candidates = React.useMemo(
    () => (candidateKey ? candidateKey.split('\n').filter(Boolean) : []),
    [candidateKey],
  );
  const url = candidates[srcIndex] || null;
  const showImg = Boolean(url);
  const kind = type || account?.type || 'BANK';
  const bg = account?.iconColor || account?.bankData?.primaryColor || 'var(--primary)';
  const radius = Math.max(6, Math.round(size * 0.22));
  const isRasterMark = Boolean(url) && !String(url).startsWith('data:');

  React.useEffect(() => {
    setSrcIndex(0);
  }, [candidateKey]);

  const body = (
    <span
      className={`account-icon ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: showImg && isRasterMark ? '#fff' : showImg ? 'var(--bg-tertiary)' : bg,
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
          referrerPolicy="no-referrer"
          onError={() => setSrcIndex((i) => (i + 1 < candidates.length ? i + 1 : candidates.length))}
          style={{
            width: isRasterMark ? '82%' : '100%',
            height: isRasterMark ? '82%' : '100%',
            objectFit: 'contain',
            display: 'block',
          }}
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
