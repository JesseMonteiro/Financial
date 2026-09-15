import React from 'react';
import { Sun, Moon, RefreshCw, Search, Menu } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAccountStore } from '../../stores/accountStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useInvestmentStore } from '../../stores/investmentStore';
import { useCreditDataStore } from '../../stores/creditDataStore';
import { clearApiCache } from '../../services/api';
import { GlassSurface } from '../ui/GlassSurface';
import { format } from 'date-fns';

export function Header({ onOpenMore, isMobile = false }) {
  const { theme, setTheme } = useSettingsStore();
  const { loadAccounts, lastUpdated, loading: accLoading } = useAccountStore();
  const { loadTransactions, loading: txLoading } = useTransactionStore();
  const { loadInvestments, loading: invLoading } = useInvestmentStore();
  const clearCreditData = useCreditDataStore((s) => s.clear);

  const isRefreshing = accLoading || txLoading || invLoading;

  const handleRefresh = async () => {
    clearApiCache();
    const accountIds = useAccountStore.getState().accounts.map((a) => a.id);
    await Promise.all([
      loadAccounts({ force: true }),
      loadTransactions({ force: true }),
      loadInvestments({ force: true }),
    ]);
    const ids =
      accountIds.length > 0
        ? accountIds
        : useAccountStore.getState().accounts.map((a) => a.id);
    if (ids.length) {
      await useCreditDataStore.getState().loadForAccounts(ids, { force: true });
    } else {
      clearCreditData();
    }
  };

  return (
    <GlassSurface as="header" className="header">
      {isMobile && (
        <button
          type="button"
          className="tap-target header-menu-btn"
          onClick={onOpenMore}
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>
      )}

      {!isMobile && (
        <div className="header-search">
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input type="text" placeholder="Buscar transações, contas..." />
        </div>
      )}

      {isMobile && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>MeuFlux</strong>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.75rem' }}>
        {!isMobile && lastUpdated && (
          <span className="hide-mobile header-sync-label">
            Atualizado às {format(lastUpdated, 'HH:mm')}
          </span>
        )}

        <div className="header-cluster">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="header-cluster__btn"
            title="Forçar sincronização (ignora cache de 1h)"
            aria-label={isRefreshing ? 'Atualizando' : 'Sincronizar'}
            style={isMobile ? undefined : { width: 'auto', padding: '0 0.75rem', gap: 6 }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin-slow' : ''} />
            {!isMobile && (
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                {isRefreshing ? 'Atualizando...' : 'Sincronizar'}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="header-cluster__btn"
            title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={18} style={{ color: '#f59e0b' }} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </GlassSurface>
  );
}
