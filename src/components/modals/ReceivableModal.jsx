import React, { useEffect, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../ui/Button';
import { SavingOverlay } from '../ui/Spinner';
import { formatCurrency, formatDate } from '../../utils/formatters';

export function ReceivableModal({
  onClose,
  onSave,
  creditTransactions = [],
  editingReceivable,
  prefilledPersonName,
  prefilledTransaction,
}) {
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
  const [saving, setSaving] = useState(false);

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
        const matched = creditTransactions.find((t) => t.id === editingReceivable.linkedTransactionId);
        if (matched) {
          setSelectedTx(matched);
          setTxSearch(matched.description || '');
        }
      } else {
        setType('avulso');
      }
    } else if (prefilledTransaction) {
      setType('cartao');
      setSelectedTx(prefilledTransaction);
      setTxSearch(prefilledTransaction.description || '');
      setDescription(prefilledTransaction.description || '');
      const amt = Math.abs(Number(prefilledTransaction.amountInAccountCurrency ?? prefilledTransaction.amount) || 0);
      if (amt) setTotalAmount(String(amt));
    } else if (prefilledPersonName) {
      setPersonName(prefilledPersonName);
    }
  }, [editingReceivable, prefilledPersonName, prefilledTransaction, creditTransactions]);

  const filteredTxs = useMemo(() => {
    if (!txSearch) return creditTransactions.slice(0, 20);
    const q = txSearch.toLowerCase();
    return creditTransactions
      .filter((t) =>
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

  const handleSave = async () => {
    if (!personName.trim() || !totalAmount || isNaN(parseFloat(totalAmount)) || saving) return;
    setSaving(true);
    try {
      await onSave({
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
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
    <div
      className="modal-overlay"
      style={{
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 540,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>
            {editingReceivable ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: saving ? 'wait' : 'pointer',
              fontSize: '18px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Nome da pessoa */}
          <div>
            <label style={labelStyle}>Nome do Devedor / Amigo *</label>
            <input
              type="text"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Ex: João Silva"
              disabled={Boolean(prefilledPersonName || editingReceivable)}
              style={{ ...inputStyle, opacity: (prefilledPersonName || editingReceivable) ? 0.6 : 1 }}
            />
          </div>

          {/* Descrição */}
          <div>
            <label style={labelStyle}>Descrição / Identificador *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Ingresso do Show, Almoço de Domingo"
              style={inputStyle}
            />
          </div>

          {/* Tipo de Lançamento */}
          <div>
            <label style={labelStyle}>Tipo de Origem</label>
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-tertiary)',
                padding: '0.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              {[
                { val: 'avulso', lbl: 'Valor Avulso' },
                { val: 'cartao', lbl: 'Vincular a Compra do Cartão' },
              ].map(({ val, lbl }) => (
                <label
                  key={val}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    padding: '0.45rem',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: type === val ? 700 : 500,
                    backgroundColor: type === val ? 'var(--primary)' : 'transparent',
                    color: type === val ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="radio"
                    checked={type === val}
                    onChange={() => {
                      setType(val);
                      setSelectedTx(null);
                      setTxSearch('');
                    }}
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  ...inputStyle,
                  padding: '0.5rem 0.85rem',
                }}
              >
                <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => {
                    setTxSearch(e.target.value);
                    setTxDropdownOpen(true);
                    setSelectedTx(null);
                  }}
                  onFocus={() => setTxDropdownOpen(true)}
                  placeholder="Buscar compra no cartão..."
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    width: '100%',
                    fontSize: 'var(--font-size-sm)',
                  }}
                />
              </div>
              {txDropdownOpen && filteredTxs.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    zIndex: 10,
                    maxHeight: 200,
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    marginTop: '0.25rem',
                  }}
                >
                  {filteredTxs.map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => handleSelectTx(tx)}
                      style={{
                        padding: '0.75rem 1rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
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
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0,00"
              min="0"
              step="0.01"
              style={inputStyle}
            />
          </div>

          {/* Recurrence Type Option Selector */}
          <div>
            <label style={labelStyle}>Recorrência do Lançamento</label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-tertiary)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              {[
                { val: 'single', lbl: 'Lançamento Único' },
                { val: 'parcelado', lbl: 'Lançamento Parcelado (parcelas fixas)' },
                { val: 'continuous', lbl: 'Recorrência Contínua (mensal fixo, ex: aluguel, assinatura)' },
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
                    onChange={(e) => setNumParcelas(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Data da 1ª Parcela</label>
                  <input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
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
                    onChange={(e) => setFirstDueDate(e.target.value)}
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
                  onChange={(e) => setFirstDueDate(e.target.value)}
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
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem 1.5rem',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!personName.trim() || !totalAmount || isNaN(parseFloat(totalAmount))}
          >
            Salvar
          </Button>
        </div>
        <SavingOverlay active={saving} />
      </div>
    </div>
  );
}

export default ReceivableModal;
