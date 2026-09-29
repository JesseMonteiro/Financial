import { useEffect } from 'react';
import { useSyncStore } from '../stores/syncStore.js';
import { useTransactionStore } from '../stores/transactionStore.js';
import { useAccountStore } from '../stores/accountStore.js';
import { cacheFreshness } from '../utils/freshness.js';

/**
 * useAutoSync
 * Automatically checks synchronization freshness on app load and tab focus (visibilitychange).
 * If the cache is stale (older than 1h), triggers a background refresh.
 */
export function useAutoSync() {
  const loadSyncStatus = useSyncStore((s) => s.loadSyncStatus);
  const globalLastSyncedAt = useSyncStore((s) => s.globalLastSyncedAt);
  const loadTransactions = useTransactionStore((s) => s.loadTransactions);
  const loadAccounts = useAccountStore((s) => s.loadAccounts);

  useEffect(() => {
    // Initial status check
    loadSyncStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      // Always re-check sync status when tab becomes visible
      loadSyncStatus();

      // Check if cache has expired (>= 1 hour)
      if (globalLastSyncedAt) {
        const freshness = cacheFreshness(globalLastSyncedAt);
        if (freshness.level === 'stale') {
          console.log('[AutoSync] Dados Open Finance desatualizados (> 1h). Atualizando em background...');
          loadTransactions({ force: true });
          loadAccounts({ force: true });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [globalLastSyncedAt, loadSyncStatus, loadTransactions, loadAccounts]);
}
