import React, { useEffect, useState } from 'react';
import { Tags, Plus, Info, Trash2, Pencil } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { IconBusyButton, SavingScope } from '../components/ui/Spinner';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { useCategoryStore } from '../stores/categoryStore';
import { isInitialEmpty } from '../utils/loading';

const PRESET_COLORS = [
  '#f97316',
  '#fb923c',
  '#a855f7',
  '#c084fc',
  '#0ea5e9',
  '#ec4899',
  '#10b981',
  '#eab308',
  '#64748b',
  '#6366f1',
];

export function Categories() {
  const {
    categories,
    loadCategories,
    saveCategory,
    removeCategory,
    pending,
    loading,
    lastUpdated,
  } = useCategoryStore();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    loadCategories();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setLabel('');
    setColor(PRESET_COLORS[0]);
    setShowModal(true);
  };

  const openEdit = (category) => {
    setEditing(category);
    setLabel(category.label);
    setColor(category.color || PRESET_COLORS[0]);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditing(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!label.trim() || saving) return;
    setSaving(true);
    try {
      await saveCategory({
        id: editing?.id,
        label: label.trim(),
        color,
      });
      setShowModal(false);
      setEditing(null);
      setLabel('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (isInitialEmpty(categories, loading, lastUpdated)) {
    return (
      <PageLoadingSkeleton
        kpiCount={0}
        showTimeline={false}
        showChart={false}
        showList
        label="Carregando categorias…"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>Categorias</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Organize as categorias usadas para classificar compras e despesas manuais.
          </p>
        </div>
        <div className="page-header__actions">
          <Button icon={Plus} onClick={openCreate}>Nova categoria</Button>
        </div>
      </div>

      <Card title={`Suas categorias (${categories.length})`}>
        {categories.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <Info size={36} />
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Nenhuma categoria cadastrada ainda</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', maxWidth: 450 }}>
              Clique em <strong>Nova categoria</strong> para criar um rótulo (ex.: Alimentação, Transporte).
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {categories.map((category) => (
              <div
                key={category.id || category.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      backgroundColor: category.color || 'var(--primary)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{category.label}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{category.key}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <IconBusyButton
                    onClick={() => openEdit(category)}
                    busy={Boolean(pending[category.id])}
                    title="Editar categoria"
                  >
                    <Pencil size={16} />
                  </IconBusyButton>
                  <IconBusyButton
                    onClick={() => removeCategory(category.id)}
                    busy={Boolean(pending[category.id])}
                    title="Excluir categoria"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={16} />
                  </IconBusyButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <SavingScope active={saving}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tags size={22} />
                {editing ? 'Editar categoria' : 'Nova categoria'}
              </h2>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Nome</label>
                  <input
                    type="text"
                    placeholder="Ex: Alimentação"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="input"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Cor</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {PRESET_COLORS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setColor(preset)}
                        aria-label={`Cor ${preset}`}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          backgroundColor: preset,
                          border: color === preset ? '2px solid var(--text-primary)' : '2px solid transparent',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      aria-label="Cor personalizada"
                      style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <Button variant="outline" type="button" onClick={closeModal} disabled={saving}>Cancelar</Button>
                  <Button type="submit" loading={saving}>{editing ? 'Salvar' : 'Criar categoria'}</Button>
                </div>
              </form>
            </div>
          </SavingScope>
        </div>
      )}
    </div>
  );
}
