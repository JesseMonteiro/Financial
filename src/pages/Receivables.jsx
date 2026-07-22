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
  Search, 
  User, 
  Clock, 
  Tag, 
  Edit2 
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useReceivableStore } from '../stores/receivableStore';
import { useAccountStore } from '../stores/accountStore';
import { fetchTransactions } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase())
    .join('');
}

function nextPendingDue(installmentHistory = []) {
  const pending = installmentHistory
    .filter(i => !i.paidAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return pending[0]?.dueDate || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL (Combined Add & Edit)
// ─────────────────────────────────────────────────────────────────────────────

function ReceivableModal({ onClose, onSave, creditTransactions, editingReceivable, prefilledPersonName }) {
  const [personName, setPersonName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('avulso'); // 'cartao' | 'avulso'
  const [txSearch, setTxSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [totalAmount, setTotalAmount] = useState('');
  
  // Recurrence type: 'single' | 'parcelado' | 'continuous'
  const [recurrenceType, setRecurrenceType] = useState('single');
  const [numParcelas, setNumParcelas] = useState(2);
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [txDropdownOpen, setTxDropdownOpen] = useState(false);

  // Load editing data if editing
  useEffect(() => {
    if (editingReceivable) {
      setPersonName(editingReceivable.personName || '');
      setDescription(editingReceivable.description || '');
      
      const amt = editingReceivable.originalTotalAmount !== undefined 
        ? editingReceivable.originalTotalAmount 
        : editingReceivable.totalAmount;
      setTotalAmount(String(amt || ''));
      setNotes(editingReceivable.notes || '');
      
      if (editingReceivable.installmentHistory?.[0]?.dueDate) {
        setFirstDueDate(editingReceivable.installmentHistory[0].dueDate);
      }
      
      if (editingReceivable.isContinuous) {
        setRecurrenceType('continuous');
      } else if (editingReceivable.installments > 1) {
        setRecurrenceType('parcelado');
        setNumParcelas(editingReceivable.installments);
      } else {
        setRecurrenceType('single');
      }

      if (editingReceivable.linkedTransactionId) {
        setType('cartao');
        const matched = creditTransactions.find(t => t.id === editingReceivable.linkedTransactionId);
        if (matched) {
          setSelectedTx(matched);
          setTxSearch(matched.description || '');
        }
      } else {
        setType('avulso');
      }
    } else if (prefilledPersonName) {
      setPersonName(prefilledPersonName);
    }
  }, [editingReceivable, prefilledPersonName, creditTransactions]);

  const filteredTxs = useMemo(() => {
    if (!txSearch) return creditTransactions.slice(0, 20);
    const q = txSearch.toLowerCase();
    return creditTransactions
      .filter(t =>
        t.description?.toLowerCase().includes(q) ||
        t.merchant?.businessName?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [creditTransactions, txSearch]);

  const handleSelectTx = (tx) => {
    setSelectedTx(tx);
    setTotalAmount(String(Math.abs(tx.amount)));
    setTxDropdownOpen(false);
    setTxSearch(tx.description || '');
  };

  const handleSave = () => {
    if (!personName.trim() || !totalAmount || isNaN(parseFloat(totalAmount))) return;
    onSave({
      personName: personName.trim(),
      description: description.trim(),
      totalAmount: parseFloat(totalAmount),
      isContinuous: recurrenceType === 'continuous',
      installments: recurrenceType === 'parcelado' ? parseInt(numParcelas, 10) || 1 : 1,
      firstDueDate,
      linkedTransactionId: selectedTx?.id || null,
      linkedBillForecastDate: selectedTx?.creditCardMetadata?.billForecastDate || null,
      notes: notes.trim(),
    });
    onClose();
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '0.35rem',
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)',
        width: '100%', maxWidth: 540,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>
            {editingReceivable ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Nome da pessoa */}
          <div>
            <label style={labelStyle}>Nome do Devedor / Amigo *</label>
            <input
              type="text"
              value={personName}
              onChange={e => setPersonName(e.target.value)}
              placeholder="Ex: João Silva"
              disabled={!!prefilledPersonName || !!editingReceivable}
              style={{ ...inputStyle, opacity: (prefilledPersonName || editingReceivable) ? 0.6 : 1 }}
            />
          </div>

          {/* Descrição */}
          <div>
            <label style={labelStyle}>Descrição / Identificador *</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Ingresso do Show, Almoço de Domingo"
              style={inputStyle}
            />
          </div>

          {/* Tipo de Lançamento */}
          <div>
            <label style={labelStyle}>Tipo de Origem</label>
            <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              {[
                { val: 'avulso', lbl: 'Valor Avulso' },
                { val: 'cartao', lbl: 'Vincular a Compra do Cartão' },
              ].map(({ val, lbl }) => (
                <label
                  key={val}
                  style={{
                    flex: 1, textAlign: 'center', padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    fontSize: 'var(--font-size-xs)', fontWeight: type === val ? 700 : 500,
                    backgroundColor: type === val ? 'var(--primary)' : 'transparent',
                    color: type === val ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    checked={type === val}
                    onChange={() => { setType(val); setSelectedTx(null); setTxSearch(''); }}
                    style={{ display: 'none' }}
                  />
                  {lbl}
                </label>
              ))}
            </div>
          </div>

          {/* Busca de transação (quando vinculado ao cartão) */}
          {type === 'cartao' && (
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Transação do Cartão</label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                ...inputStyle,
                padding: '0.5rem 0.85rem',
              }}>
                <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  value={txSearch}
                  onChange={e => { setTxSearch(e.target.value); setTxDropdownOpen(true); setSelectedTx(null); }}
                  onFocus={() => setTxDropdownOpen(true)}
                  placeholder="Buscar compra no cartão..."
                  style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: 'var(--font-size-sm)' }}
                />
              </div>
              {txDropdownOpen && filteredTxs.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', zIndex: 10,
                  maxHeight: 200, overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  marginTop: '0.25rem',
                }}>
                  {filteredTxs.map(tx => (
                    <div
                      key={tx.id}
                      onClick={() => handleSelectTx(tx)}
                      style={{
                        padding: '0.75rem 1rem', cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {tx.description}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0.1rem 0 0' }}>
                        {formatCurrency(Math.abs(tx.amount))} • {formatDate(tx.date)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Valor */}
          <div>
            <label style={labelStyle}>
              {recurrenceType === 'continuous' ? 'Valor por Mês (R$) *' : 'Valor Total (R$) *'}
            </label>
            <input
              type="number"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              placeholder="0,00"
              min="0"
              step="0.01"
              style={inputStyle}
            />
          </div>

          {/* Recurrence Type Option Selector */}
          <div>
            <label style={labelStyle}>Recorrência do Lançamento</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              {[
                { val: 'single', lbl: 'Lançamento Único' },
                { val: 'parcelado', lbl: 'Lançamento Parcelado (parcelas fixas)' },
                { val: 'continuous', lbl: 'Recorrência Contínua (mensal fixo, ex: aluguel, assinatura)' }
              ].map(({ val, lbl }) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>
                  <input
                    type="radio"
                    name="recurrence_selection"
                    checked={recurrenceType === val}
                    onChange={() => setRecurrenceType(val)}
                  />
                  {lbl}
                </label>
              ))}
            </div>

            {/* Custom configurations based on recurrence type */}
            {recurrenceType === 'parcelado' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Nº de Parcelas</label>
                  <input
                    type="number"
                    min="2"
                    max="48"
                    value={numParcelas}
                    onChange={e => setNumParcelas(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Data da 1ª Parcela</label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={e => setFirstDueDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
            
            {recurrenceType === 'continuous' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginTop: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Data do Primeiro Recebimento</label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={e => setFirstDueDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {recurrenceType === 'single' && (
              <div style={{ marginTop: '0.75rem' }}>
                <label style={labelStyle}>Data de Vencimento</label>
                <input
                  type="date"
                  value={firstDueDate}
                  onChange={e => setFirstDueDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label style={labelStyle}>Observações (Opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem',
          display: 'flex', gap: '0.75rem', justifyContent: 'flex-end',
          borderTop: '1px solid var(--border-color)',
        }}>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!personName.trim() || !totalAmount || isNaN(parseFloat(totalAmount))}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSON CARD
// ─────────────────────────────────────────────────────────────────────────────

function PersonCard({ personName, personColor, receivables, onMarkPaid, onDelete, onEdit, onAddForPerson }) {
  const [expanded, setExpanded] = useState(true);
  const [expandedReceivableId, setExpandedReceivableId] = useState(null);

  const totalDue = receivables.reduce((s, r) => {
    if (r.isContinuous) {
      // For continuous, we sum only the unpaid installments of the 24 generated ones
      return s + r.installmentHistory.filter(i => !i.paidAt).reduce((sum, i) => sum + i.amount, 0);
    }
    return s + r.totalAmount;
  }, 0);

  const totalPaid = receivables.reduce((s, r) => {
    return s + r.installmentHistory.filter(i => i.paidAt).reduce((si, i) => si + i.amount, 0);
  }, 0);

  const pct = totalDue > 0 ? Math.min(100, Math.round((totalPaid / (totalDue + totalPaid)) * 100)) : 100;

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
        <div style={{ width: 150, flexShrink: 0, marginRight: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
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
            const paid = rec.installmentHistory.filter(i => i.paidAt).length;
            const total = rec.installmentHistory.length;
            const nextDue = nextPendingDue(rec.installmentHistory);
            const recPaid = rec.installmentHistory.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
            const recTotalAmt = rec.isContinuous 
              ? (rec.installmentHistory[0]?.amount * 24) 
              : rec.totalAmount;
            const recPct = recTotalAmt > 0 ? Math.min(100, Math.round((recPaid / recTotalAmt) * 100)) : 0;

            return (
              <div key={rec.id} style={{
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${recPct === 100 ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`,
                backgroundColor: 'var(--bg-tertiary)',
                overflow: 'hidden',
              }}>
                {/* Receivable header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.85rem 1rem', cursor: 'pointer',
                }}
                  onClick={() => setExpandedReceivableId(isExpanded ? null : rec.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                        {rec.isContinuous ? `${paid} parcelas recebidas` : `${paid}/${total} parcelas pagas`}
                      </span>
                      {nextDue && (
                        <span style={{ fontSize: '11px', color: 'var(--warning)' }}>
                          Próx: {formatDate(nextDue)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginRight: '0.5rem' }}>
                      {rec.isContinuous ? `${formatCurrency(rec.installmentHistory[0]?.amount)} /mês` : `${formatCurrency(recPaid)} / ${formatCurrency(rec.totalAmount)}`}
                    </span>
                    <button
                      onClick={() => onEdit(rec)}
                      title="Editar lançamento"
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '0.25rem', display: 'flex', alignItems: 'center',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(rec.id)}
                      title="Remover lançamento"
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '0.25rem', display: 'flex', alignItems: 'center',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={14} />
                    </button>
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
                    {rec.installmentHistory.map(inst => (
                      <div key={inst.installmentNumber} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.65rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: inst.paidAt ? 'rgba(34,197,94,0.05)' : 'transparent',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', width: 80 }}>
                            Parcela {inst.installmentNumber}/{total}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                            Vence {formatDate(inst.dueDate)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
  const { receivables, loadReceivables, addReceivable, updateReceivable, deleteReceivable, markInstallmentPaid } = useReceivableStore();
  const { accounts, loadAccounts } = useAccountStore();

  const [showModal, setShowModal] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState(null);
  const [prefilledPersonName, setPrefilledPersonName] = useState('');
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [loadingTxs, setLoadingTxs] = useState(false);

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
      setLoadingTxs(true);
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
      } finally {
        setLoadingTxs(false);
      }
    }
    if (accounts.length > 0) loadAllCardTxs();
  }, [creditCardAccounts, accounts.length]);

  // ── Metrics ────────────────────────────────────────────────────────────────
  const totalToReceive = useMemo(() => {
    return receivables.reduce((s, r) => {
      const pendingSum = r.installmentHistory
        .filter(i => !i.paidAt)
        .reduce((sum, i) => sum + i.amount, 0);
      return s + pendingSum;
    }, 0);
  }, [receivables]);

  const totalReceived = useMemo(() => {
    return receivables.reduce((s, r) => {
      const paidSum = r.installmentHistory
        .filter(i => i.paidAt)
        .reduce((sum, i) => sum + i.amount, 0);
      return s + paidSum;
    }, 0);
  }, [receivables]);

  const numPeople = useMemo(() => {
    const names = new Set(receivables.map(r => r.personName.toLowerCase()));
    return names.size;
  }, [receivables]);

  const nextDueDate = useMemo(() => {
    let earliest = null;
    receivables.forEach(r => {
      const due = nextPendingDue(r.installmentHistory);
      if (due) {
        if (!earliest || due < earliest) {
          earliest = due;
        }
      }
    });
    return earliest;
  }, [receivables]);

  // Group by Person Name
  const byPerson = useMemo(() => {
    const map = {};
    receivables.forEach(r => {
      if (!map[r.personName]) {
        map[r.personName] = {
          personName: r.personName,
          personColor: r.personColor,
          receivables: [],
        };
      }
      map[r.personName].receivables.push(r);
    });
    return Object.values(map);
  }, [receivables]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (data) => {
    if (editingReceivable) {
      await updateReceivable(editingReceivable.id, data);
      setEditingReceivable(null);
    } else {
      await addReceivable(data);
    }
    setShowModal(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Valores a Receber</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            Controle compras do cartão emprestadas a terceiros e valores avulsos
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleNewEntryClick}>
          Nova Entrada
        </Button>
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
    </div>
  );
}
export default Receivables;
