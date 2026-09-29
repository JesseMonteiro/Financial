/**
 * Cache freshness policy for MeuFlux (Web parity with ADR-012 / Nathan).
 *
 * Thresholds:
 * - < 15 min: "fresh" (verde / up to date)
 * - < 1 hour: "aging" (amarelo / usable, sync within the hour)
 * - >= 1 hour: "stale" (vermelho / cache expired, needs refresh)
 */

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const FRESH_MAX_AGE_MS = 15 * MINUTE_MS;
export const AGING_MAX_AGE_MS = 1 * HOUR_MS;

/**
 * @typedef {'never' | 'fresh' | 'aging' | 'stale'} FreshnessLevel
 *
 * @typedef {Object} FreshnessInfo
 * @property {FreshnessLevel} level
 * @property {number | null} ageMs
 * @property {string} label
 * @property {string} dotColor
 */

/**
 * Converts a date input to timestamp in milliseconds
 * @param {string | number | Date | null | undefined} value
 * @returns {number | null}
 */
export function toTimestamp(value) {
  if (value == null) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Classifies data freshness based on last successful sync date
 * @param {string | number | Date | null | undefined} lastSync
 * @param {number} [now=Date.now()]
 * @returns {FreshnessInfo}
 */
export function cacheFreshness(lastSync, now = Date.now()) {
  const ts = toTimestamp(lastSync);
  if (ts == null) {
    return {
      level: 'never',
      ageMs: null,
      label: 'nunca sincronizado',
      dotColor: 'var(--text-muted, #94a3b8)',
    };
  }

  const ageMs = Math.max(0, now - ts);

  if (ageMs < FRESH_MAX_AGE_MS) {
    return {
      level: 'fresh',
      ageMs,
      label: 'atualizado',
      dotColor: 'var(--success, #10b981)',
    };
  }

  if (ageMs < AGING_MAX_AGE_MS) {
    return {
      level: 'aging',
      ageMs,
      label: 'sincronizado há pouco',
      dotColor: 'var(--warning, #f59e0b)',
    };
  }

  return {
    level: 'stale',
    ageMs,
    label: 'dados podem estar desatualizados',
    dotColor: 'var(--danger, #ef4444)',
  };
}

/**
 * Returns human-readable relative time description in pt-BR
 * @param {string | number | Date | null | undefined} lastSync
 * @param {number} [now=Date.now()]
 * @returns {string}
 */
export function freshnessRelativeLabel(lastSync, now = Date.now()) {
  const ts = toTimestamp(lastSync);
  if (ts == null) return 'nunca sincronizado';

  const ageMs = Math.max(0, now - ts);
  if (ageMs < MINUTE_MS) return 'agora mesmo';

  const minutes = Math.floor(ageMs / MINUTE_MS);
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(ageMs / HOUR_MS);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(ageMs / DAY_MS);
  return `há ${days}d`;
}
