import React, { useEffect, useState, useMemo } from 'react';
import { useTransactionStore } from '../stores/transactionStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import { getCategoryColor } from '../utils/colors';
import {
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Pencil,
  Check,
  X,
} from 'lucide-react';

function PaidCheckbox({ checked, onChange, label = 'Pago' }) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 600,
        color: checked ? 'var(--success)' : 'var(--text-muted)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      title="Marcar como pago (apenas controle; não altera saldo)"
    >
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--success)' }}
      />
      {checked ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <CheckCircle2 size={12} /> {label}
        </span>
      ) : (
        label
      )}
    </label>
  );
}

function AmountEditRow({ value, onChange, onSave, onCancel, hint }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        flexShrink: 0,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <input
          type="number"
          step="0.01"
          min="0"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
          className="input"
          style={{
            width: 96,
            padding: '0.25rem 0.4rem',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 700,
            textAlign: 'right',
          }}
        />
        {hint && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', maxWidth: 140, textAlign: 'right' }}>
            {hint}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        className="tap-target"
        title="Salvar"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--success)', padding: 2 }}
      >
        <Check size={16} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="tap-target"
        title="Cancelar"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ManualExpenses() {
  const {
    transactions,
    loadTransactions,
    addManualTransaction,
    deleteManualTransaction,
    setManualPaid,
    updateManualAmount,
    loading,
  } = useTransactionStore();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [occurrences, setOccurrences] = useState('12');

  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});

  /** @type {[null|{ mode: 'series'|'one', id: string, groupKey: string, draft: string }, Function]} */
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const manualTxs = useMemo(() => transactions.filter(t => t.isManual === true), [transactions]);

  const groupedManualTxs = useMemo(() => {
    const groups = {};
    
    manualTxs.forEach(tx => {
      const key = tx.parentId || tx.id;
      if (!groups[key]) {
        groups[key] = {
          id: tx.id,
          parentId: tx.parentId,
          description: tx.originalDescription || tx.description?.replace(/ \(\d+\/\d+\)$/, '').replace(/ \(Recorrente\)$/, ''),
          category: tx.category,
          date: tx.date,
          isRecurring: tx.isRecurring,
          isContinuous: tx.isContinuous,
          installmentsCount: 0,
          paidCount: 0,
          allInstallments: []
        };
      }
      groups[key].allInstallments.push(tx);
      groups[key].installmentsCount += 1;
      if (tx.isPaid) groups[key].paidCount += 1;
      
      if (new Date(tx.date) < new Date(groups[key].date)) {
        groups[key].date = tx.date;
      }
    });

    Object.values(groups).forEach((g) => {
      g.allInstallments.sort((a, b) => new Date(a.date) - new Date(b.date));
      const absAmounts = g.allInstallments.map((t) => Math.abs(Number(t.amount) || 0));
      const first = absAmounts[0] || 0;
      g.hasVariedAmounts = absAmounts.some((a) => Math.abs(a - first) > 0.001);
      g.amount = -first;
      g.displayAmount = first;
    });

    return Object.values(groups);
  }, [manualTxs]);

  const toggleExpanded = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startEditSeries = (group) => {
    const sample = group.allInstallments[0];
    if (!sample) return;
    setEditing({
      mode: group.installmentsCount > 1 || group.isRecurring ? 'series' : 'one',
      id: sample.id,
      groupKey: group.parentId || group.id,
      draft: String(Math.abs(Number(sample.amount) || 0)),
    });
  };

  const startEditOne = (inst, groupKey) => {
    setEditing({
      mode: 'one',
      id: inst.id,
      groupKey,
      draft: String(Math.abs(Number(inst.amount) || 0)),
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    const num = parseFloat(editing.draft);
    if (Number.isNaN(num) || num < 0) return;
    await updateManualAmount(editing.id, num, { scope: editing.mode });
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount) return;

    await addManualTransaction({
      description,
      amount: parseFloat(amount),
      category,
      date: new Date(date + 'T12:00:00.000Z'),
      isRecurring,
      isContinuous: isRecurring && isContinuous,
      frequency,
      occurrences: parseInt(occurrences, 10) || 12
    });

    setDescription('');
    setAmount('');
    setIsRecurring(false);
    setIsContinuous(false);
    setShowAddForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Despesas Manuais</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Cadastre e gerencie despesas em dinheiro, boleto ou que não passam pelo Open Finance.
          </p>
        </div>
        <div className="page-header__actions">
          <Button icon={Plus} onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancelar' : 'Nova Despesa'}
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card title="Nova Despesa Manual" subtitle="Informe os detalhes da despesa. Ela será mesclada ao seu orçamento e extrato de transações.">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel, Padaria do Zé"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input"
                  required
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Valor por Ocorrência (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input"
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Categoria</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="Food">Alimentação</option>
                  <option value="Groceries">Supermercado</option>
                  <option value="Rent">Aluguel / Habitação</option>
                  <option value="Utilities">Contas de Consumo (Água, Luz)</option>
                  <option value="Transport">Transporte</option>
                  <option value="Entertainment">Lazer / Entretenimento</option>
                  <option value="Health">Saúde</option>
                  <option value="Education">Educação</option>
                  <option value="Other">Outros</option>
                </select>
              </div>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Data da Primeira Ocorrência</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="input"
                  required
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.75rem',
              backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                Despesa Recorrente ou Parcelada?
              </label>
              
              {isRecurring && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>
                      <input
                        type="radio"
                        name="recurrence_type"
                        checked={!isContinuous}
                        onChange={() => setIsContinuous(false)}
                      />
                      Parcelas Fixas (ex: Compras parceladas)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>
                      <input
                        type="radio"
                        name="recurrence_type"
                        checked={isContinuous}
                        onChange={() => setIsContinuous(true)}
                      />
                      Recorrência Contínua (ex: Aluguel, Assinaturas)
                    </label>
                  </div>

                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Frequência</label>
                      <select
                        value={frequency}
                        onChange={e => setFrequency(e.target.value)}
                        className="input"
                        style={{ width: '100%' }}
                      >
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                        <option value="yearly">Anual</option>
                      </select>
                    </div>
                    
                    {!isContinuous ? (
                      <div>
                        <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Número de Parcelas</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={occurrences}
                          onChange={e => setOccurrences(e.target.value)}
                          className="input"
                          style={{ width: '100%' }}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'center', color: 'var(--text-muted)', fontSize: '11px', marginTop: '1.2rem' }}>
                        <HelpCircle size={14} />
                        <span>Gerará recorrência mensal contínua automaticamente nos orçamentos</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Salvar Despesa
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Despesas Cadastradas"
        subtitle="Editar no grupo altera todas as parcelas; editar uma parcela altera só aquele mês. Marque Pago por ocorrência."
      >
        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Carregando despesas...</p>
        ) : groupedManualTxs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            Nenhuma despesa manual cadastrada.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {groupedManualTxs
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map(group => {
                const groupKey = group.parentId || group.id;
                const isSeries = group.installmentsCount > 1 || group.isRecurring;
                const expanded = expandedGroups[groupKey] ?? isSeries;
                const single = group.allInstallments[0];
                const editingSeries =
                  editing &&
                  editing.groupKey === groupKey &&
                  editing.mode === 'series';
                const editingSingleOuter =
                  editing &&
                  editing.groupKey === groupKey &&
                  editing.mode === 'one' &&
                  !isSeries;

                return (
                  <div
                    key={groupKey}
                    style={{
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1rem', gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                        {isSeries ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(groupKey)}
                            style={{
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: 0, display: 'flex',
                            }}
                            aria-label={expanded ? 'Recolher parcelas' : 'Expandir parcelas'}
                          >
                            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        ) : (
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            backgroundColor: 'var(--danger-bg)', color: 'var(--danger)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <DollarSign size={18} />
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                            {group.description}
                          </h4>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                            <Badge variant="neutral" style={{ backgroundColor: getCategoryColor(group.category) + '11', color: getCategoryColor(group.category) }}>
                              {translateCategory(group.category)}
                            </Badge>
                            {group.isRecurring && (
                              <Badge variant={group.isContinuous ? 'info' : 'warning'}>
                                <Clock size={10} style={{ marginRight: '2px' }} />
                                {group.isContinuous ? 'Mensal Recorrente' : `${group.installmentsCount} parcelas`}
                              </Badge>
                            )}
                            {isSeries && (
                              <Badge variant={group.paidCount === group.installmentsCount ? 'success' : 'neutral'}>
                                {group.paidCount}/{group.installmentsCount} pagas
                              </Badge>
                            )}
                            {group.hasVariedAmounts && (
                              <Badge variant="warning" style={{ fontSize: 9 }}>Valores variados</Badge>
                            )}
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <Calendar size={12} /> Começa em {formatDate(group.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                        {!isSeries && single && !(editingSeries || editingSingleOuter) && (
                          <PaidCheckbox
                            checked={single.isPaid}
                            onChange={(v) => setManualPaid(single.id, v)}
                          />
                        )}
                        {editingSeries || editingSingleOuter ? (
                          <AmountEditRow
                            value={editing.draft}
                            onChange={(v) => setEditing((prev) => ({ ...prev, draft: v }))}
                            onSave={saveEdit}
                            onCancel={cancelEdit}
                            hint={
                              editingSeries
                                ? 'Aplica a todas as parcelas'
                                : undefined
                            }
                          />
                        ) : (
                          <>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--danger)', display: 'block' }}>
                                {group.hasVariedAmounts ? 'a partir de ' : ''}
                                {formatCurrency(group.displayAmount)}
                              </span>
                              {group.isRecurring && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  {group.hasVariedAmounts ? 'valores por mês' : 'por ocorrência'}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditSeries(group)}
                              className="tap-target"
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                              title={
                                isSeries
                                  ? 'Editar valor de todas as parcelas'
                                  : 'Editar valor'
                              }
                            >
                              <Pencil size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteManualTransaction(group.id)}
                          className="tap-target"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                          title={group.isRecurring ? "Excluir toda a série recorrente" : "Excluir despesa"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {isSeries && expanded && (
                      <div style={{
                        borderTop: '1px solid var(--border-color)',
                        padding: '0.5rem 0.75rem 0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        backgroundColor: 'var(--bg-secondary)',
                      }}>
                        {group.allInstallments.map((inst, idx) => {
                          const isEditingThis =
                            editing &&
                            editing.mode === 'one' &&
                            editing.id === inst.id;

                          return (
                            <div
                              key={inst.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                padding: '0.5rem 0.65rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: inst.isPaid ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                                border: `1px solid ${inst.isPaid ? 'rgba(16,185,129,0.35)' : 'var(--border-color)'}`,
                                opacity: inst.isPaid ? 0.92 : 1,
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <span style={{
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  textDecoration: inst.isPaid ? 'line-through' : 'none',
                                }}>
                                  {group.isContinuous
                                    ? `Ocorrência ${idx + 1}`
                                    : `Parcela ${idx + 1}/${group.installmentsCount}`}
                                </span>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                                  Vence {formatDate(inst.date)}
                                  {inst.paidAt ? ` · marcado em ${formatDate(inst.paidAt)}` : ''}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                {isEditingThis ? (
                                  <AmountEditRow
                                    value={editing.draft}
                                    onChange={(v) => setEditing((prev) => ({ ...prev, draft: v }))}
                                    onSave={saveEdit}
                                    onCancel={cancelEdit}
                                    hint="Só este mês"
                                  />
                                ) : (
                                  <>
                                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>
                                      {formatCurrency(inst.amount)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => startEditOne(inst, groupKey)}
                                      className="tap-target"
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        padding: 2,
                                      }}
                                      title="Editar valor só desta parcela"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <PaidCheckbox
                                      checked={inst.isPaid}
                                      onChange={(v) => setManualPaid(inst.id, v)}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </Card>
    </div>
  );
}
export default ManualExpenses;
