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
 * @property {boolean} [liftOfficialToCycleCharges]
 *   When true, an official Pluggy `totalAmount` that is short of the due-month
 *   cycle charges is lifted to the cycle sum (Amazon/Bradescard closed bills).
 * @property {boolean} [slideProjectionToOpen]
 *   When true and the open cycle has no official bill, slide stale installment
 *   series so N+1 lands on the open month (`projectionAnchorDue`). Bradesco
 *   only — Nubank is missing the official every cycle until close, and sliding
 *   dumps already-billed last parcels onto the open bill.
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
      // Card product names are often just "PLATINUM"; prefer custom/original name,
      // COMPE 077 in transferNumber, or "Inter" in connector/marketing labels.
      const transfer = account?.bankData?.transferNumber || '';
      const blob = [
        connectorName,
        account?.name,
        account?.originalName,
        account?.marketingName,
        transfer,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return /\binter\b|banco\s*inter|(^|\/)077\//.test(blob);
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
    // billForecastDate on POSTED rows is often due−1, but future PENDING
    // installments already use fc = due month. Offset 0 is correct for unbound
    // rows; posted rows resolve via billId. Series anchoring covers the rest.
    forecastToDueOffset: 0,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
    chargeSumMode: 'signed_net',
    remapStalePending: 'after_cycle_end',
    // payments[] on bill N is the payment of bill N−1 — never treat paid>=total as settled
    paymentOftenOnNextCycle: false,
    guidePath: 'docs/connectors/itau.md',
  },
  {
    id: 'bradesco',
    label: 'Bradesco / Amazon (Bradescard)',
    match: ({ account, connectorName }) => {
      const blob = [
        connectorName,
        account?.name,
        account?.originalName,
        account?.marketingName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return /amazon|bradescard|\bbradesco\b/.test(blob);
    },
    // Close ~day 21 of month M, due day 5 of M+1. Infer from billId pairs / close vs due.
    forecastToDueOffset: null,
    balanceMeaning: 'total_outstanding',
    openTotalSource: 'cycle_charges',
    chargeSumMode: 'signed_net',
    // Closed official `totalAmount` can stay short of the PDF (Lucas Amazon Sep/2026:
    // Pluggy 1532.54 vs fatura 1602.24) while the cycle txs already have the rest.
    liftOfficialToCycleCharges: true,
    slideProjectionToOpen: true,
    remapStalePending: 'after_cycle_end',
    paymentOftenOnNextCycle: true,
    guidePath: 'docs/connectors/bradesco.md',
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
