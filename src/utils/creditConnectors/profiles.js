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

/**
 * @typedef {object} CreditConnectorProfile
 * @property {string} id
 * @property {string} label
 * @property {(ctx: { account?: object, connectorName?: string, connectorId?: number|string }) => boolean} [match]
 * @property {0|1|null} forecastToDueOffset  null = infer from data
 * @property {BalanceMeaning} balanceMeaning
 * @property {OpenTotalSource} openTotalSource
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
    paymentOftenOnNextCycle: true,
    guidePath: 'docs/connectors/nubank.md',
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
    // Payment tx often lands on next billId; payments[] usually empty
    paymentOftenOnNextCycle: true,
    guidePath: 'docs/connectors/inter.md',
  },
  {
    id: 'meupluggy',
    label: 'MeuPluggy (sandbox)',
    match: ({ connectorName, connectorId }) =>
      connectorId === 200 || /meupluggy/i.test(connectorName || ''),
    // Sandbox mixes bank-shaped fixtures; infer offset from data.
    forecastToDueOffset: null,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
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
