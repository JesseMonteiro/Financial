import React from 'react';
import { Sun, Moon, RefreshCw, Search, Menu } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAccountStore } from '../../stores/accountStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useInvestmentStore } from '../../stores/investmentStore';
import { useCreditDataStore } from '../../stores/creditDataStore';
import { clearApiCache } from '../../services/api';
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
    <header className="header">
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: 360 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            padding: '0.4rem 0.85rem',
            width: '100%'
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar transações, contas..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                width: '100%'
              }}
            />
          </div>
        </div>
      )}

      {isMobile && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>FinanceHub</strong>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.85rem' }}>
        {!isMobile && lastUpdated && (
          <span className="hide-mobile" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Atualizado às {format(lastUpdated, 'HH:mm')}
          </span>
        )}

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn btn-secondary"
          style={{
            padding: isMobile ? 0 : '0.4rem 0.75rem',
            fontSize: 'var(--font-size-xs)',
            width: isMobile ? 40 : undefined,
            height: isMobile ? 40 : undefined,
            minWidth: isMobile ? 40 : undefined,
            borderRadius: isMobile ? '50%' : undefined,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Forçar sincronização (ignora cache de 1h)"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-slow' : ''} />
          {!isMobile && (isRefreshing ? 'Atualizando...' : 'Sincronizar')}
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn btn-outline"
          style={{ width: 36, height: 36, padding: 0, borderRadius: '50%' }}
          title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
        >
          {theme === 'dark' ? <Sun size={18} style={{ color: '#f59e0b' }} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
