import React, { useEffect, useState, useMemo } from 'react';
import { useTransactionStore } from '../stores/transactionStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatDate } from '../utils/formatters';
import { translateCategory } from '../utils/categories';
import { getCategoryColor } from '../utils/colors';
import { Plus, Trash2, Calendar, DollarSign, Clock, HelpCircle } from 'lucide-react';

export function ManualExpenses() {
  const { transactions, loadTransactions, addManualTransaction, deleteManualTransaction, loading } = useTransactionStore();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false); // true = infinite recurrence
  const [frequency, setFrequency] = useState('monthly');
  const [occurrences, setOccurrences] = useState('12');

  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const manualTxs = useMemo(() => transactions.filter(t => t.isManual === true), [transactions]);

  // Group manual transactions for grouped display
  const groupedManualTxs = useMemo(() => {
    const groups = {};
    
    manualTxs.forEach(tx => {
      const key = tx.parentId || tx.id;
      if (!groups[key]) {
        groups[key] = {
          id: tx.id, // reference ID for deletion
          parentId: tx.parentId,
          description: tx.originalDescription || tx.description?.replace(/ \(\d+\/\d+\)$/, '').replace(/ \(Recorrente\)$/, ''),
          amount: tx.amount,
          category: tx.category,
          date: tx.date,
          isRecurring: tx.isRecurring,
          isContinuous: tx.isContinuous,
          installmentsCount: 0,
          allInstallments: []
        };
      }
      groups[key].allInstallments.push(tx);
      groups[key].installmentsCount += 1;
      
      // Keep earliest date as display date
      if (new Date(tx.date) < new Date(groups[key].date)) {
        groups[key].date = tx.date;
      }
    });

    return Object.values(groups);
  }, [manualTxs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !amount) return;

    await addManualTransaction({
      description,
      amount: parseFloat(amount),
      category,
      date: new Date(date + 'T12:00:00.000Z'), // mid-day to avoid timezone shifting
      isRecurring,
      isContinuous: isRecurring && isContinuous,
      frequency,
      occurrences: parseInt(occurrences, 10) || 12
    });

    // Reset form
    setDescription('');
    setAmount('');
    setIsRecurring(false);
    setIsContinuous(false);
    setShowAddForm(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Despesas Manuais</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Cadastre e gerencie despesas em dinheiro, boleto ou que não passam pelo Open Finance.
          </p>
        </div>
        <Button icon={Plus} onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancelar' : 'Nova Despesa'}
        </Button>
      </div>

      {/* Add Expense Form */}
      {showAddForm && (
        <Card title="Nova Despesa Manual" subtitle="Informe os detalhes da despesa. Ela será mesclada ao seu orçamento e extrato de transações.">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

            {/* Recurring Toggle */}
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
                  
                  {/* Recurrence Type Selector */}
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

      {/* Manual Expenses List */}
      <Card title="Despesas Cadastradas" subtitle="Visualização agrupada por série/categoria. A exclusão de uma despesa recorrente apagará todas as suas parcelas.">
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
              .map(group => (
                <div
                  key={group.parentId || group.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      backgroundColor: 'var(--danger-bg)', color: 'var(--danger)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <DollarSign size={18} />
                    </div>
                    <div>
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
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Calendar size={12} /> Começa em {formatDate(group.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--danger)', display: 'block' }}>
                        {formatCurrency(group.amount)}
                      </span>
                      {group.isRecurring && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          por ocorrência
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteManualTransaction(group.id)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                      title={group.isRecurring ? "Excluir toda a série recorrente" : "Excluir despesa"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}
export default ManualExpenses;
