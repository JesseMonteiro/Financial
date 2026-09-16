import React from 'react';
import {
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  Coffee,
  Wine,
  Home,
  Building2,
  Armchair,
  Zap,
  Droplets,
  Flame,
  Wifi,
  Phone,
  Car,
  Bus,
  TrainFront,
  Fuel,
  Bike,
  Plane,
  BedDouble,
  Ticket,
  Clapperboard,
  Gamepad2,
  Music,
  Tv,
  PartyPopper,
  Heart,
  Cross,
  Pill,
  PersonStanding,
  GraduationCap,
  BookOpen,
  Pencil,
  Briefcase,
  CreditCard,
  Banknote,
  TrendingUp,
  Percent,
  Gift,
  PawPrint,
  Shirt,
  Scissors,
  Wrench,
  Hammer,
  Leaf,
  Users,
  Baby,
  HandHelping,
  Shield,
  FileText,
  Mail,
  Store,
  Tag,
  Star,
  Sparkles,
  CircleEllipsis,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import { getCategoryIconId, getCategoryTint } from '../utils/categories';

export const CATEGORY_LUCIDE_ICONS = {
  utensils: UtensilsCrossed,
  cart: ShoppingCart,
  bag: ShoppingBag,
  cup: Coffee,
  takeout: ShoppingBag,
  wineglass: Wine,
  home: Home,
  building: Building2,
  sofa: Armchair,
  bolt: Zap,
  drop: Droplets,
  flame: Flame,
  wifi: Wifi,
  phone: Phone,
  car: Car,
  bus: Bus,
  tram: TrainFront,
  fuelpump: Fuel,
  bicycle: Bike,
  airplane: Plane,
  bed: BedDouble,
  ticket: Ticket,
  film: Clapperboard,
  gamecontroller: Gamepad2,
  music: Music,
  tv: Tv,
  party: PartyPopper,
  heart: Heart,
  crosscase: Cross,
  pills: Pill,
  figure: PersonStanding,
  graduationcap: GraduationCap,
  book: BookOpen,
  pencil: Pencil,
  briefcase: Briefcase,
  creditcard: CreditCard,
  banknote: Banknote,
  chart: TrendingUp,
  percent: Percent,
  gift: Gift,
  pawprint: PawPrint,
  tshirt: Shirt,
  scissors: Scissors,
  wrench: Wrench,
  hammer: Hammer,
  leaf: Leaf,
  baby: Users,
  stroller: Baby,
  handraised: HandHelping,
  shield: Shield,
  doc: FileText,
  envelope: Mail,
  cartbadge: ShoppingCart,
  storefront: Store,
  tag: Tag,
  star: Star,
  sparkles: Sparkles,
  ellipsis: CircleEllipsis,
};

function hexToRgba(hex, alpha = 0.14) {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return `rgba(100, 116, 139, ${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function resolveLucideIcon(iconId) {
  return CATEGORY_LUCIDE_ICONS[iconId] || CircleEllipsis;
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
    Icon = resolveLucideIcon(getCategoryIconId(category, categories));
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
export function CategoryMark({ categoryKey, color, icon, categories = [], size = 32, iconSize }) {
  const tint = color || getCategoryTint(categoryKey, categories);
  const iconId = icon || getCategoryIconId(categoryKey, categories);
  const Icon = resolveLucideIcon(iconId);
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
