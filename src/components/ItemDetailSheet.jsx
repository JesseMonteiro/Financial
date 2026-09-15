import React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { lineItemKindTitle, paidActionTitle } from '../utils/lineItemDetail';
import { selectedCategoryValue } from '../utils/categories';
import { useIsMobile } from '../hooks/useMediaQuery';

function badgeVariant(text) {
  const folded = String(text || '').toLowerCase();
  if (folded.includes('paga') || folded.includes('recebido') || folded.includes('liquidado')) return 'success';
  if (folded.includes('pendente') || folded.includes('aberto') || folded.includes('agendado')) return 'warning';
  if (folded.includes('projetada')) return 'info';
  return 'neutral';
}

export function ItemDetailSheet({
  item,
  busy = false,
  editor = null,
  categoryOptions = [],
  onClose,
  onTogglePaid,
  onEdit,
  onDelete,
  onCreateReceivable,
  onChangeCategory,
}) {
  const isMobile = useIsMobile();
  if (!item && !editor) return null;

  const handleOverlay = (event) => {
    if (event.target === event.currentTarget) onClose?.();
  };

  const confirmDelete = () => {
    if (!item) return;
    if (window.confirm(`Excluir “${item.title}”?`)) onDelete?.();
  };

  return (
    <div className="modal-overlay item-sheet-overlay" onClick={handleOverlay} role="presentation">
      <div
        className={`modal-content item-sheet ${isMobile ? 'item-sheet--bottom' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="item-sheet__handle" aria-hidden />
        <button type="button" className="item-sheet__close" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
        {editor || (
          <>
            <p className="item-sheet__kind">{lineItemKindTitle(item.kind)}</p>
            <h2 id="item-sheet-title" className="item-sheet__title">{item.title}</h2>
            <p
              className="item-sheet__amount"
              style={{ color: item.isCredit ? 'var(--success)' : 'var(--danger)' }}
            >
              {item.isCredit ? '+' : '-'} {item.amountLabel}
            </p>
            {item.statusLabel && (
              <p className="item-sheet__status">{item.statusLabel}</p>
            )}
            {item.badges?.length > 0 && (
              <div className="item-sheet__badges">
                {item.badges.map((badge) => (
                  <Badge key={badge} variant={badgeVariant(badge)}>{badge}</Badge>
                ))}
              </div>
            )}
            <dl className="item-sheet__meta">
              {(item.metadata || []).map((row) => (
                <div key={`${row.label}-${row.value}`} className="item-sheet__meta-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            {item.capabilities?.changeCategory && onChangeCategory && categoryOptions.length > 0 && (
              <label className="item-sheet__category">
                <span>Categoria</span>
                <select
                  value={selectedCategoryValue(item, categoryOptions)}
                  disabled={busy}
                  onChange={(event) => {
                    const value = event.target.value;
                    const option = categoryOptions.find((opt) => opt.value === value);
                    if (option) onChangeCategory(option);
                  }}
                >
                  {!categoryOptions.some((opt) => opt.value === selectedCategoryValue(item, categoryOptions)) && (
                    <option value={selectedCategoryValue(item, categoryOptions)}>
                      {item.metadata?.find((row) => row.label === 'Categoria')?.value || 'Selecionar'}
                    </option>
                  )}
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="item-sheet__actions">
              {item.capabilities?.togglePaid && onTogglePaid && (!item.isPaid || item.kind === 'manualExpense') && (
                <Button
                  variant="primary"
                  onClick={onTogglePaid}
                  loading={busy}
                  disabled={item.kind === 'receivable' && item.isPaid}
                >
                  {paidActionTitle(item)}
                </Button>
              )}
              {item.capabilities?.createReceivable && onCreateReceivable && (
                <Button variant="secondary" onClick={onCreateReceivable} disabled={busy}>
                  Criar valor a receber
                </Button>
              )}
              {item.capabilities?.edit && onEdit && (
                <Button variant="outline" onClick={onEdit} disabled={busy}>Editar</Button>
              )}
              {item.capabilities?.delete && onDelete && (
                <Button variant="danger" onClick={confirmDelete} disabled={busy}>Excluir</Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
