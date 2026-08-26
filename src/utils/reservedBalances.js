/**
 * Open Finance "caixinhas" / reserved balances (e.g. Mercado Pago).
 * Pluggy returns them on BANK accounts as bankData.reservedBalances.
 * They are treated as investment positions in the portfolio.
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

function institutionLabel(account) {
  return (
    account?.bankData?.institutionName ||
    account?.marketingName ||
    account?.name ||
    'Mercado Pago'
  );
}

function rateFromRemuneration(remuneration) {
  if (!remuneration || typeof remuneration !== 'object') return null;
  const pct = Number(remuneration.postFixedIndexerPercentage);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  // Pluggy sends 1.2 for 120% CDI
  return Math.round(pct * 10000) / 100;
}

/**
 * Map account reservedBalances into Pluggy-like investment positions
 * so they appear in the Investments portfolio and totals.
 *
 * @param {object[]} [accounts]
 * @returns {object[]}
 */
export function reservedBalancesAsInvestments(accounts = []) {
  const out = [];
  for (const account of accounts || []) {
    if (account?.type !== 'BANK') continue;
    const boxes = getReservedBalances(account);
    if (!boxes.length) continue;

    const issuer = institutionLabel(account);
    const owner = account.ownerLabel || account.owner || null;
    const accountName = account.name || account.marketingName || issuer;

    for (const box of boxes) {
      const rate = rateFromRemuneration(box.remuneration);
      const rateType = box.remuneration?.indexer || 'CDI';
      out.push({
        id: `caixinha-${account.id}-${box.identification}`,
        name: box.name,
        code: box.identification,
        type: 'FIXED_INCOME',
        subtype: 'CAIXINHA',
        balance: box.amount,
        amount: box.amount,
        quantity: 1,
        value: box.amount,
        currencyCode: box.currencyCode || 'BRL',
        status: 'ACTIVE',
        issuer,
        institution: issuer,
        rate: rate ?? undefined,
        rateType: rate != null ? rateType : undefined,
        sourceAccountId: account.id,
        sourceAccountName: accountName,
        owner,
        isReservedBalance: true,
        updatedAt: account.updatedAt || null,
      });
    }
  }
  return out;
}

/**
 * Merge Pluggy investments with caixinhas derived from bank accounts.
 * Dedupes by id (caixinha ids never collide with Pluggy UUIDs).
 */
export function mergeInvestmentsWithReserved(investments = [], accounts = []) {
  const fromPluggy = Array.isArray(investments) ? investments.filter((i) => !i?.isReservedBalance) : [];
  const fromCaixinhas = reservedBalancesAsInvestments(accounts);
  const seen = new Set(fromPluggy.map((i) => String(i?.id || '')));
  const extra = fromCaixinhas.filter((i) => !seen.has(String(i.id)));
  return [...fromPluggy, ...extra];
}
