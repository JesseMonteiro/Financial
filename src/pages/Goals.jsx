import React, { useEffect, useState } from 'react';
import { Target, Plus, Info, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useGoalStore } from '../stores/goalStore';
import { formatCurrency, formatDate } from '../utils/formatters';

export function Goals() {
  const { goals, loadGoals, addGoal, removeGoal } = useGoalStore();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');

  useEffect(() => {
    loadGoals();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (title && targetAmount) {
      addGoal({
        title,
        targetAmount: parseFloat(targetAmount),
        deadline: '2027-12-31',
        color: '#6366f1'
      });
      setShowModal(false);
      setTitle('');
      setTargetAmount('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Metas Financeiras Pessoais</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Crie e monitore seus objetivos financeiros salvos localmente.
          </p>
        </div>
        <div className="page-header__actions">
          <Button icon={Plus} onClick={() => setShowModal(true)}>Nova Meta</Button>
        </div>
      </div>

      {/* Goals Content */}
      <Card title={`Suas Metas (${goals.length})`}>
        {goals.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Info size={36} />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Nenhuma meta cadastrada ainda</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', maxWidth: 450 }}>
              Você ainda não criou nenhuma meta financeira pessoal. Clique no botão <strong>"Nova Meta"</strong> acima para definir seu primeiro objetivo (ex: Reserva de Emergência, Viagem, etc.).
            </p>
          </div>
        ) : (
          <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
            {goals.map(g => {
              const pct = Math.round((g.currentAmount / g.targetAmount) * 100);
              return (
                <Card key={g.id} className="col-6">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: g.color || 'var(--primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Target size={24} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>{g.title}</h3>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          Alvo: {formatCurrency(g.targetAmount)} • Até {formatDate(g.deadline)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeGoal(g.id)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                      <span>Acumulado: <strong>{formatCurrency(g.currentAmount)}</strong></span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <ProgressBar percent={pct} color={g.color || 'var(--primary)'} height={12} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal Nova Meta */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: '1rem' }}>Criar Nova Meta</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Nome da Meta</label>
                <input
                  type="text"
                  placeholder="Ex: Reserva de Emergência"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Valor Objetivo (R$)</label>
                <input
                  type="number"
                  placeholder="Ex: 10000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit">Salvar Meta</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
