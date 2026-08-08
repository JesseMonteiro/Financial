import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatCurrency(value, currency = 'BRL') {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(value);
}

export function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '0,00%';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(decimals).replace('.', ',')}%`;
}

export function formatDate(dateString, pattern = 'dd/MM/yyyy') {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '-';
    return format(date, pattern, { locale: ptBR });
  } catch (e) {
    return dateString;
  }
}

export function formatDateRelative(dateString) {
  if (!dateString) return '-';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    if (!isValid(date)) return '-';
    return format(date, "d 'de' MMMM", { locale: ptBR });
  } catch (e) {
    return dateString;
  }
}

/**
 * Pluggy account/item sync age for UI tags.
 * warning ≥ 2 days, danger ≥ 7 days (stale Open Finance sync).
 */
export function getDataSyncMeta(updatedAt, { now = new Date() } = {}) {
  if (!updatedAt) return null;
  try {
    const date = typeof updatedAt === 'string' ? parseISO(updatedAt) : updatedAt;
    if (!isValid(date)) return null;
    const days = differenceInCalendarDays(now, date);
    let variant = 'neutral';
    if (days >= 7) variant = 'danger';
    else if (days >= 2) variant = 'warning';

    let label;
    if (days <= 0) label = 'Atualizado hoje';
    else if (days === 1) label = 'Atualizado ontem';
    else label = `Atualizado ${format(date, 'dd/MM/yyyy', { locale: ptBR })}`;

    return {
      variant,
      label,
      days,
      title: `Dados sincronizados em ${format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    };
  } catch {
    return null;
  }
}
