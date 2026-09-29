import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSyncStore } from '../../stores/syncStore.js';
import { cacheFreshness, freshnessRelativeLabel } from '../../utils/freshness.js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * SyncStatusBadge
 *
 * Shows the status and freshness of Open Finance bank data.
 * Adheres to policy:
 * - < 15 min: Fresh (green dot, "atualizado")
 * - < 1 hour: Aging (amber dot, "sincronizado há pouco")
 * - >= 1 hour: Stale (red dot, "dados podem estar desatualizados")
 */
export function SyncStatusBadge({ compact = false }) {
  const { globalLastSyncedAt, items, loading, loadSyncStatus } = useSyncStore();
  const [currentFreshness, setCurrentFreshness] = useState(() => cacheFreshness(globalLastSyncedAt));
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  // Update freshness every 30 seconds so labels change from "agora mesmo" -> "há 1 min"
  useEffect(() => {
    setCurrentFreshness(cacheFreshness(globalLastSyncedAt));
    const interval = setInterval(() => {
      setCurrentFreshness(cacheFreshness(globalLastSyncedAt));
    }, 30000);
    return () => clearInterval(interval);
  }, [globalLastSyncedAt]);

  const dotColor = currentFreshness.dotColor;
  const relTime = freshnessRelativeLabel(globalLastSyncedAt);

  const formattedAbsTime = globalLastSyncedAt
    ? format(new Date(globalLastSyncedAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
    : 'Nunca sincronizado';

  if (compact) {
    return (
      <div
        className="sync-status-compact"
        title={`Status Open Finance: ${currentFreshness.label} (${relTime})`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.05)',
        }}
        onClick={() => loadSyncStatus({ force: true })}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dotColor,
            boxShadow: `0 0 8px ${dotColor}`,
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 500 }}>
          {relTime}
        </span>
      </div>
    );
  }

  return (
    <div
      className="sync-status-badge-container"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setIsTooltipOpen(true)}
      onMouseLeave={() => setIsTooltipOpen(false)}
    >
      <div
        className="sync-status-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '4px 10px',
          borderRadius: 'var(--radius-full, 9999px)',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(8px)',
          fontSize: 'var(--font-size-xs, 0.75rem)',
          color: 'var(--text-secondary, #cbd5e1)',
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease',
        }}
        onClick={() => loadSyncStatus({ force: true })}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 500 }}>
          {loading ? 'Verificando…' : relTime}
        </span>
        {currentFreshness.level === 'stale' && (
          <AlertTriangle size={12} style={{ color: 'var(--danger, #ef4444)' }} />
        )}
      </div>

      {/* Hover Tooltip / Popover */}
      {isTooltipOpen && (
        <div
          className="sync-status-tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 100,
            width: 260,
            padding: '12px 14px',
            background: 'var(--bg-surface, rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 6 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
              Sincronização Pluggy
            </span>
            <span style={{ fontSize: '0.7rem', color: dotColor, fontWeight: 600 }}>
              {currentFreshness.label}
            </span>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.4 }}>
            Última atualização: <strong style={{ color: 'var(--text-primary, #fff)' }}>{formattedAbsTime}</strong>
          </div>

          {items && items.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted, #94a3b8)' }}>
                Conexões ({items.length})
              </span>
              {items.map((it) => (
                <div key={it.pluggyItemId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-primary, #f8fafc)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 140 }}>
                    {it.connectorName || 'Banco'}
                  </span>
                  <span style={{ color: it.freshness?.dotColor || 'var(--text-muted)', fontSize: '0.7rem' }}>
                    {freshnessRelativeLabel(it.lastSyncedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.65rem', color: 'var(--text-muted, #94a3b8)' }}>
            Política: cache de 1h · auto-sync via webhooks
          </div>
        </div>
      )}
    </div>
  );
}
