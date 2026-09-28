import React, { useEffect, useState } from 'react';
import { useCategoryStore } from '../../stores/categoryStore';
import { Button } from '../ui/Button';
import { SavingScope } from '../ui/Spinner';
import { ExpenseFormFields } from '../ExpenseFormFields';
import { userCategoryOptions } from '../../utils/categories';

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
  }, [loadCategories]);

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

export default PurchaseModal;
