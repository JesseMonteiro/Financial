import React, { useEffect, useState } from 'react';
import { Wallet, CreditCard, Building2, Plus, Edit2, Check, X, Clock, RefreshCw } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAccountStore } from '../stores/accountStore';
import { formatCurrency, getDataSyncMeta } from '../utils/formatters';
import { Link } from 'react-router-dom';
import {
  clearApiCache,
  createConnectToken,
  syncPluggyConnections,
  waitForItemUpdate,
} from '../services/api';

function SyncUpdatedBadge({ updatedAt }) {
  const sync = getDataSyncMeta(updatedAt);
  if (!sync) return null;
  return (
    <Badge variant={sync.variant} title={sync.title} style={{ whiteSpace: 'nowrap' }}>
      <Clock size={10} aria-hidden />
      {sync.label}
    </Badge>
  );
}

/** Open Pluggy Connect in update mode (MFA / invalid credentials). */
function openPluggyItemUpdate(itemId) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await createConnectToken(itemId);
      if (!data?.accessToken) {
        reject(new Error('Token de conexão Pluggy inválido.'));
        return;
      }
      if (!window.PluggyConnect) {
        reject(new Error('O SDK do Pluggy Connect não foi carregado. Recarregue a página.'));
        return;
      }

      const pluggyConnect = new window.PluggyConnect({
        connectToken: data.accessToken,
        updateItem: itemId,
        onSuccess: async () => {
          try {
            const item = await waitForItemUpdate(itemId);
            resolve(item);
          } catch (err) {
            resolve(null);
          }
        },
        onError: (error) => {
          reject(error instanceof Error ? error : new Error(error?.message || 'Falha no Pluggy Connect'));
        },
        onClose: () => {
          resolve(null);
        },
      });
      pluggyConnect.init();
    } catch (err) {
      reject(err);
    }
  });
}

export function Accounts() {
  const { accounts, loadAccounts, renameAccount, loading } = useAccountStore();
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const bankAccounts = accounts.filter(a => a.type === 'BANK');
  const creditCards = accounts.filter(a => a.type === 'CREDIT');

  const startEditing = (acc) => {
    setEditingId(acc.id);
    setTempName(acc.name || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTempName('');
  };

  const saveName = async (id) => {
    await renameAccount(id, tempName);
    setEditingId(null);
    setTempName('');
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      saveName(id);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg({ type: 'info', text: 'Solicitando sincronização nos bancos via Pluggy…' });

    try {
      const outcome = await syncPluggyConnections();

      if (!outcome.results?.length) {
        setSyncMsg({ type: 'error', text: outcome.message || 'Nenhuma conexão para sincronizar.' });
        return;
      }

      const needingAction = outcome.results.filter((r) => r.needsUserAction);
      for (const row of needingAction) {
        setSyncMsg({
          type: 'info',
          text: `Autenticação necessária${row.connectorName ? ` (${row.connectorName})` : ''}. Abrindo Pluggy Connect…`,
        });
        try {
          await openPluggyItemUpdate(row.itemId);
        } catch (err) {
          console.warn('[Accounts] Pluggy Connect update failed:', err);
        }
      }

      clearApiCache();
      await loadAccounts({ force: true });

      const failed = outcome.results.filter((r) => !r.ok && !r.needsUserAction);
      const rateLimited = failed.find((r) => String(r.code || '').includes('BEFORE_ALLOWED_FREQUENCY'));

      if (rateLimited) {
        setSyncMsg({
          type: 'error',
          text: rateLimited.error || 'Pluggy limita atualizações manuais por API. Tente novamente mais tarde ou use o widget.',
        });
      } else if (failed.length > 0 && outcome.okCount === 0 && needingAction.length === 0) {
        setSyncMsg({
          type: 'error',
          text: failed[0]?.error || outcome.message || 'Falha ao sincronizar.',
        });
      } else {
        setSyncMsg({
          type: 'success',
          text: outcome.message || 'Sincronização concluída. Saldos atualizados.',
        });
      }
    } catch (err) {
      setSyncMsg({
        type: 'error',
        text: err.message || 'Falha ao sincronizar com os bancos.',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Contas & Saldos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Gerencie todas as suas contas bancárias e cartões conectados via Pluggy.ai.
          </p>
        </div>
        <div className="page-header__actions">
          <Button
            variant="outline"
            icon={RefreshCw}
            disabled={syncing || loading}
            onClick={handleSync}
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </Button>
          <Link to="/connect" style={{ textDecoration: 'none' }}>
            <Button icon={Plus}>Adicionar Conta</Button>
          </Link>
        </div>
      </div>

      {syncMsg && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor:
              syncMsg.type === 'success'
                ? 'var(--success-bg)'
                : syncMsg.type === 'error'
                  ? 'var(--danger-bg)'
                  : 'var(--bg-tertiary)',
            color:
              syncMsg.type === 'success'
                ? 'var(--success)'
                : syncMsg.type === 'error'
                  ? 'var(--danger)'
                  : 'var(--text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
          }}
        >
          {syncMsg.text}
        </div>
      )}

      {/* Contas Bancárias */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Wallet size={20} style={{ color: 'var(--primary)' }} /> Contas Bancárias ({bankAccounts.length})
        </h2>
        <div className="dashboard-grid">
          {bankAccounts.map(acc => {
            const isEditing = editingId === acc.id;
            return (
              <Card key={acc.id} className="col-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: acc.bankData?.primaryColor || 'var(--primary)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      <Building2 size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, acc.id)}
                            className="input"
                            autoFocus
                            style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-sm)', width: '100%', minWidth: '100px' }}
                          />
                          <button onClick={() => saveName(acc.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--success)', padding: '0.15rem' }}>
                            <Check size={16} />
                          </button>
                          <button onClick={cancelEditing} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.15rem' }}>
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{acc.name}</h3>
                          <button onClick={() => startEditing(acc)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 0 }} title="Editar nome">
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {acc.bankData?.institutionName || 'Banco'} • Ag. {acc.number || '0001'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                    <Badge variant="success">Ativa</Badge>
                    <SyncUpdatedBadge updatedAt={acc.updatedAt} />
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Saldo Atual</span>
                  <h4 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatCurrency(acc.balance)}
                  </h4>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cartões de Crédito */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={20} style={{ color: 'var(--danger)' }} /> Cartões de Crédito ({creditCards.length})
        </h2>
        <div className="dashboard-grid">
          {creditCards.map(acc => {
            const isEditing = editingId === acc.id;
            return (
              <Card key={acc.id} className="col-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: '0.5rem' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, acc.id)}
                          className="input"
                          autoFocus
                          style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--font-size-sm)', width: '100%', minWidth: '100px' }}
                        />
                        <button onClick={() => saveName(acc.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--success)', padding: '0.15rem' }}>
                          <Check size={16} />
                        </button>
                        <button onClick={cancelEditing} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.15rem' }}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{acc.name}</h3>
                        <button onClick={() => startEditing(acc)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', padding: 0 }} title="Editar nome">
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {acc.creditData?.institutionName || 'Cartão'} • Final {acc.number || '4410'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                    <Badge variant="neutral">Fatura Aberta</Badge>
                    <SyncUpdatedBadge updatedAt={acc.updatedAt} />
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Fatura Atual</span>
                  <h4 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--danger)' }}>
                    {formatCurrency(Math.abs(acc.balance))}
                  </h4>
                </div>
                {acc.creditData && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    <span>Limite Disponível: {formatCurrency(acc.creditData.availableCreditLimit)}</span>
                    <span>Total: {formatCurrency(acc.creditData.creditLimit)}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
