/**
 * Monthly salary helpers for Momento Financeiro.
 * Salaries are keyed by YYYY-MM; `_default` is the last value the user saved
 * and is used when a month has no explicit entry.
 */

export const SALARY_DEFAULT_FALLBACK = 5000;

/**
 * @param {Record<string, number>} salaries
 * @param {string} ym YYYY-MM
 * @param {number} [fallback]
 */
export function resolveMonthSalary(salaries = {}, ym, fallback = SALARY_DEFAULT_FALLBACK) {
  if (!ym) return fallback;
  if (salaries[ym] !== undefined && salaries[ym] !== null && salaries[ym] !== '') {
    return Number(salaries[ym]) || 0;
  }
  if (salaries._default !== undefined && salaries._default !== null && salaries._default !== '') {
    return Number(salaries._default) || 0;
  }
  // Inherit from the nearest previous month that was explicitly set
  const prior = Object.keys(salaries)
    .filter((k) => /^\d{4}-\d{2}$/.test(k) && k < ym)
    .sort();
  if (prior.length) return Number(salaries[prior.at(-1)]) || 0;
  return fallback;
}

/**
 * Persist a salary for a month and refresh `_default` for future months.
 * @param {Record<string, number>} salaries
 * @param {string} ym
 * @param {number} amount
 */
export function withSavedMonthSalary(salaries = {}, ym, amount) {
  const num = Number(amount) || 0;
  return {
    ...salaries,
    [ym]: num,
    _default: num,
  };
}
