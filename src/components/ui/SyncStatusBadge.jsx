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
  const { globalLastSyncedAt, items, loading, refreshing, loadSyncStatus, refreshSync } = useSyncStore();
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
        onClick={() => loadSyncStatus({ force: true })}
      >
        <span
          className="sync-status-badge__dot"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}` }}
        />
        <span>{relTime}</span>
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
        onClick={() => loadSyncStatus({ force: true })}
      >
        <span
          className="sync-status-badge__dot"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
        />
        <span>
          {refreshing ? 'Sincronizando…' : loading ? 'Verificando…' : relTime}
        </span>
        {currentFreshness.level === 'stale' && (
          <AlertTriangle size={12} style={{ color: 'var(--danger)' }} />
        )}
      </div>

      {isTooltipOpen && (
        <div className="sync-status-popover liquid-glass liquid-glass--regular" role="dialog" aria-label="Sincronização Pluggy">
          <div className="sync-status-popover__head">
            <span className="sync-status-popover__title">Sincronização Pluggy</span>
            <div className="sync-status-popover__actions">
              <span className="sync-status-popover__level" style={{ color: dotColor }}>
                {currentFreshness.label}
              </span>
              <button
                type="button"
                className="sync-status-popover__sync"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await refreshSync();
                  } catch (err) {
                    console.error('[SyncStatusBadge] Erro ao sincronizar:', err);
                  }
                }}
                disabled={loading || refreshing}
              >
                {refreshing ? 'Sincronizando…' : 'Sincronizar'}
              </button>
            </div>
          </div>

          <div className="sync-status-popover__meta">
            Última atualização: <strong>{formattedAbsTime}</strong>
          </div>

          {items && items.length > 0 && (
            <div className="sync-status-popover__list">
              <span className="sync-status-popover__kicker">
                Conexões ({items.length})
              </span>
              {items.map((it) => (
                <div key={it.pluggyItemId} className="sync-status-popover__row">
                  <span className="sync-status-popover__name">
                    {it.connectorName || 'Banco'}
                  </span>
                  <span
                    className="sync-status-popover__time"
                    style={{ color: it.freshness?.dotColor || 'var(--text-muted)' }}
                  >
                    {freshnessRelativeLabel(it.lastSyncedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="sync-status-popover__policy">
            Política: cache de 1h · auto-sync via webhooks
          </div>
        </div>
      )}
    </div>
  );
}
