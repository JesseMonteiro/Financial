import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  DollarSign, 
  CheckCircle2, 
  Users, 
  CalendarClock, 
  User, 
  Edit2 
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { IconBusyButton } from '../components/ui/Spinner';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { ReceivableModal } from '../components/modals';
import { useReceivableStore } from '../stores/receivableStore';
import { useAccountStore } from '../stores/accountStore';
import { fetchTransactions } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { isInitialEmpty } from '../utils/loading';
import { ItemDetailSheet } from '../components/ItemDetailSheet';
import { fromReceivable } from '../utils/lineItemDetail';
import {
  getInitials,
  dueKey,
  nextPendingDue,
  receivableProgress,
  personReceivableTotals,
  summarizeReceivables,
  groupReceivablesByPerson,
} from '../utils/receivables';

// ─────────────────────────────────────────────────────────────────────────────
// PERSON CARD
// ─────────────────────────────────────────────────────────────────────────────

function PersonCard({ personName, personColor, receivables, onMarkPaid, onDelete, onEdit, onAddForPerson, onOpenItem, pending = {} }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedReceivableId, setExpandedReceivableId] = useState(null);

  const { pending: totalDue, paid: totalPaid, pct } = personReceivableTotals(receivables);

  return (
    <div style={{
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--border-color)',
      backgroundColor: 'var(--bg-secondary)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
      transition: 'box-shadow 0.2s ease',
    }}>
      {/* Person header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '1.25rem 1.5rem', cursor: 'pointer',
          background: expanded ? `linear-gradient(135deg, ${personColor}15 0%, transparent 100%)` : 'transparent',
          transition: 'background 0.2s ease',
          borderBottom: expanded ? '1px solid var(--border-color)' : 'none',
          flexWrap: 'wrap'
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          backgroundColor: personColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-base)',
          flexShrink: 0, boxShadow: `0 4px 12px ${personColor}50`,
          letterSpacing: '0.05em',
        }}>
          {getInitials(personName)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 150 }}>
          <h3 style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', margin: 0 }}>
            {personName}
          </h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
            {formatCurrency(totalPaid)} recebido até hoje
          </p>
        </div>

        {/* Progress */}
        <div style={{ width: '100%', maxWidth: 150, flex: '1 1 9rem', marginRight: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pct}% recebido</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: pct === 100 ? 'var(--success)' : 'var(--primary)' }}>
              {formatCurrency(totalDue)} a receber
            </span>
          </div>
          <ProgressBar percent={pct} color={pct === 100 ? 'var(--success)' : personColor} height={6} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            icon={Plus}
            onClick={() => onAddForPerson(personName)}
          >
            Lançamento
          </Button>
        </div>

        <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem' }}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </div>

      {/* Receivables list */}
      {expanded && (
        <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {receivables.map(rec => {
            const isExpanded = expandedReceivableId === rec.id;
            const { paidCount, totalCount, paidAmount, totalAmount: recTotalAmt, pct: recPct } = receivableProgress(rec);
            const nextDue = nextPendingDue(rec.installmentHistory);

            return (
              <div key={rec.id} style={{
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${recPct === 100 ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`,
                backgroundColor: 'var(--bg-tertiary)',
                overflow: 'hidden',
              }}>
                {/* Receivable header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                }}
                  onClick={() => onOpenItem?.(rec)}
                >
                  <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                        {rec.description}
                      </span>
                      {recPct === 100 && !rec.isContinuous && <Badge variant="success">Quitado</Badge>}
                      {rec.isContinuous && <Badge variant="info">Mensal Recorrente</Badge>}
                      {rec.linkedTransactionId && <Badge variant="info">Vinculado ao Cartão</Badge>}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {rec.isContinuous ? `${formatCurrency(rec.installmentHistory[0]?.amount)}/mês` : `${formatCurrency(rec.totalAmount)} total`}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {rec.isContinuous ? `${paidCount} parcelas recebidas` : `${paidCount}/${totalCount} parcelas pagas`}
                      </span>
                      {nextDue && (
                        <span style={{ fontSize: '11px', color: 'var(--warning)' }}>
                          Próx: {formatDate(nextDue)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flex: '1 1 auto',
                      justifyContent: 'flex-end',
                      flexWrap: 'wrap',
                      minWidth: 0,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginRight: '0.5rem' }}>
                      {rec.isContinuous ? `${formatCurrency(rec.installmentHistory[0]?.amount)} /mês` : `${formatCurrency(paidAmount)} / ${formatCurrency(rec.totalAmount)}`}
                    </span>
                    <button
                      onClick={() => onEdit(rec)}
                      title="Editar lançamento"
                      className="tap-target"
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Edit2 size={14} />
                    </button>
                    <IconBusyButton
                      onClick={() => onDelete(rec.id)}
                      busy={Boolean(pending[rec.id])}
                      title="Remover lançamento"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={14} />
                    </IconBusyButton>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.25rem', cursor: 'pointer' }} onClick={() => setExpandedReceivableId(isExpanded ? null : rec.id)}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ padding: '0 1rem 0.75rem' }}>
                  <ProgressBar percent={recPct} color={recPct === 100 && !rec.isContinuous ? 'var(--success)' : personColor} height={5} />
                </div>

                {/* Installments list */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border-color)' }}>
                    {[...rec.installmentHistory]
                      .sort((a, b) => dueKey(a).localeCompare(dueKey(b)))
                      .map(inst => (
                      <div key={inst.installmentNumber} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: inst.paidAt ? 'rgba(34,197,94,0.05)' : 'transparent',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                      }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 8rem', minWidth: 0, flexWrap: 'wrap', cursor: 'pointer' }}
                          onClick={() => onOpenItem?.(rec, inst)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') onOpenItem?.(rec, inst);
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            Parcela {inst.installmentNumber}/{totalCount}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            Vence {formatDate(inst.dueDate)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            flex: '1 1 auto',
                            justifyContent: 'flex-end',
                            flexWrap: 'wrap',
                            minWidth: 0,
                          }}
                        >
                          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatCurrency(inst.amount)}
                          </span>
                          <div onClick={e => e.stopPropagation()}>
                            {inst.paidAt ? (
                              <Badge variant="success">Recebido</Badge>
                            ) : (
                              <Button
                                size="xs"
                                variant="secondary"
                                loading={Boolean(pending[`${rec.id}:${inst.installmentNumber}`])}
                                onClick={() => onMarkPaid(rec.id, inst.installmentNumber)}
                              >
                                Marcar Recebido
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function Receivables() {
  const { receivables, loadReceivables, addReceivable, updateReceivable, deleteReceivable, markInstallmentPaid, pending, loading, lastUpdated } = useReceivableStore();
  const { accounts, loadAccounts } = useAccountStore();

  const [showModal, setShowModal] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState(null);
  const [prefilledPersonName, setPrefilledPersonName] = useState('');
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  // Load basic data
  useEffect(() => {
    loadReceivables();
    loadAccounts();
  }, [loadReceivables, loadAccounts]);

  const creditCardAccounts = useMemo(() => accounts.filter(a => a.type === 'CREDIT'), [accounts]);

  // Load all credit card transactions for linking
  useEffect(() => {
    async function loadAllCardTxs() {
      if (creditCardAccounts.length === 0) return;
      try {
        const aggregated = [];
        for (const card of creditCardAccounts) {
          const res = await fetchTransactions({ accountId: card.id });
          const txs = res.results || res || [];
          // Skip payment transactions
          const purchases = txs.filter(t => 
            !(t.description || '').toUpperCase().includes('PAGAMENTO DE FATURA') &&
            !(t.description || '').toUpperCase().includes('PAGAMENTO RECEBIDO')
          );
          aggregated.push(...purchases);
        }
        setCreditTransactions(aggregated);
      } catch (err) {
        console.warn('[Receivables] error fetching transactions for linking:', err);
      }
    }
    if (accounts.length > 0) loadAllCardTxs();
  }, [creditCardAccounts, accounts.length]);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const { totalToReceive, totalReceived, numPeople, nextDueDate } = useMemo(
    () => summarizeReceivables(receivables),
    [receivables]
  );

  // Group by Person Name
  const byPerson = useMemo(() => groupReceivablesByPerson(receivables), [receivables]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (data) => {
    if (editingReceivable) {
      await updateReceivable(editingReceivable.id, data);
      setEditingReceivable(null);
    } else {
      await addReceivable(data);
    }
    setPrefilledPersonName('');
  }, [addReceivable, updateReceivable, editingReceivable]);

  const handleMarkPaid = useCallback((receivableId, installmentNumber) => {
    markInstallmentPaid(receivableId, installmentNumber, new Date().toISOString());
  }, [markInstallmentPaid]);

  const handleDelete = useCallback(async (id) => {
    if (window.confirm('Remover este lançamento?')) {
      await deleteReceivable(id);
    }
  }, [deleteReceivable]);

  const handleEditClick = useCallback((rec) => {
    setEditingReceivable(rec);
    setPrefilledPersonName('');
    setShowModal(true);
  }, []);

  const handleAddForPersonClick = useCallback((name) => {
    setPrefilledPersonName(name);
    setEditingReceivable(null);
    setShowModal(true);
  }, []);

  const handleNewEntryClick = () => {
    setEditingReceivable(null);
    setPrefilledPersonName('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingReceivable(null);
    setPrefilledPersonName('');
  };

  if (isInitialEmpty(receivables, loading, lastUpdated)) {
    return (
      <PageLoadingSkeleton
        kpiCount={3}
        showTimeline={false}
        showChart={false}
        showList
        label="Carregando valores a receber…"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Valores a Receber</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            Controle compras do cartão emprestadas a terceiros e valores avulsos
          </p>
        </div>
        <div className="page-header__actions">
          <Button variant="primary" icon={Plus} onClick={handleNewEntryClick}>
            Nova Entrada
          </Button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="dashboard-grid">
        <Card className="col-3" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              TOTAL A RECEBER
            </span>
            <DollarSign size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--primary)' }}>
            {formatCurrency(totalToReceive)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Pendente de recebimento
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              TOTAL RECEBIDO
            </span>
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--success)' }}>
            {formatCurrency(totalReceived)}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Já recebido até hoje
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: '4px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              Nº DE PESSOAS
            </span>
            <Users size={18} style={{ color: 'var(--info)' }} />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: '0.4rem 0', color: 'var(--info)' }}>
            {numPeople}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {numPeople === 1 ? 'pessoa com débito' : 'pessoas com débito'}
          </span>
        </Card>

        <Card className="col-3" style={{ borderLeft: `4px solid ${nextDueDate ? 'var(--warning)' : 'var(--border-color)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
              PRÓXIMO RECEBIMENTO
            </span>
            <CalendarClock size={18} style={{ color: nextDueDate ? 'var(--warning)' : 'var(--text-muted)' }} />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: '0.4rem 0', color: nextDueDate ? 'var(--warning)' : 'var(--text-muted)' }}>
            {nextDueDate ? formatDate(nextDueDate) : '—'}
          </h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {nextDueDate ? 'Próxima parcela pendente' : 'Sem parcelas pendentes'}
          </span>
        </Card>
      </div>

      {/* People list */}
      {byPerson.length === 0 ? (
        <Card>
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={32} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
              Nenhum lançamento ainda
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              Clique em <strong>Nova Entrada</strong> para registrar uma compra emprestada a terceiros.
            </p>
            <Button variant="primary" icon={Plus} onClick={handleNewEntryClick}>
              Nova Entrada
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {byPerson.map(group => (
            <PersonCard
              key={group.personName}
              personName={group.personName}
              personColor={group.personColor}
              receivables={group.receivables}
              onMarkPaid={handleMarkPaid}
              onDelete={handleDelete}
              onEdit={handleEditClick}
              onAddForPerson={handleAddForPersonClick}
              onOpenItem={(rec, inst) => setSelectedItem(fromReceivable(rec, inst))}
              pending={pending}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ReceivableModal
          onClose={handleCloseModal}
          onSave={handleSave}
          creditTransactions={creditTransactions}
          editingReceivable={editingReceivable}
          prefilledPersonName={prefilledPersonName}
        />
      )}
      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          busy={sheetBusy}
          onClose={() => setSelectedItem(null)}
          onTogglePaid={async () => {
            if (!selectedItem.installmentNumber) return;
            setSheetBusy(true);
            try {
              await markInstallmentPaid(selectedItem.sourceId, selectedItem.installmentNumber, new Date().toISOString());
            } finally {
              setSheetBusy(false);
              setSelectedItem(null);
            }
          }}
          onEdit={() => {
            const rec = receivables.find((r) => r.id === selectedItem.sourceId);
            if (rec) handleEditClick(rec);
            setSelectedItem(null);
          }}
          onDelete={async () => {
            setSheetBusy(true);
            try {
              await deleteReceivable(selectedItem.sourceId);
            } finally {
              setSheetBusy(false);
              setSelectedItem(null);
            }
          }}
        />
      )}
    </div>
  );
}
export default Receivables;
