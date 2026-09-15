import React, { useEffect, useState, useMemo, useId } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTransactionStore } from '../stores/transactionStore';
import { useAccountStore } from '../stores/accountStore';
import { useCategoryStore } from '../stores/categoryStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PaidCheckbox } from '../components/ui/PaidCheckbox';
import { IconBusyButton, SavingScope } from '../components/ui/Spinner';
import { SkeletonList } from '../components/ui/Skeleton';
import { formatCurrency, formatDate } from '../utils/formatters';
import { resolveCategoryLabel, resolveCategoryColor, userCategoryOptions } from '../utils/categories';
import { getCategoryColor } from '../utils/colors';
import { isInitialEmpty } from '../utils/loading';
import { previewInstallmentSplit, totalFromStoredInstallments } from '../utils/manualAccounts';
import { AccountIcon, accountById } from '../components/AccountIcon';
import { ItemDetailSheet } from '../components/ItemDetailSheet';
import { fromManualExpense, categoryOptionsForItem, applyingCategory } from '../utils/lineItemDetail';
import {
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Clock,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
} from 'lucide-react';

function AmountEditRow({ value, onChange, onSave, onCancel, hint, busy = false }) {
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
          disabled={busy}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) onSave();
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
      <IconBusyButton
        busy={busy}
        onClick={onSave}
        title="Salvar"
        style={{ color: 'var(--success)' }}
      >
        <Check size={16} />
      </IconBusyButton>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="tap-target"
        title="Cancelar"
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ExpenseFormFields({
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
  categoryOptions,
}) {
  const radioName = `recurrence_type_${useId()}`;
  const options = categoryOptions?.length ? categoryOptions : userCategoryOptions();
  const splitPreview = previewInstallmentSplit(amount, {
    isRecurring,
    isContinuous,
    occurrences,
  });

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
          <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Valor total (R$)</label>
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
          {splitPreview && (
            <p style={{ margin: '0.4rem 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              {splitPreview.count} parcelas de {formatCurrency(splitPreview.per)}
              {splitPreview.lastDiffers ? ` · última ${formatCurrency(splitPreview.last)}` : ''}
            </p>
          )}
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
            {options.map((opt) => (
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
                  name={radioName}
                  checked={!isContinuous}
                  onChange={() => setIsContinuous(false)}
                />
                Parcelas Fixas (ex: Compras parceladas)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: 'var(--font-size-xs)' }}>
                <input
                  type="radio"
                  name={radioName}
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
                  {splitPreview && (
                    <p style={{ margin: '0.35rem 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      Valor por parcela: {formatCurrency(splitPreview.per)}
                      {splitPreview.lastDiffers ? ` (última ${formatCurrency(splitPreview.last)})` : ''}
                    </p>
                  )}
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

function blankFormState(accountId = 'manual') {
  return {
    description: '',
    amount: '',
    category: 'Food',
    date: new Date().toISOString().slice(0, 10),
    isRecurring: false,
    isContinuous: false,
    frequency: 'monthly',
    occurrences: '12',
    accountId: accountId || 'manual',
  };
}

export function PurchaseModal({ account, onClose, onSave, saving }) {
  const { categories, loadCategories } = useCategoryStore();
  const [form, setForm] = useState(() => blankFormState(account?.id));
  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const categoryOptions = userCategoryOptions(categories);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (!categoryOptions.some((opt) => opt.value === form.category) && categoryOptions[0]) {
      setForm((prev) => ({ ...prev, category: categoryOptions[0].value }));
    }
  }, [categoryOptions, form.category]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.description || !form.amount || saving) return;
    onSave({
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      date: new Date(`${form.date}T12:00:00.000Z`),
      isRecurring: form.isRecurring,
      isContinuous: form.isRecurring && form.isContinuous,
      frequency: form.frequency,
      occurrences: parseInt(form.occurrences, 10) || 12,
      accountId: account.id,
    });
  };

  return (
    <div className="modal-overlay" onClick={() => { if (!saving) onClose(); }}>
      <SavingScope active={saving}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: '0.35rem' }}>
            Adicionar compra
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem' }}>
            {account.name} {account.isManual ? '· Manual' : ''}
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ExpenseFormFields
              description={form.description}
              setDescription={setField('description')}
              amount={form.amount}
              setAmount={setField('amount')}
              category={form.category}
              setCategory={setField('category')}
              date={form.date}
              setDate={setField('date')}
              isRecurring={form.isRecurring}
              setIsRecurring={setField('isRecurring')}
              isContinuous={form.isContinuous}
              setIsContinuous={setField('isContinuous')}
              frequency={form.frequency}
              setFrequency={setField('frequency')}
              occurrences={form.occurrences}
              setOccurrences={setField('occurrences')}
              categoryOptions={categoryOptions}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="outline" type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button type="submit" loading={saving}>Salvar compra</Button>
            </div>
          </form>
        </div>
      </SavingScope>
    </div>
  );
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
    updateManualCategory,
    loading,
    pending,
    lastUpdated,
  } = useTransactionStore();
  const { accounts, loadAccounts } = useAccountStore();
  const { categories, loadCategories } = useCategoryStore();
  const [searchParams] = useSearchParams();
  const prefillAccountId = searchParams.get('accountId') || 'manual';

  const [form, setForm] = useState(() => blankFormState(prefillAccountId));
  const [showForm, setShowForm] = useState(false);
  /** @type {[null|string, Function]} sample installment id when editing a group */
  const [editingId, setEditingId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [savingForm, setSavingForm] = useState(false);
  const [savingAmount, setSavingAmount] = useState(false);
  const manualAccounts = useMemo(() => accounts.filter((a) => a.isManual), [accounts]);
  const extraLinkedAccount = useMemo(() => {
    const id = form.accountId;
    if (!id || id === 'manual') return null;
    if (manualAccounts.some((a) => a.id === id)) return null;
    return accounts.find((a) => a.id === id) || null;
  }, [accounts, form.accountId, manualAccounts]);

  /** Inline amount edit for a single installment only */
  /** @type {[null|{ id: string, groupKey: string, draft: string }, Function]} */
  const [editingAmount, setEditingAmount] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const categoryOptions = userCategoryOptions(categories);

  useEffect(() => {
    loadTransactions();
    loadAccounts();
    loadCategories();
  }, []);

  useEffect(() => {
    if (!prefillAccountId || prefillAccountId === 'manual') return;
    const isKnownManual = accounts.some((a) => a.isManual && a.id === prefillAccountId);
    setShowForm(true);
    setForm((prev) => ({
      ...prev,
      accountId: isKnownManual ? prefillAccountId : 'manual',
    }));
  }, [prefillAccountId, accounts]);

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
    setForm(blankFormState(prefillAccountId));
  };

  const openAddForm = () => {
    setEditingAmount(null);
    setEditingId(null);
    setForm(blankFormState(prefillAccountId));
    setShowForm(true);
  };

  const openEditForm = (group) => {
    const sample = group.allInstallments[0];
    if (!sample) return;
    setEditingAmount(null);
    setEditingId(sample.id);
    const isRecurring = Boolean(group.isRecurring || group.installmentsCount > 1);
    const isContinuous = Boolean(group.isContinuous);
    setForm({
      description: group.description || '',
      amount: String(totalFromStoredInstallments(group.allInstallments, { isRecurring, isContinuous })),
      category: group.category || 'Other',
      date: String(group.date || '').slice(0, 10),
      isRecurring,
      isContinuous,
      frequency: 'monthly',
      occurrences: String(
        isContinuous ? 24 : Math.max(group.installmentsCount, 1)
      ),
      accountId: sample.accountId || 'manual',
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
    if (!editingAmount || savingAmount) return;
    const num = parseFloat(editingAmount.draft);
    if (Number.isNaN(num) || num < 0) return;
    setSavingAmount(true);
    try {
      await updateManualAmount(editingAmount.id, num, { scope: 'one' });
      setEditingAmount(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingAmount(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount || savingForm) return;

    const payload = {
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      date: new Date(form.date + 'T12:00:00.000Z'),
      isRecurring: form.isRecurring,
      isContinuous: form.isRecurring && form.isContinuous,
      frequency: form.frequency,
      occurrences: parseInt(form.occurrences, 10) || 12,
      accountId: form.accountId || 'manual',
    };

    setSavingForm(true);
    try {
      if (editingId) {
        await updateManualExpense(editingId, payload);
      } else {
        await addManualTransaction(payload);
      }
      closeForm();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingForm(false);
    }
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
            disabled={savingForm}
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
        <SavingScope active={savingForm}>
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
              categoryOptions={categoryOptions}
            />

            <div>
              <label className="label" style={{ display: 'block', marginBottom: '0.4rem', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                Conta ou cartão
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {form.accountId && form.accountId !== 'manual' && (
                  <AccountIcon account={accountById(accounts, form.accountId) || extraLinkedAccount} size={22} />
                )}
                <select
                value={form.accountId || 'manual'}
                onChange={(e) => setFormField('accountId')(e.target.value)}
                className="input"
                style={{ width: '100%' }}
              >
                <option value="manual">Sem conta</option>
                {extraLinkedAccount && (
                  <option value={extraLinkedAccount.id}>
                    {extraLinkedAccount.name}
                    {extraLinkedAccount.type === 'CREDIT' ? ' · Cartão' : ' · Conta'}
                  </option>
                )}
                {manualAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                    {acc.type === 'CREDIT' ? ' · Cartão' : ' · Conta'}
                  </option>
                ))}
              </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={closeForm} disabled={savingForm}>
                Cancelar
              </Button>
              <Button type="submit" loading={savingForm}>
                {isEditing ? 'Salvar Alterações' : 'Salvar Despesa'}
              </Button>
            </div>
          </form>
        </Card>
        </SavingScope>
      )}

      <Card
        title="Despesas Cadastradas"
        subtitle="Edite a despesa completa pelo lápis do grupo. Expanda as parcelas para alterar o valor de um mês ou marcar como pago."
      >
        {isInitialEmpty(manualTxs, loading, lastUpdated) ? (
          <SkeletonList rows={5} />
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
                        <div
                          style={{ minWidth: 0, cursor: 'pointer' }}
                          onClick={() => {
                            if (single) {
                              setSelectedItem(fromManualExpense(single, accountById(accounts, single.accountId)?.name));
                            }
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && single) {
                              setSelectedItem(fromManualExpense(single, accountById(accounts, single.accountId)?.name));
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <h4 style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                            {group.description}
                          </h4>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                            <Badge variant="neutral" style={{ backgroundColor: (resolveCategoryColor(group.category, categories) || getCategoryColor(resolveCategoryLabel(group.category, categories))) + '11', color: resolveCategoryColor(group.category, categories) || getCategoryColor(resolveCategoryLabel(group.category, categories)) }}>
                              {resolveCategoryLabel(group.category, categories)}
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
                            busy={Boolean(pending[single.id])}
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
                        <IconBusyButton
                          onClick={() => deleteManualTransaction(group.id)}
                          busy={Boolean(pending[group.id] || (group.parentId && group.allInstallments.some((t) => pending[t.id])))}
                          title={group.isRecurring ? 'Excluir toda a série recorrente' : 'Excluir despesa'}
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Trash2 size={16} />
                        </IconBusyButton>
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
                              <div
                                style={{ minWidth: 0, flex: '1 1 8rem', cursor: 'pointer' }}
                                onClick={() => setSelectedItem(fromManualExpense(inst, accountById(accounts, inst.accountId)?.name))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    setSelectedItem(fromManualExpense(inst, accountById(accounts, inst.accountId)?.name));
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
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
                                    busy={savingAmount}
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
                                      busy={Boolean(pending[inst.id])}
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
      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          busy={sheetBusy}
          onClose={() => setSelectedItem(null)}
          onTogglePaid={async () => {
            setSheetBusy(true);
            try {
              await setManualPaid(selectedItem.sourceId, !selectedItem.isPaid);
            } finally {
              setSheetBusy(false);
              setSelectedItem(null);
            }
          }}
          onEdit={() => {
            const group = groupedManualTxs.find((g) => g.allInstallments.some((t) => t.id === selectedItem.sourceId));
            if (group) openEditForm(group);
            setSelectedItem(null);
          }}
          onDelete={async () => {
            const group = groupedManualTxs.find((g) => g.allInstallments.some((t) => t.id === selectedItem.sourceId));
            setSheetBusy(true);
            try {
              await deleteManualTransaction(group?.id || selectedItem.sourceId);
            } finally {
              setSheetBusy(false);
              setSelectedItem(null);
            }
          }}
          categoryOptions={categoryOptionsForItem(selectedItem, [], categories)}
          onChangeCategory={async (option) => {
            setSheetBusy(true);
            try {
              await updateManualCategory(selectedItem.sourceId, option.value);
              setSelectedItem(applyingCategory(selectedItem, option));
            } finally {
              setSheetBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
export default ManualExpenses;
