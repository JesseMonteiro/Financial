import React, { useState } from 'react';
import { Sun, Moon, RefreshCw, Search } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAccountStore } from '../../stores/accountStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { useInvestmentStore } from '../../stores/investmentStore';
import { useCreditDataStore } from '../../stores/creditDataStore';
import { clearApiCache } from '../../services/api';
import { format } from 'date-fns';

export function Header() {
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
      {/* Search Input */}
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

      {/* Header Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {/* Last Sync Indicator */}
        {lastUpdated && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Atualizado às {format(lastUpdated, 'HH:mm')}
          </span>
        )}

        {/* Sync Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.75rem', fontSize: 'var(--font-size-xs)' }}
          title="Forçar sincronização (ignora cache de 1h)"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-slow' : ''} />
          {isRefreshing ? 'Atualizando...' : 'Sincronizar'}
        </button>

        {/* Theme Toggle */}
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
