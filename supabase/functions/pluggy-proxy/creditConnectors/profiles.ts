/**
 * Per-connector coding profiles for Pluggy credit-card data.
 *
 * Guides (human docs): docs/connectors/
 * This module is the machine-readable counterpart used by creditBillPeriod.
 *
 * Match order: first profile whose `match` returns true wins.
 * Fall back to `defaultProfile` when nothing matches.
 */

/** @typedef {'cycle_charges' | 'balance'} OpenTotalSource */
/** @typedef {'total_outstanding' | 'open_bill' | 'unknown'} BalanceMeaning */
/** @typedef {'signed_net' | 'absolute'} ChargeSumMode */
/** @typedef {'after_cycle_end' | 'always' | 'never'} RemapStalePendingMode */

/**
 * @typedef {object} CreditConnectorProfile
 * @property {string} id
 * @property {string} label
 * @property {(ctx: { account?: object, connectorName?: string, connectorId?: number|string }) => boolean} [match]
 * @property {0|1|null} forecastToDueOffset  null = infer from data
 * @property {BalanceMeaning} balanceMeaning
 * @property {OpenTotalSource} openTotalSource
 * @property {ChargeSumMode} chargeSumMode
 *   signed_net = Σ amount then |net| (Pluggy: DEBIT>0, CREDIT<0). Needed when
 *   Nubank posts cancelling pairs (Saldo em atraso + Crédito de atraso).
 *   absolute = Σ |amount| (legacy; inflates bills that include credits).
 * @property {boolean} [reconcileOpenWithBalance]
 *   When true (or balance looks like total outstanding), open total may be
 *   raised to outstanding − future PENDING − past unpaid PENDING if Pluggy
 *   omitted charges that still affect balance (Mercado Pago additional cards).
 * @property {RemapStalePendingMode} remapStalePending
 *   after_cycle_end = only remap PENDING without billId when purchase date is
 *   after last official close (Carrefour-safe). always = old Nubank-only remap.
 * @property {boolean} paymentOftenOnNextCycle
 * @property {string} guidePath
 */

/** @type {CreditConnectorProfile} */
export const defaultProfile = {
  id: 'default',
  label: 'Default (BR retail)',
  forecastToDueOffset: null,
  balanceMeaning: 'unknown',
  // Prefer cycle charges: safer when Pluggy balance = total outstanding
  openTotalSource: 'cycle_charges',
  chargeSumMode: 'signed_net',
  remapStalePending: 'after_cycle_end',
  paymentOftenOnNextCycle: true,
  guidePath: 'docs/connectors/README.md',
};

