/**
 * Open Finance "caixinhas" / reserved balances (e.g. Mercado Pago).
 * Pluggy returns them on BANK accounts as bankData.reservedBalances.
 */

function amountFromAvailable(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (typeof entry.amount === 'number') return entry.amount;
  return 0;
}

/**
 * @param {object} [account]
 * @returns {{ identification: string, name: string, amount: number, currencyCode: string, remuneration: object|null }[]}
 */
export function getReservedBalances(account) {
  const raw = account?.bankData?.reservedBalances;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .map((item, index) => {
      const amounts = Array.isArray(item?.availableAmounts) ? item.availableAmounts : [];
      const amount = amounts.reduce((sum, a) => sum + amountFromAvailable(a), 0);
      const currencyCode = amounts.find((a) => a?.currencyCode)?.currencyCode || 'BRL';
      const remuneration = amounts.find((a) => a?.remuneration)?.remuneration || null;
      const identification = String(item?.identification || `reserved-${index}`);
      const name = (item?.name && String(item.name).trim()) || 'Caixinha';
      return { identification, name, amount, currencyCode, remuneration };
    })
    .filter((item) => item.amount > 0);
}

/** Sum of reserved amounts on one account. */
export function sumReservedBalances(account) {
  return getReservedBalances(account).reduce((sum, item) => sum + (item.amount || 0), 0);
}

/** Available spendable balance (excludes caixinhas). */
export function accountAvailableBalance(account) {
  return Number(account?.balance) || 0;
}

/** Available + reserved (total held at the institution for this account). */
export function accountTotalBalance(account) {
  return accountAvailableBalance(account) + sumReservedBalances(account);
}

/** Sum reserved balances across BANK accounts. */
export function totalReservedBalances(accounts = []) {
  return (accounts || []).reduce((sum, acc) => {
    if (acc?.type !== 'BANK') return sum;
    return sum + sumReservedBalances(acc);
  }, 0);
}
