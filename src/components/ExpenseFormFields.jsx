import React, { useId } from 'react';
import { HelpCircle } from 'lucide-react';
import { previewInstallmentSplit } from '../utils/manualAccounts';
import { formatCurrency } from '../utils/formatters';
import { userCategoryOptions } from '../utils/categories';

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

export default ExpenseFormFields;
