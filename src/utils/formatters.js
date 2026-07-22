import { format, parseISO, isValid } from 'date-fns';
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
