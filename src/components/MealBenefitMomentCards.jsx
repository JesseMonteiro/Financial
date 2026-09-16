import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, UtensilsCrossed } from 'lucide-react';
import { SegmentedControl } from './ui/SegmentedControl';
import { formatCurrency } from '../utils/formatters';
import { MEAL_KIND_LABELS } from '../utils/mealBenefits';

const ALL_OWNERS = '__all__';

function initialsFrom(name = '') {
  const ignored = new Set(['você', 'voce', 'usuário', 'usuario', 'user']);
  const trimmed = String(name || '').trim();
  if (!trimmed || ignored.has(trimmed.toLowerCase())) return '?';
  const parts = trimmed.split(/[\s-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]).join('');
  return (letters || trimmed.slice(0, 2)).toUpperCase();
}

function providerLabel(item) {
  const kindTitle = MEAL_KIND_LABELS[item.kind] || item.kind;
  const label = String(item.label || '').trim();
  if (!label || label === kindTitle) return null;
  return label;
}

function firstName(name = '') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
}

function OwnerBadge({ label }) {
  if (!label) return null;
  return (
    <span className="meal-benefit-card__owner" title={label}>
      <span className="meal-benefit-card__avatar" aria-hidden>
        {initialsFrom(label)}
      </span>
      <span className="meal-benefit-card__owner-name">{firstName(label)}</span>
    </span>
  );
}

function MealBenefitCard({ item, isMobile, showOwnerBadge }) {
  const kindTitle = MEAL_KIND_LABELS[item.kind] || item.kind;
  const provider = providerLabel(item);
  const remainingNegative = item.remaining < 0;

  return (
    <article className="meal-benefit-card surface">
      <div className="meal-benefit-card__header">
        <div className="meal-benefit-card__brand">
          <span
            className={`meal-benefit-card__icon meal-benefit-card__icon--${String(item.kind || 'VA').toLowerCase()}`}
            aria-hidden
          >
            <UtensilsCrossed size={16} strokeWidth={2.25} />
          </span>
          <div className="meal-benefit-card__titles">
            <h3 className="meal-benefit-card__title">{kindTitle}</h3>
            {provider && <p className="meal-benefit-card__provider">{provider}</p>}
          </div>
        </div>
        {showOwnerBadge && item.ownerLabel ? <OwnerBadge label={item.ownerLabel} /> : null}
      </div>

      <div className="meal-benefit-card__balance">
        <span className="meal-benefit-card__balance-label">SALDO DISPONÍVEL</span>
        <p
          className="meal-benefit-card__balance-value"
          style={{
            fontSize: isMobile ? 'var(--font-size-2xl)' : 'var(--font-size-3xl)',
            color: remainingNegative ? 'var(--danger)' : 'var(--text-primary)',
          }}
        >
          {formatCurrency(item.remaining)}
        </p>
        <p className="meal-benefit-card__meta">
          Crédito dia {item.creditDay}
          {' · '}
          gasto no mês {formatCurrency(item.monthSpent)}
        </p>
      </div>

      <Link to="/meal-vouchers" className="meal-benefit-card__action">
        Gerenciar VA/VR
        <ArrowRight size={14} strokeWidth={2.5} aria-hidden />
      </Link>
    </article>
  );
}

export function MealBenefitMomentCards({
  items = [],
  isMobile = false,
  joint = false,
  currentUserLabel = null,
}) {
  const owners = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = item.ownerUserId || item.ownerLabel;
      const label = item.ownerLabel || currentUserLabel;
      if (!key || !label) return;
      if (!map.has(key)) map.set(key, { id: key, label });
    });
    return Array.from(map.values());
  }, [items, currentUserLabel]);

  const showOwnerToggle = joint && owners.length > 1;
  const [ownerFilter, setOwnerFilter] = useState(ALL_OWNERS);

  useEffect(() => {
    if (!showOwnerToggle) {
      setOwnerFilter(ALL_OWNERS);
      return;
    }
    const valid = new Set([ALL_OWNERS, ...owners.map((o) => o.id)]);
    if (!valid.has(ownerFilter)) setOwnerFilter(ALL_OWNERS);
  }, [showOwnerToggle, owners, ownerFilter]);

  const visibleItems = useMemo(() => {
    if (!showOwnerToggle || ownerFilter === ALL_OWNERS) return items;
    return items.filter((item) => (item.ownerUserId || item.ownerLabel) === ownerFilter);
  }, [items, showOwnerToggle, ownerFilter]);

  const enrichedItems = useMemo(
    () =>
      visibleItems.map((item) => ({
        ...item,
        ownerLabel: item.ownerLabel || currentUserLabel || null,
      })),
    [visibleItems, currentUserLabel]
  );

  if (!items.length) return null;

  const toggleOptions = [
    ...owners.map((o) => ({ id: o.id, label: firstName(o.label) || o.label })),
    { id: ALL_OWNERS, label: 'Ambos' },
  ];

  const showOwnerBadge = joint || Boolean(currentUserLabel);

  return (
    <div className="meal-benefit-cards" style={{ gap: isMobile ? '0.75rem' : '1rem' }}>
      {showOwnerToggle && (
        <div className="meal-benefit-cards__toggle">
          <SegmentedControl
            layoutId="meal-benefit-owner"
            options={toggleOptions}
            value={ownerFilter}
            onChange={setOwnerFilter}
          />
        </div>
      )}
      {enrichedItems.map((item) => (
        <MealBenefitCard
          key={item.id}
          item={item}
          isMobile={isMobile}
          showOwnerBadge={showOwnerBadge}
        />
      ))}
    </div>
  );
}