/** @type {CreditConnectorProfile[]} */
export const CONNECTOR_PROFILES = [
  {
    id: 'nubank',
    label: 'Nubank',
    match: ({ account, connectorName }) => {
      const blob = `${connectorName || ''} ${account?.name || ''} ${account?.marketingName || ''}`.toLowerCase();
      return /nubank|nu pagamentos|roxinho/.test(blob);
    },
    forecastToDueOffset: 0,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
    // Late-payment accounting entries cancel as CREDIT+DEBIT pairs
    chargeSumMode: 'signed_net',
    remapStalePending: 'after_cycle_end',
    paymentOftenOnNextCycle: true,
    guidePath: 'docs/connectors/nubank.md',
  },
  {
    id: 'carrefour',
    label: 'Carrefour',
    match: ({ account, connectorName }) => {
      const blob = `${connectorName || ''} ${account?.name || ''} ${account?.marketingName || ''}`.toLowerCase();
      return /carrefour|cartão carrefour|cartao carrefour|\bcrf\b/.test(blob);
    },
    forecastToDueOffset: null,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
    chargeSumMode: 'signed_net',
    // Connector leaves paid purchases as PENDING forever — never dump history into open
    remapStalePending: 'after_cycle_end',
    paymentOftenOnNextCycle: true,
    guidePath: 'docs/connectors/README.md',
  },
  {
    id: 'mercado-pago',
    label: 'Mercado Pago',
    match: ({ account, connectorName }) => {
      const blob = `${connectorName || ''} ${account?.name || ''}`.toLowerCase();
      return /mercado\s*pago|mercadopago/.test(blob);
    },
    forecastToDueOffset: 0,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
    // Pluggy often omits additional-card charges from /transactions while still
    // counting them in account.balance — reconcile open total against outstanding.
    reconcileOpenWithBalance: true,
    chargeSumMode: 'signed_net',
    remapStalePending: 'after_cycle_end',
    paymentOftenOnNextCycle: true,
    guidePath: 'docs/connectors/mercado-pago.md',
  },
  {
    id: 'santander',
    label: 'Santander',
    match: ({ account, connectorName }) => {
      const blob = `${connectorName || ''} ${account?.name || ''}`.toLowerCase();
      return /santander/.test(blob);
    },
    forecastToDueOffset: 1,
    balanceMeaning: 'unknown',
    openTotalSource: 'cycle_charges',
    chargeSumMode: 'signed_net',
    remapStalePending: 'after_cycle_end',
    paymentOftenOnNextCycle: false,
    guidePath: 'docs/connectors/santander.md',
  },
  {
    id: 'inter',
    label: 'Banco Inter',
    match: ({ account, connectorName }) => {
      const blob = `${connectorName || ''} ${account?.name || ''} ${account?.marketingName || ''}`.toLowerCase();
      return /\binter\b|banco\s*inter/.test(blob);
    },
    forecastToDueOffset: 0,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
    chargeSumMode: 'signed_net',
    remapStalePending: 'after_cycle_end',
    // Payment tx often lands on next billId; payments[] usually empty
    paymentOftenOnNextCycle: true,
    guidePath: 'docs/connectors/inter.md',
  },
  {
    id: 'itau',
    label: 'Itaú',
    match: ({ account, connectorName }) => {
      const blob = `${connectorName || ''} ${account?.name || ''} ${account?.marketingName || ''}`.toLowerCase();
      return /ita[uú]|itau\b/.test(blob);
    },
    // billForecastDate is typically due month − 1
    forecastToDueOffset: 1,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
    chargeSumMode: 'signed_net',
    remapStalePending: 'after_cycle_end',
    // payments[] on bill N is the payment of bill N−1 — never treat paid>=total as settled
    paymentOftenOnNextCycle: false,
    guidePath: 'docs/connectors/itau.md',
  },
  {
    id: 'meupluggy',
    label: 'MeuPluggy (sandbox)',
    match: ({ connectorName, connectorId }) =>
      connectorId === 200 || /meupluggy/i.test(connectorName || ''),
    // Sandbox mixes bank-shaped fixtures (Nubank platinum, Santander, …); infer offset from data.
    forecastToDueOffset: null,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
    // Nubank-shaped platinum fixture includes cancelling late-payment CREDITS
    chargeSumMode: 'signed_net',
    remapStalePending: 'after_cycle_end',
    paymentOftenOnNextCycle: true,
    guidePath: 'docs/connectors/meupluggy.md',
  },
];

/**
 * Resolve coding profile for a credit account.
 * @param {{ account?: object, connectorName?: string, connectorId?: number|string }} ctx
 * @returns {CreditConnectorProfile}
 */
export function resolveConnectorProfile(ctx = {}) {
  for (const p of CONNECTOR_PROFILES) {
    if (p.match?.(ctx)) return p;
  }
  return defaultProfile;
}

/**
 * Detect whether account.balance looks like total outstanding
 * (limit − available) rather than the current open bill.
 */
export function balanceLooksLikeTotalOutstanding(account) {
  if (!account || account.balance == null) return false;
  const limit = account.creditData?.creditLimit;
  const available = account.creditData?.availableCreditLimit;
  if (limit == null || available == null) return false;
  const used = Number(limit) - Number(available);
  return Math.abs(used - Math.abs(Number(account.balance))) < 0.05;
}
