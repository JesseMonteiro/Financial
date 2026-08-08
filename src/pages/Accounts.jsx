import React, { useEffect, useState } from 'react';
import { Wallet, CreditCard, Building2, Plus, Edit2, Check, X, Clock } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useAccountStore } from '../stores/accountStore';
import { formatCurrency, getDataSyncMeta } from '../utils/formatters';
import { Link } from 'react-router-dom';

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

export function Accounts() {
  const { accounts, loadAccounts, renameAccount } = useAccountStore();
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState('');

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
          <Link to="/connect" style={{ textDecoration: 'none' }}>
            <Button icon={Plus}>Adicionar Conta</Button>
          </Link>
        </div>
      </div>

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
