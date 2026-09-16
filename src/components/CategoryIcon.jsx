import React from 'react';
import {
  UtensilsCrossed,
  ShoppingCart,
  Home,
  Zap,
  Car,
  Ticket,
  HeartPulse,
  GraduationCap,
  CircleEllipsis,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import { getCategoryIconName, getCategoryTint } from '../utils/categories';

const ICONS = {
  utensils: UtensilsCrossed,
  'shopping-cart': ShoppingCart,
  home: Home,
  zap: Zap,
  car: Car,
  ticket: Ticket,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  'circle-ellipsis': CircleEllipsis,
};

function hexToRgba(hex, alpha = 0.14) {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return `rgba(100, 116, 139, ${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Leading circle icon for transaction / statement rows.
 * Prefer category icons; fall back to payment check, credit arrow, or receipt.
 */
export function CategoryIcon({
  category,
  categories = [],
  size = 36,
  iconSize,
  isCredit = false,
  isPayment = false,
  /** When no category: 'arrows' (default) or 'receipt' (credit statement). */
  emptyFallback = 'arrows',
  style,
}) {
  const glyph = Math.max(12, iconSize ?? Math.round(size * 0.45));
  let Icon;
  let color;
  let background;

  if (isPayment) {
    Icon = CheckCircle2;
    color = 'var(--success)';
    background = 'var(--success-bg)';
  } else if (category) {
    const tint = getCategoryTint(category, categories);
    Icon = ICONS[getCategoryIconName(category)] || CircleEllipsis;
    color = tint;
    background = hexToRgba(tint, 0.14);
  } else if (isCredit) {
    Icon = ArrowUpRight;
    color = 'var(--success)';
    background = 'var(--success-bg)';
  } else if (emptyFallback === 'receipt') {
    Icon = Receipt;
    color = 'var(--danger)';
    background = 'var(--danger-bg)';
  } else {
    Icon = ArrowDownRight;
    color = 'var(--danger)';
    background = 'var(--danger-bg)';
  }

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: background,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <Icon size={glyph} strokeWidth={2.25} />
    </div>
  );
}

/** Compact icon bubble for category lists (always uses category tint). */
export function CategoryMark({ categoryKey, color, size = 32, iconSize }) {
  const tint = color || getCategoryTint(categoryKey);
  const Icon = ICONS[getCategoryIconName(categoryKey)] || CircleEllipsis;
  const glyph = Math.max(12, iconSize ?? Math.round(size * 0.45));
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: hexToRgba(tint, 0.14),
        color: tint,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={glyph} strokeWidth={2.25} />
    </div>
  );
}
