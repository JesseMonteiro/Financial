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

const CATEGORY_OPTIONS = [
  { value: 'Food', label: 'Alimentação' },
  { value: 'Groceries', label: 'Supermercado' },
  { value: 'Rent', label: 'Aluguel / Habitação' },
  { value: 'Utilities', label: 'Contas de Consumo (Água, Luz)' },
  { value: 'Transport', label: 'Transporte' },
  { value: 'Entertainment', label: 'Lazer / Entretenimento' },
  { value: 'Health', label: 'Saúde' },
  { value: 'Education', label: 'Educação' },
  { value: 'Other', label: 'Outros' },
];

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
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
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

function ExpenseFormFields({
  description,
  setDescription,
  amount,
  setAmount,
  category,
  setCategory,
  date,
  setDate,
  isRecurring,
  setIsRecurring,
  isContinuous,
  setIsContinuous,
  frequency,
  setFrequency,
  occurrences,
  setOccurrences,
}) {
  return (
    <>
      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Descrição</label>
          <input
            type="text"
            placeholder="Ex: Aluguel, Padaria do Zé"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            onChange={(e) => setAmount(e.target.value)}
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
            onChange={(e) => setCategory(e.target.value)}
            className="input"
            style={{ width: '100%' }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Data da Primeira Ocorrência</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            required
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        backgroundColor: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          Despesa Recorrente ou Parcelada?
        </label>

        {isRecurring && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', paddingLeft: '1.5rem', borderLeft: '2px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
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
                  onChange={(e) => setFrequency(e.target.value)}
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
                    onChange={(e) => setOccurrences(e.target.value)}
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
    </>
  );
}

function blankFormState() {
  return {
    description: '',
    amount: '',
    category: 'Food',
    date: new Date().toISOString().slice(0, 10),
    isRecurring: false,
    isContinuous: false,
    frequency: 'monthly',
    occurrences: '12',
  };
}

export function ManualExpenses() {
  const {
    transactions,
    loadTransactions,
    addManualTransaction,
    updateManualExpense,
    deleteManualTransaction,
    setManualPaid,
    updateManualAmount,
    loading,
  } = useTransactionStore();

  const [form, setForm] = useState(blankFormState);
  const [showForm, setShowForm] = useState(false);
  /** @type {[null|string, Function]} sample installment id when editing a group */
  const [editingId, setEditingId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  /** Inline amount edit for a single installment only */
  /** @type {[null|{ id: string, groupKey: string, draft: string }, Function]} */
  const [editingAmount, setEditingAmount] = useState(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  const manualTxs = useMemo(() => transactions.filter((t) => t.isManual === true), [transactions]);

  const groupedManualTxs = useMemo(() => {
    const groups = {};

    manualTxs.forEach((tx) => {
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
          allInstallments: [],
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

  const setFormField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(blankFormState());
  };

  const openAddForm = () => {
    setEditingAmount(null);
    setEditingId(null);
    setForm(blankFormState());
    setShowForm(true);
  };

  const openEditForm = (group) => {
    const sample = group.allInstallments[0];
    if (!sample) return;
    setEditingAmount(null);
    setEditingId(sample.id);
    setForm({
      description: group.description || '',
      amount: String(Math.abs(Number(sample.amount) || 0)),
      category: group.category || 'Other',
      date: String(group.date || '').slice(0, 10),
      isRecurring: Boolean(group.isRecurring || group.installmentsCount > 1),
      isContinuous: Boolean(group.isContinuous),
      frequency: 'monthly',
      occurrences: String(
        group.isContinuous ? 24 : Math.max(group.installmentsCount, 1)
      ),
    });
    setShowForm(true);
  };

  const toggleExpanded = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startEditOne = (inst, groupKey) => {
    setShowForm(false);
    setEditingId(null);
    setEditingAmount({
      id: inst.id,
      groupKey,
      draft: String(Math.abs(Number(inst.amount) || 0)),
    });
  };

  const cancelAmountEdit = () => setEditingAmount(null);

  const saveAmountEdit = async () => {
    if (!editingAmount) return;
    const num = parseFloat(editingAmount.draft);
    if (Number.isNaN(num) || num < 0) return;
    await updateManualAmount(editingAmount.id, num, { scope: 'one' });
    setEditingAmount(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount) return;

    const payload = {
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      date: new Date(form.date + 'T12:00:00.000Z'),
      isRecurring: form.isRecurring,
      isContinuous: form.isRecurring && form.isContinuous,
      frequency: form.frequency,
      occurrences: parseInt(form.occurrences, 10) || 12,
    };

    if (editingId) {
      await updateManualExpense(editingId, payload);
    } else {
      await addManualTransaction(payload);
    }

    closeForm();
  };

  const isEditing = Boolean(editingId);

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
          <Button
            icon={Plus}
            onClick={() => {
              if (showForm && !isEditing) closeForm();
              else openAddForm();
            }}
          >
            {showForm && !isEditing ? 'Cancelar' : 'Nova Despesa'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card
          title={isEditing ? 'Editar Despesa Manual' : 'Nova Despesa Manual'}
          subtitle={
            isEditing
              ? 'Altere nome, valor, categoria, data ou converta em recorrente/parcelada. Marcações de pago são preservadas quando a data da ocorrência coincide.'
              : 'Informe os detalhes da despesa. Ela será mesclada ao seu orçamento e extrato de transações.'
          }
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <ExpenseFormFields
              description={form.description}
              setDescription={setFormField('description')}
              amount={form.amount}
              setAmount={setFormField('amount')}
              category={form.category}
              setCategory={setFormField('category')}
              date={form.date}
              setDate={setFormField('date')}
              isRecurring={form.isRecurring}
              setIsRecurring={setFormField('isRecurring')}
              isContinuous={form.isContinuous}
              setIsContinuous={setFormField('isContinuous')}
              frequency={form.frequency}
              setFrequency={setFormField('frequency')}
              occurrences={form.occurrences}
              setOccurrences={setFormField('occurrences')}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={closeForm}>
                Cancelar
              </Button>
              <Button type="submit">
                {isEditing ? 'Salvar Alterações' : 'Salvar Despesa'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Despesas Cadastradas"
        subtitle="Edite a despesa completa pelo lápis do grupo. Expanda as parcelas para alterar o valor de um mês ou marcar como pago."
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
              .map((group) => {
                const groupKey = group.parentId || group.id;
                const isSeries = group.installmentsCount > 1 || group.isRecurring;
                const expanded = Boolean(expandedGroups[groupKey]);
                const single = group.allInstallments[0];

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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 12rem', minWidth: 0 }}>
                        {isSeries ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(groupKey)}
                            style={{
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: 0, display: 'flex', flexShrink: 0,
                            }}
                            aria-label={expanded ? 'Recolher parcelas' : 'Expandir parcelas'}
                            aria-expanded={expanded}
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
                        {!isSeries && single && (
                          <PaidCheckbox
                            checked={single.isPaid}
                            onChange={(v) => setManualPaid(single.id, v)}
                          />
                        )}
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
                          onClick={() => openEditForm(group)}
                          className="tap-target"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                          title="Editar despesa"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteManualTransaction(group.id)}
                          className="tap-target"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                          title={group.isRecurring ? 'Excluir toda a série recorrente' : 'Excluir despesa'}
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
                            editingAmount &&
                            editingAmount.id === inst.id;

                          return (
                            <div
                              key={inst.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                                flexWrap: 'wrap',
                                padding: '0.5rem 0.65rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: inst.isPaid ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                                border: `1px solid ${inst.isPaid ? 'rgba(16,185,129,0.35)' : 'var(--border-color)'}`,
                                opacity: inst.isPaid ? 0.92 : 1,
                              }}
                            >
                              <div style={{ minWidth: 0, flex: '1 1 8rem' }}>
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
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  flex: '1 1 auto',
                                  justifyContent: 'flex-end',
                                  flexWrap: 'wrap',
                                  minWidth: 0,
                                }}
                              >
                                {isEditingThis ? (
                                  <AmountEditRow
                                    value={editingAmount.draft}
                                    onChange={(v) => setEditingAmount((prev) => ({ ...prev, draft: v }))}
                                    onSave={saveAmountEdit}
                                    onCancel={cancelAmountEdit}
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
