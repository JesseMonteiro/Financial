import React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { formatCurrency } from '../utils/formatters';
import { MEAL_KIND_LABELS } from '../utils/mealBenefits';

export function MealBenefitMomentCards({ items = [], isMobile = false }) {
  if (!items.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.75rem' : '1rem' }}>
      {items.map((item) => (
        <Card
          key={item.id}
          title={`${MEAL_KIND_LABELS[item.kind] || item.kind}${item.label && item.label !== MEAL_KIND_LABELS[item.kind] ? ` · ${item.label}` : ''}`}
          subtitle={isMobile ? undefined : `Crédito dia ${item.creditDay} · gasto no mês ${formatCurrency(item.monthSpent)}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                SALDO
              </span>
              <h2
                style={{
                  fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-2xl)',
                  fontWeight: 700,
                  margin: '0.25rem 0',
                  color: item.remaining >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                }}
              >
                {formatCurrency(item.remaining)}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                {item.ownerLabel && (
                  <Badge variant="neutral" style={{ fontSize: '9px' }}>{item.ownerLabel}</Badge>
                )}
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Crédito dia {item.creditDay}
                  {item.monthCredit > 0 ? ` · +${formatCurrency(item.monthCredit)} neste mês` : ' · crédito ainda não caiu'}
                  {' · '}gasto {formatCurrency(item.monthSpent)}
                </span>
              </div>
            </div>
            <UtensilsCrossed size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Link
              to="/meal-vouchers"
              style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--primary)' }}
            >
              Gerenciar VA/VR
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}
