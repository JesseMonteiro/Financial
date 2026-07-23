import React, { useEffect, useMemo, useState } from 'react';
import { Target, Plus, Info, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useGoalStore } from '../stores/goalStore';
import { formatCurrency, formatDate } from '../utils/formatters';
import { goalProjection } from '../utils/analytics';

export function Goals() {
  const { goals, loadGoals, addGoal, removeGoal } = useGoalStore();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    loadGoals();
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (title && targetAmount) {
      addGoal({
        title,
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount) || 0,
        deadline: deadline || '2027-12-31',
        createdAt: new Date().toISOString(),
        color: '#0d9488',
      });
      setShowModal(false);
      setTitle('');
      setTargetAmount('');
      setCurrentAmount('');
      setDeadline('');
    }
  };

  const projections = useMemo(
    () => Object.fromEntries(goals.map((g) => [g.id, goalProjection(g)])),
    [goals]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Metas Financeiras</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Acompanhe o progresso e o ritmo mensal necessário até o prazo.
          </p>
        </div>
        <div className="page-header__actions">
          <Button icon={Plus} onClick={() => setShowModal(true)}>Nova Meta</Button>
        </div>
      </div>

      <Card title={`Suas Metas (${goals.length})`}>
        {goals.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Info size={36} />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Nenhuma meta cadastrada ainda</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', maxWidth: 450 }}>
              Clique em <strong>Nova Meta</strong> para definir um objetivo (ex.: reserva de emergência, viagem).
            </p>
          </div>
        ) : (
          <div className="dashboard-grid" style={{ marginTop: '1rem' }}>
            {goals.map((g) => {
              const proj = projections[g.id] || {};
              const pct = proj.pct || 0;
              return (
                <Card key={g.id} className="col-6">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: g.color || 'var(--primary)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Target size={24} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{g.title}</h3>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          Alvo: {formatCurrency(g.targetAmount)} · Até {formatDate(g.deadline)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGoal(g.id)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)' }}>
                      <span>
                        Acumulado: <strong>{formatCurrency(g.currentAmount)}</strong>
                      </span>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <ProgressBar percent={pct} color={g.color || 'var(--primary)'} height={12} />

                    {proj.expectedPct != null && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span>Ritmo esperado</span>
                          <span>{proj.expectedPct}%</span>
                        </div>
                        <ProgressBar
                          percent={proj.expectedPct}
                          color="var(--text-muted)"
                          height={4}
                        />
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: '0.65rem',
                        padding: '0.65rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-secondary)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <span>
                        Faltam <strong>{formatCurrency(proj.remaining || 0)}</strong>
                        {proj.monthsLeft != null ? ` · ~${proj.monthsLeft} meses` : ''}
                      </span>
                      {proj.neededPerMonth != null && proj.monthsLeft > 0 && (
                        <span>
                          Ritmo necessário: <strong>{formatCurrency(proj.neededPerMonth)}/mês</strong>
                        </span>
                      )}
                      {proj.onTrack != null && (
                        <span style={{ color: proj.onTrack ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {proj.onTrack ? 'No ritmo do prazo' : 'Abaixo do ritmo esperado'}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

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
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Já acumulado (R$)</label>
                <input
                  type="number"
                  placeholder="Ex: 1500"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Prazo</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="input"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit">Salvar Meta</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
