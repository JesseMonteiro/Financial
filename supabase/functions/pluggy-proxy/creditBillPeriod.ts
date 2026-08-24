/**
 * Canonical credit-card bill period helpers.
 *
 * Pluggy semantics differ by bank — see docs/connectors/ and
 * src/utils/creditConnectors/profiles.js.
 *
 * We always index UI buckets by **due month** (YYYY-MM of bill.dueDate).
 */

import {
  resolveConnectorProfile,
  balanceLooksLikeTotalOutstanding,
} from './creditConnectors/profiles.ts';

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** @param {string} ym YYYY-MM @param {number} n months to add (can be negative) */
export function ymAdd(ym, n) {
  if (!ym || ym === 'Outros') return ym;
  let [y, m] = ym.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function ymFromIso(iso) {
  if (!iso) return null;
  return String(iso).slice(0, 7);
}

/**
 * Shift an ISO date by whole months (UTC calendar), clamping the day.
 * Used to recover purchase date from installment N when Pluggy omits purchaseDate.
 */
export function shiftIsoMonths(iso, deltaMonths) {
  if (!iso || !deltaMonths) return iso || null;
  const s = String(iso);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10)) || 1;
  if (!y || !m) return iso;
  let nm = m + Number(deltaMonths);
  let ny = y;
  while (nm > 12) { nm -= 12; ny += 1; }
  while (nm < 1) { nm += 12; ny -= 1; }
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const day = Math.min(d, dim);
  const time = s.length > 10 && s[10] === 'T' ? s.slice(10) : 'T12:00:00.000Z';
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}${time}`;
}

/**
 * Best-effort purchase date for sorting/display.
 * Inter PENDING installments use `date` as the parcel's scheduled charge date;
 * `purchaseDate` is often null — walk back (N-1) months from parcel date.
 */
export function resolvePurchaseDate(tx) {
  const meta = tx?.creditCardMetadata || {};
  if (meta.purchaseDate) return meta.purchaseDate;
  const num = installmentNumberOf(tx);
  const total = installmentTotalOf(tx);
  if (tx?.date && Number(total) > 1 && Number(num) > 1) {
    return shiftIsoMonths(tx.date, -(Number(num) - 1));
  }
  return tx?.date || null;
}

export function formatDueMonthTitle(dueYm) {
  if (!dueYm || dueYm === 'Outros') return 'Outros Lançamentos';
  const [y, m] = dueYm.split('-').map(Number);
  return `Fatura ${MONTHS_PT[m - 1]} de ${y}`;
}

/** @param {string} dueYm @param {string} [dueDateIso] real due date when known */
export function formatDueMonthShort(dueYm, dueDateIso) {
  if (dueDateIso && String(dueDateIso).length >= 10) {
    const [y, m, d] = String(dueDateIso).slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  if (!dueYm || dueYm === 'Outros') return '';
  const [y, m] = dueYm.split('-');
  return `10/${m}/${y}`;
}

export function isBillPayment(tx) {
  const d = (tx?.description || '').toUpperCase().replace(/\s+/g, ' ').trim();
  // Nubank: "Pagamento recebido" / "Pagamento de fatura"
  // Inter (OF): "PAGAMENTO ON LINE" / "PAGAMENTO ONLINE" / "PAGTO DEBITO AUTOMATICO"
  //   (auto-debit often stays PENDING next to a POSTED "Pagamento recebido" twin)
  // Itaú: "Pagamento PIX" / "PAGAMENTO COM SALDO"
  // Generic: PAGTO FATURA, PAGAMENTO FATURA
  return (
    d.includes('PAGAMENTO DE FATURA') ||
    d.includes('PAGAMENTO RECEBIDO') ||
    d.includes('PAGAMENTO ON LINE') ||
    d.includes('PAGAMENTO ONLINE') ||
    d.includes('PAGAMENTO COM SALDO') ||
    d.includes('PAGAMENTO PIX') ||
    d.includes('PAGTO FATURA') ||
    d.includes('PAGAMENTO FATURA') ||
    d.includes('PAGTO DEBITO AUTOMATICO') ||
    d.includes('PAGTO DÉBITO AUTOMATICO') ||
    d.includes('DEBITO AUTOMATICO FATURA') ||
    d.includes('DÉBITO AUTOMÁTICO FATURA') ||
    /^PAGAMENTO\b/.test(d)
  );
}

function billMapFromList(officialBills = []) {
  const map = {};
  for (const b of officialBills) {
    if (b?.id) map[b.id] = b;
  }
  return map;
}

/** Infer due YYYY-MM-DD for a due-month from the latest official bill's day. */
export function inferDueDateForMonth(dueYm, officialBills = []) {
  if (!dueYm || dueYm === 'Outros') return null;
  const sorted = officialBills
    .filter((b) => b?.dueDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const day = sorted.length
    ? String(sorted.at(-1).dueDate).slice(8, 10)
    : '10';
  return `${dueYm}-${day}`;
}

/**
 * Amount that hits the credit bill in the account currency (BRL).
 * Foreign purchases often have `amount` in USD and the BRL charge in
 * `amountInAccountCurrency` (e.g. CURSOR US$ 20 → R$ 107,02).
 */
export function txBillingAmount(tx) {
  const accountAmt = tx?.amountInAccountCurrency;
  if (accountAmt != null && Number.isFinite(Number(accountAmt))) {
    return Number(accountAmt);
  }
  return Number(tx?.amount) || 0;
}

/**
 * Fingerprint for an installment series (dedupe real vs projected).
 * Amount is rounded to R$ 0.10 so Pluggy cent-drift (18,32 vs 18,33 across
 * parcels of the same purchase) still matches, while distinct purchases
 * (R$ 5,70 vs R$ 40,56) stay separate.
 * accountId is included so consolidated multi-card views do not merge series.
 */
export function installmentSeriesKey(tx) {
  const meta = tx?.creditCardMetadata || {};
  const acct = tx?.accountId || '';
  if (meta.purchaseId) return `${acct}|pid:${meta.purchaseId}`;
  const total = meta.totalInstallments || tx?.totalInstallmentsCount;
  if (!total) return null;
  // Tenths of a real — absorbs ±R$ 0.05 drift without merging unrelated amounts
  const amt = Math.round(Math.abs(txBillingAmount(tx)) * 10);
  return `${acct}|${normalizeInstallmentDesc(tx.description)}|${total}|${amt}`;
}

export function normalizeInstallmentDesc(description) {
  return String(description || '')
    .replace(/\s*\(?\s*Parcela\s+\d+\s*\/\s*\d+\s*\)?\s*$/i, '')
    .replace(/\s*\d+\s*\/\s*\d+\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function installmentNumberOf(tx) {
  return (
    tx?.creditCardMetadata?.installmentNumber ||
    tx?.currentInstallment ||
    null
  );
}

export function installmentTotalOf(tx) {
  return (
    tx?.creditCardMetadata?.totalInstallments ||
    tx?.totalInstallmentsCount ||
    null
  );
}

/**
 * Due month for an installment using a sibling that already has an official billId.
 *
 * Needed when Pluggy sends future PENDING parcels without billId and with a
 * billForecastDate that does not share the same forecast→due offset as posted
 * rows (Itaú: posted often fc = due−1, future PENDING fc = due month).
 * Anchoring to the last posted parcel keeps 01/06→02/06 on consecutive bills.
 *
 * @returns {string|null} YYYY-MM or null when no official anchor exists
 */
export function dueMonthFromInstallmentSeries(tx, transactions = [], billMap = {}) {
  const n = Number(installmentNumberOf(tx));
  const total = Number(installmentTotalOf(tx));
  if (!n || !total || n < 1) return null;

  const ownId = tx?.creditCardMetadata?.billId || tx?.billId;
  if (ownId && billMap[ownId]?.dueDate) return null;

  const key = installmentSeriesKey(tx);
  if (!key) return null;

  let best = null;
  for (const other of transactions) {
    if (!other || other === tx) continue;
    if (other.isProjected || isBillPayment(other)) continue;
    if (installmentSeriesKey(other) !== key) continue;
    const on = Number(installmentNumberOf(other));
    if (!on) continue;
    const oid = other.creditCardMetadata?.billId || other.billId;
    if (!oid || !billMap[oid]?.dueDate) continue;
    const otherDue = ymFromIso(billMap[oid].dueDate);
    if (!otherDue || otherDue === 'Outros') continue;
    const placed = ymAdd(otherDue, n - on);
    if (!placed || placed === 'Outros') continue;
    const distance = Math.abs(n - on);
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && on > best.on)
    ) {
      best = { due: placed, distance, on };
    }
  }
  return best?.due || null;
}

/** True if a real (or projected) tx already represents series installment n. */
export function hasInstallmentNumber(transactions, seriesKey, n) {
  for (const t of transactions) {
    if (isBillPayment(t)) continue;
    if (installmentSeriesKey(t) !== seriesKey) continue;
    if (installmentNumberOf(t) === n) return true;
  }
  return false;
}

/**
 * Mercado Pago (and similar) truncates later-parcel descriptions
 * (`MERCADOLIVRE*MERCADOLIVRE` → `MERCADOLIVRE*MERC`), splitting series keys.
 * Treat same account + totalInstallments + N + amount±R$0,50 as already present.
 */
export function hasSimilarInstallment(transactions, sample, n) {
  const total = Number(installmentTotalOf(sample));
  if (!total || !n) return false;
  const sampleAmt = Math.abs(txBillingAmount(sample));
  const acct = sample?.accountId || '';
  const sampleDesc = normalizeInstallmentDesc(sample?.description);
  for (const t of transactions) {
    if (isBillPayment(t)) continue;
    if (acct && t.accountId && t.accountId !== acct) continue;
    if (Number(installmentNumberOf(t)) !== Number(n)) continue;
    if (Number(installmentTotalOf(t)) !== total) continue;
    const amt = Math.abs(txBillingAmount(t));
    if (Math.abs(amt - sampleAmt) <= 0.5) return true;
    const desc = normalizeInstallmentDesc(t.description);
    const prefix = sampleDesc.slice(0, 14);
    if (prefix.length >= 8 && (desc.startsWith(prefix) || sampleDesc.startsWith(desc.slice(0, 14)))) {
      if (Math.abs(amt - sampleAmt) <= 1) return true;
    }
  }
  return false;
}

/**
 * Carrefour (and similar) often keep a PENDING row with the **full purchase**
 * amount tagged as installment N/M, alongside real rows with the **parcel** amount.
 * Those get different `installmentSeriesKey`s (amount is part of the key) and the
 * app would show/project both — e.g. R$ 209,96 and R$ 21,00 as "Parcela 4/10".
 *
 * True when another installment tx shares account + description + M and
 * `this.amount ≈ other.amount × M` (this is the purchase-total ghost).
 */
export function isInstallmentPurchaseTotalGhost(tx, transactions = []) {
  if (tx?.isProjected || isBillPayment(tx)) return false;
  const total = Number(installmentTotalOf(tx));
  if (!total || total < 2) return false;
  const amt = Math.abs(txBillingAmount(tx));
  if (amt <= 0) return false;
  const desc = normalizeInstallmentDesc(tx.description);
  if (!desc) return false;
  const acct = tx.accountId || '';
  const tol = Math.max(0.5, total * 0.05);

  for (const other of transactions) {
    if (!other || other === tx) continue;
    if (other.id && tx.id && other.id === tx.id) continue;
    if (other.isProjected || isBillPayment(other)) continue;
    if (acct && other.accountId && other.accountId !== acct) continue;
    if (Number(installmentTotalOf(other)) !== total) continue;
    if (normalizeInstallmentDesc(other.description) !== desc) continue;
    const otherAmt = Math.abs(txBillingAmount(other));
    if (otherAmt <= 0) continue;
    // this ≈ parcel × M  → this is the total ghost; other is the real parcel
    if (Math.abs(otherAmt * total - amt) <= tol) return true;
  }
  return false;
}

/**
 * Signed contribution of a credit-card tx toward a bill total.
 * Prefers Pluggy `type` so CREDIT always reduces the bill even if `amount` arrives positive.
 * Uses account-currency amount for foreign-currency purchases.
 */
export function signedTxAmount(tx) {
  const raw = txBillingAmount(tx);
  const abs = Math.abs(raw);
  if (tx?.type === 'CREDIT') return -abs;
  if (tx?.type === 'DEBIT') return abs;
  return raw;
}

export function sumCycleCharges(items = [], { includeProjected = false, chargeSumMode = 'signed_net' } = {}) {
  const filtered = items.filter(
    (t) => !isBillPayment(t) && (includeProjected || !t.isProjected)
  );
  if (chargeSumMode === 'absolute') {
    return Math.round(filtered.reduce((s, t) => s + Math.abs(txBillingAmount(t)), 0) * 100) / 100;
  }
  // Pluggy credit-card convention: purchases DEBIT, credits/refunds CREDIT.
  // Signed net lets cancelling pairs (e.g. Nubank Saldo em atraso + Crédito de atraso)
  // net to the real statement total instead of double-counting via Math.abs.
  const net = filtered.reduce((s, t) => s + signedTxAmount(t), 0);
  return Math.round(Math.abs(net) * 100) / 100;
}

/**
 * App-projected parcels already placed in a due-month bucket.
 * Official Pluggy `totalAmount` often omits them (Amazon/Bradesco open draft).
 */
export function sumProjectedCharges(items = [], { chargeSumMode = 'signed_net' } = {}) {
  return sumCycleCharges(
    items.filter((t) => t?.isProjected),
    { includeProjected: true, chargeSumMode }
  );
}

/**
 * Open-bill total for ONE due cycle.
 * Never use account.balance alone when it equals total outstanding (limit − available).
 * `cycleItems` are already scoped to this due month — include projected parcels
 * that belong in this bucket (they are not "future months"; those live in other buckets).
 *
 * When Pluggy omits some open-cycle charges that still sit in `account.balance`
 * (common on Mercado Pago with additional cards), reconcile:
 *   open ≈ outstanding − PENDING(due > open) − PENDING(due < open)
 */
export function resolveOpenBillTotal(account, cycleItems = [], profile, opts = {}) {
  const chargeSumMode = profile?.chargeSumMode || 'signed_net';
  const cycleSum = sumCycleCharges(cycleItems, {
    includeProjected: true,
    chargeSumMode,
  });

  const {
    transactions = [],
    openDueKey = null,
    officialBills = [],
    forecastToDueOffset = 0,
  } = opts;

  const outstandingAmt = Math.abs(Number(account?.balance) || 0);
  // Only when the connector profile opts in (Mercado Pago additional cards).
  // Do NOT do this for every total_outstanding balance — missing future
  // installments in PENDING would be mis-attributed to the open cycle (Amazon).
  if (
    profile?.reconcileOpenWithBalance &&
    openDueKey &&
    outstandingAmt > 0 &&
    transactions.length
  ) {
    const billMap = billMapFromList(officialBills);
    let futurePending = 0;
    let pastUnpaidPending = 0;
    for (const t of transactions) {
      if (t.isProjected || isBillPayment(t)) continue;
      if (t.status !== 'PENDING') continue;
      if (account?.id && t.accountId && t.accountId !== account.id) continue;
      const due = getDueMonthKey(t, billMap, forecastToDueOffset);
      if (!due || due === 'Outros') continue;
      const amt = Math.abs(txBillingAmount(t));
      if (due > openDueKey) futurePending += amt;
      else if (due < openDueKey) pastUnpaidPending += amt;
    }
    const impliedOpen = outstandingAmt - futurePending - pastUnpaidPending;
    if (impliedOpen > cycleSum + 0.05) {
      return Math.round(impliedOpen * 100) / 100;
    }
  }

  const preferCycle =
    (profile?.openTotalSource || 'cycle_charges') === 'cycle_charges' ||
    balanceLooksLikeTotalOutstanding(account) ||
    profile?.balanceMeaning === 'total_outstanding';

  if (preferCycle) return cycleSum;
  if (cycleSum > 0) return cycleSum;
  if (account?.balance != null && !balanceLooksLikeTotalOutstanding(account)) {
    return outstandingAmt;
  }
  return cycleSum;
}

/**
 * Pluggy often tags several future installments with the same billForecastDate.
 * Spread them across consecutive due months by installment number so the open
 * bill only keeps the next parcel of each series.
 *
 * Do NOT move charges that already have a resolvable official `billId` (Inter OF
 * returns future bills + PENDING parcels with billId). Also skip series that are
 * not actually stacked on the same due month — otherwise recurring same-merchant
 * installments (e.g. many "99PAY 2/2") collapse into one fake series and parcels
 * jump to the wrong fatura.
 */
export function redistributeStackedInstallments(map, officialBills = []) {
  const billMap = billMapFromList(officialBills);
  const series = new Map();
  for (const dueYm of Object.keys(map)) {
    if (dueYm === 'Outros') continue;
    for (const t of map[dueYm].items) {
      if (t.isProjected || isBillPayment(t)) continue;
      const num = installmentNumberOf(t);
      const key = installmentSeriesKey(t);
      if (!key || !num) continue;
      if (!series.has(key)) series.set(key, []);
      series.get(key).push({ t, dueYm, num });
    }
  }

  for (const [, entries] of series) {
    if (entries.length < 2) continue;

    // Already placed by official billId — trust Pluggy, do not reshuffle
    const movable = entries.filter((entry) => {
      const billId = entry.t.creditCardMetadata?.billId || entry.t.billId;
      return !(billId && billMap[billId]?.dueDate);
    });
    if (movable.length < 2) continue;

    // Only act when 2+ parcels without billId share the same due month (true stack)
    const stackedInSameMonth = new Map();
    for (const entry of movable) {
      if (!stackedInSameMonth.has(entry.dueYm)) stackedInSameMonth.set(entry.dueYm, []);
      stackedInSameMonth.get(entry.dueYm).push(entry);
    }
    const stackedGroups = [...stackedInSameMonth.values()].filter((g) => g.length > 1);
    if (!stackedGroups.length) continue;

    for (const group of stackedGroups) {
      group.sort((a, b) => a.num - b.num || a.dueYm.localeCompare(b.dueYm));
      const minNum = group[0].num;
      const anchorDue = group[0].dueYm;

      for (const entry of group) {
        const correctDue = ymAdd(anchorDue, entry.num - minNum);
        if (!correctDue || correctDue === entry.dueYm || correctDue === 'Outros') continue;

        const from = map[entry.dueYm];
        if (from) from.items = from.items.filter((x) => x !== entry.t && x.id !== entry.t.id);

        if (!map[correctDue]) {
          map[correctDue] = {
            dueMonthKey: correctDue,
            items: [],
            total: 0,
            dueDate: inferDueDateForMonth(correctDue, officialBills),
          };
        }
        if (!map[correctDue].items.some((x) => x.id === entry.t.id)) {
          map[correctDue].items.push(entry.t);
        }
        entry.dueYm = correctDue;
      }
    }
  }
}

/**
 * PENDING without billId that landed on a due-month whose due date is already
 * before the purchase date belongs to a later cycle (e.g. Inter open Aug/07
 * must not absorb Sep/04 charges remapped from a stale forecast).
 */
export function advanceDueMonthPastPurchaseDate(key, tx, officialBills = []) {
  if (!key || key === 'Outros' || !tx?.date) return key;
  const txDate = String(tx.date).slice(0, 10);
  if (!txDate) return key;
  let current = key;
  for (let i = 0; i < 24; i++) {
    const dueDate = inferDueDateForMonth(current, officialBills);
    if (!dueDate || txDate <= dueDate) return current;
    current = ymAdd(current, 1);
  }
  return current;
}

/**
 * Infer how many months to add to billForecastDate to get due YYYY-MM.
 * Prefers transaction pairs (forecast + billId); falls back to close vs due on bills.
 * @returns {0|1}
 */
export function inferForecastToDueOffset(transactions = [], officialBills = []) {
  const billMap = billMapFromList(officialBills);
  let eqDue = 0;
  let eqDueMinus1 = 0;

  for (const t of transactions) {
    const fc = t.creditCardMetadata?.billForecastDate;
    const billId = t.creditCardMetadata?.billId || t.billId;
    if (!fc || !billId) continue;
    const bill = billMap[billId];
    if (!bill?.dueDate) continue;
    const dueYm = ymFromIso(bill.dueDate);
    if (fc === dueYm) eqDue += 1;
    if (fc === ymAdd(dueYm, -1)) eqDueMinus1 += 1;
  }

  if (eqDue + eqDueMinus1 > 0) {
    return eqDue >= eqDueMinus1 ? 0 : 1;
  }

  let sameMonth = 0;
  let diffMonth = 0;
  for (const b of officialBills) {
    const dueYm = ymFromIso(b.dueDate);
    const closeYm = ymFromIso(b.billClosingDate);
    if (!dueYm || !closeYm) continue;
    if (dueYm === closeYm) sameMonth += 1;
    else diffMonth += 1;
  }
  if (sameMonth + diffMonth > 0) {
    return sameMonth >= diffMonth ? 0 : 1;
  }

  // Safer default for BR retail cards (Nubank-like): forecast == due
  return 0;
}

/**
 * Canonical due-month key (YYYY-MM) for a credit-card transaction.
 */
export function getDueMonthKey(tx, officialBills = [], forecastToDueOffset = 0) {
  const billMap = Array.isArray(officialBills)
    ? billMapFromList(officialBills)
    : officialBills;

  const billId = tx.creditCardMetadata?.billId || tx.billId;
  if (billId && billMap[billId]?.dueDate) {
    return ymFromIso(billMap[billId].dueDate);
  }

  const fc = tx.creditCardMetadata?.billForecastDate;
  if (fc) return ymAdd(fc, forecastToDueOffset);

  if (tx.date) {
    // Last resort: treat posted month as due month when offset is 0;
    // when offset is 1 (Santander-like), purchase month ≈ forecast ≈ due−1.
    return forecastToDueOffset === 0
      ? ymFromIso(tx.date)
      : ymAdd(ymFromIso(tx.date), 1);
  }

  return 'Outros';
}

/**
 * Settled when payments[] match the bill total, OR a payment tx on this/later
 * cycle matches the bill total (Nubank often posts payment on the *next* statement).
 *
 * Important: do NOT use `paid >= total`. Itaú (and similar) put the *previous*
 * cycle's payment on `bill.payments[]` — e.g. Aug total 142.93 with payments
 * [252.87] (July's total). That would falsely settle every bill and jump the
 * open cycle to an empty month.
 */
export function isBillSettled(bill, opts = {}) {
  if (!bill) return false;
  const total = Number(bill.totalAmount) || 0;
  const payments = bill.payments || [];
  if (payments.length && total > 0) {
    const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    // Exact cover only (within rounding). Over/under → fall through to tx match.
    if (Math.abs(paid - total) <= 0.05) return true;
  }

  const { transactions = [], officialBills = [], forecastToDueOffset = 0 } = opts;
  if (!total || !transactions.length) return false;

  const dueYm = ymFromIso(bill.dueDate);
  if (!dueYm) return false;
  const billDueDate = String(bill.dueDate).slice(0, 10);
  const billMap = billMapFromList(officialBills);
  const nextYm = ymAdd(dueYm, 1);

  for (const t of transactions) {
    if (!isBillPayment(t)) continue;
    const amt = Math.abs(txBillingAmount(t));
    if (Math.abs(amt - total) > 0.05) continue;
    const tDue = getDueMonthKey(t, billMap, forecastToDueOffset);
    const tDate = String(t.date || '').slice(0, 10);
    const tYm = tDate ? tDate.slice(0, 7) : null;
    // Itaú: "Pagamento PIX" on due date with billForecastDate = due month;
    // with offset 1 that maps to nextYm — still this bill's payment.
    if (
      tDue === dueYm ||
      tDue === nextYm ||
      tDue > dueYm ||
      (tYm && tYm === dueYm) ||
      (tDate && tDate >= billDueDate)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Due month of the currently open (or next) bill.
 *
 * When official bills exist, never reopen a cycle Pluggy already listed —
 * PENDING that maps into a closed due month is ignored (stale forecast).
 * Open = earliest PENDING after latest official due, else latestOfficial + 1.
 */
export function resolveOpenDueMonthKey({
  transactions = [],
  officialBills = [],
  forecastToDueOffset = 0,
  today = new Date(),
} = {}) {
  const billMap = billMapFromList(officialBills);
  const todayIso = today.toISOString().slice(0, 10);
  const settleOpts = { transactions, officialBills, forecastToDueOffset };

  const sortedBillDues = officialBills
    .map((b) => ymFromIso(b.dueDate))
    .filter(Boolean)
    .sort();
  const latestOfficialDue = sortedBillDues.at(-1) || null;

  // Rare: unpaid official bill still current (dueDate >= today)
  const unpaidOfficial = officialBills
    .filter(
      (b) =>
        b.dueDate &&
        !isBillSettled(b, settleOpts) &&
        String(b.dueDate).slice(0, 10) >= todayIso
    )
    .map((b) => ymFromIso(b.dueDate))
    .filter(Boolean)
    .sort();
  if (unpaidOfficial.length) return unpaidOfficial[0];

  // Bradesco/Amazon (and similar): after close, Pluggy keeps the closed cycle as
  // PENDING without billId (billForecastDate = close month) and already tags new
  // purchases with the *next* forecast month — before publishing an official bill.
  // Only advance when the later forecast has a *new* purchase (à vista or parcel 1);
  // otherwise Nubank/MP future installments (2/N, 3/N…) would steal CURRENT_OPEN.
  const unboundByForecast = new Map();
  for (const t of transactions) {
    if (t.status !== 'PENDING' || isBillPayment(t)) continue;
    if (t.creditCardMetadata?.billId || t.billId) continue;
    const fcRaw = t.creditCardMetadata?.billForecastDate;
    const fc = ymFromIso(fcRaw) || (fcRaw ? String(fcRaw).slice(0, 7) : null);
    if (!fc) continue;
    if (!unboundByForecast.has(fc)) unboundByForecast.set(fc, []);
    unboundByForecast.get(fc).push(t);
  }
  const fcSorted = [...unboundByForecast.keys()].sort();
  if (fcSorted.length >= 2) {
    const laterFc = fcSorted[1];
    const laterHasNewPurchase = (unboundByForecast.get(laterFc) || []).some((t) => {
      const num = installmentNumberOf(t);
      const total = installmentTotalOf(t);
      return !(Number(total) > 1) || Number(num) === 1;
    });
    if (laterHasNewPurchase) {
      const openFromFc = ymAdd(laterFc, forecastToDueOffset);
      if (
        openFromFc &&
        openFromFc !== 'Outros' &&
        (!latestOfficialDue || openFromFc > latestOfficialDue)
      ) {
        return openFromFc;
      }
    }
  }

  const pendingDueMonths = new Set();
  for (const t of transactions) {
    if (t.status !== 'PENDING') continue;
    if (isBillPayment(t)) continue;
    // Future installments (2/N, 3/N…) must not advance the open cycle past
    // latestOfficial+1 — same rule as unboundByForecast above (Itaú/Nubank).
    const num = installmentNumberOf(t);
    const total = installmentTotalOf(t);
    if (Number(total) > 1 && Number(num) !== 1) continue;
    const due = getDueMonthKey(t, billMap, forecastToDueOffset);
    if (!due || due === 'Outros') continue;
    // Never reopen a cycle Pluggy already closed as an official bill
    if (latestOfficialDue && due <= latestOfficialDue) continue;
    pendingDueMonths.add(due);
  }
  const pendingSorted = [...pendingDueMonths].sort();
  if (pendingSorted.length) return pendingSorted[0];

  if (latestOfficialDue) return ymAdd(latestOfficialDue, 1);

  // No official bills: any PENDING, then calendar month
  for (const t of transactions) {
    if (t.status !== 'PENDING' || isBillPayment(t)) continue;
    const due = getDueMonthKey(t, billMap, forecastToDueOffset);
    if (due && due !== 'Outros') pendingDueMonths.add(due);
  }
  const anyPending = [...pendingDueMonths].sort();
  if (anyPending.length) return anyPending[0];

  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * If open key still points at a settled official bill, advance to next month.
 */
export function ensureOpenNotSettled(openDueKey, officialBills, settleOpts) {
  let key = openDueKey;
  for (let i = 0; i < 24; i++) {
    const official = officialBills.find((b) => ymFromIso(b.dueDate) === key);
    if (!official || !isBillSettled(official, settleOpts)) return key;
    key = ymAdd(key, 1);
  }
  return key;
}

function offsetForAccount(accountId, transactions, officialBills, cache, creditCards = []) {
  if (cache[accountId] != null) return cache[accountId];
  const cardAcc = creditCards.find((c) => c.id === accountId);
  const profile = resolveConnectorProfile({
    account: cardAcc,
    connectorName: cardAcc?.connectorName || cardAcc?._connector,
    connectorId: cardAcc?.connectorId || cardAcc?._connectorId,
  });
  if (profile?.forecastToDueOffset === 0 || profile?.forecastToDueOffset === 1) {
    cache[accountId || '__all__'] = profile.forecastToDueOffset;
    return profile.forecastToDueOffset;
  }
  const txs = transactions.filter((t) => !accountId || t.accountId === accountId);
  const bills = officialBills.filter((b) => !accountId || b.accountId === accountId);
  const offset = inferForecastToDueOffset(txs.length ? txs : transactions, bills.length ? bills : officialBills);
  cache[accountId || '__all__'] = offset;
  return offset;
}

export function buildCreditCardBills({
  transactions = [],
  officialBills = [],
  creditCards = [],
  selectedCardId = 'all',
  today = new Date(),
} = {}) {
  const billMap = billMapFromList(officialBills);
  const offsetCache = {};
  const globalOffset = inferForecastToDueOffset(transactions, officialBills);

  // Open due first — needed to remap stale PENDING out of closed cycles
  const accountIds = [
    ...new Set([
      ...creditCards.map((c) => c.id),
      ...transactions.map((t) => t.accountId).filter(Boolean),
    ]),
  ];
  const openByAccount = {};
  const latestOfficialByAccount = {};
  /** ISO date (YYYY-MM-DD) of latest official bill close (or due) per account */
  const latestCycleEndByAccount = {};
  /** @type {Record<string, import('./creditConnectors/profiles.js').CreditConnectorProfile>} */
  const profileByAccount = {};
  for (const accountId of accountIds) {
    const offset = offsetForAccount(accountId, transactions, officialBills, offsetCache, creditCards);
    const acctBills = officialBills.filter((b) => b.accountId === accountId);
    const acctTxs = transactions.filter((t) => t.accountId === accountId);
    const cardAcc = creditCards.find((c) => c.id === accountId);
    profileByAccount[accountId] = resolveConnectorProfile({
      account: cardAcc,
      connectorName: cardAcc?.connectorName || cardAcc?._connector,
      connectorId: cardAcc?.connectorId || cardAcc?._connectorId,
    });
    const settleOpts = {
      transactions: acctTxs,
      officialBills: acctBills,
      forecastToDueOffset: offset,
    };
    let openKey = resolveOpenDueMonthKey({
      transactions: acctTxs,
      officialBills: acctBills,
      forecastToDueOffset: offset,
      today,
    });
    openKey = ensureOpenNotSettled(openKey, acctBills, settleOpts);
    openByAccount[accountId] = openKey;
    const latestBill = acctBills
      .filter((b) => b?.dueDate)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .at(-1);
    latestOfficialByAccount[accountId] = latestBill
      ? ymFromIso(latestBill.dueDate)
      : null;
    const cycleEnd = latestBill?.billClosingDate || latestBill?.dueDate;
    latestCycleEndByAccount[accountId] = cycleEnd
      ? String(cycleEnd).slice(0, 10)
      : null;
  }
  const openCandidates = Object.values(openByAccount);
  let openDueKey = (openCandidates.length
    ? openCandidates
    : [
        resolveOpenDueMonthKey({
          transactions,
          officialBills,
          forecastToDueOffset: globalOffset,
          today,
        }),
      ]
  ).sort()[0];
  openDueKey = ensureOpenNotSettled(openDueKey, officialBills, {
    transactions,
    officialBills,
    forecastToDueOffset: globalOffset,
  });

  const dueKeyForTx = (t) => {
    const offset = offsetForAccount(t.accountId, transactions, officialBills, offsetCache, creditCards);
    let key = getDueMonthKey(t, billMap, offset);
    // Prefer series continuity over raw forecast offset for unbound installments
    const seriesDue = dueMonthFromInstallmentSeries(t, transactions, billMap);
    if (seriesDue) key = seriesDue;
    const openForCard = openByAccount[t.accountId] || openDueKey;
    const latestOfficial = latestOfficialByAccount[t.accountId];
    const profile = profileByAccount[t.accountId];
    const remapMode = profile?.remapStalePending || 'after_cycle_end';
    const acctBills = officialBills.filter((b) => !t.accountId || b.accountId === t.accountId);
    const billsForDue = acctBills.length ? acctBills : officialBills;
    // PENDING without billId that map into a closed official cycle may be:
    // (a) a NEW purchase with stale billForecastDate → remap toward open, OR
    // (b) historical charges some connectors never mark POSTED (e.g. Carrefour)
    //     → must stay in history, otherwise the open bill sums the whole ledger.
    const canRemap =
      remapMode !== 'never' &&
      t.status === 'PENDING' &&
      !isBillPayment(t) &&
      !t.creditCardMetadata?.billId &&
      !t.billId &&
      Boolean(latestOfficial) &&
      Boolean(key) &&
      key !== 'Outros' &&
      key <= latestOfficial &&
      Boolean(openForCard);

    if (canRemap) {
      if (remapMode === 'always') {
        key = openForCard;
      } else {
        // after_cycle_end: only remap purchases posted after the last closed cycle
        const cycleEnd = latestCycleEndByAccount[t.accountId];
        const txDate = t.date ? String(t.date).slice(0, 10) : null;
        if (txDate && cycleEnd && txDate > cycleEnd) key = openForCard;
      }
    }

    // Never keep unbound PENDING on a cycle already due before the purchase date
    // (remap to open Aug must not pull Sep purchases into the Aug statement).
    // Skip installments: on Inter, `date` is often the scheduled parcel date, not purchase date.
    const installmentTotal = t.creditCardMetadata?.totalInstallments || t.totalInstallmentsCount;
    if (
      t.status === 'PENDING' &&
      !isBillPayment(t) &&
      !t.creditCardMetadata?.billId &&
      !t.billId &&
      !(Number(installmentTotal) > 1)
    ) {
      key = advanceDueMonthPastPurchaseDate(key, t, billsForDue);
    }

    return key;
  };

  const map = {};

  // Seed buckets from official bills
  for (const b of officialBills) {
    const dueYm = ymFromIso(b.dueDate);
    if (!dueYm) continue;
    if (!map[dueYm]) {
      map[dueYm] = {
        dueMonthKey: dueYm,
        items: [],
        total: 0,
        dueDate: String(b.dueDate).slice(0, 10),
      };
    } else if (b.dueDate) {
      map[dueYm].dueDate = String(b.dueDate).slice(0, 10);
    }
  }

  // Group transactions by due month (per-account offset)
  for (const t of transactions) {
    // Drop Carrefour-style purchase-total ghosts (full amount tagged as N/M)
    if (isInstallmentPurchaseTotalGhost(t, transactions)) continue;
    const key = dueKeyForTx(t);
    if (!map[key]) {
      map[key] = {
        dueMonthKey: key,
        items: [],
        total: 0,
        dueDate: key === 'Outros' ? null : inferDueDateForMonth(key, officialBills),
      };
    }
    map[key].items.push(t);
  }

  // Split future installments that Pluggy stacked on the same forecast month
  redistributeStackedInstallments(map, officialBills);

  if (!map[openDueKey]) {
    map[openDueKey] = {
      dueMonthKey: openDueKey,
      items: [],
      total: 0,
      dueDate: inferDueDateForMonth(openDueKey, officialBills),
    };
  }

  // Project missing installments only (never duplicate real N/M; never invent past cycles)
  // Use post-redistribution bucket placement as the due month source of truth
  const dueYmByTxId = new Map();
  for (const dueYm of Object.keys(map)) {
    for (const t of map[dueYm].items) {
      if (t?.id) dueYmByTxId.set(t.id, dueYm);
    }
  }

  const series = new Map();
  for (const t of transactions) {
    if (t.isProjected || isBillPayment(t)) continue;
    if (isInstallmentPurchaseTotalGhost(t, transactions)) continue;
    const total = installmentTotalOf(t);
    const num = installmentNumberOf(t);
    if (!total || !num) continue;
    const key = installmentSeriesKey(t);
    if (!key) continue;
    const due = dueYmByTxId.get(t.id) || dueKeyForTx(t);
    if (!due || due === 'Outros') continue;
    let entry = series.get(key);
    if (!entry) {
      entry = {
        total,
        maxNum: 0,
        maxDue: due,
        sample: t,
        accountId: t.accountId,
      };
      series.set(key, entry);
    }
    if (num >= entry.maxNum) {
      entry.maxNum = num;
      entry.maxDue = due;
      entry.sample = t;
    }
  }

  for (const [seriesKey, entry] of series) {
    const { total, maxNum, maxDue, sample, accountId } = entry;
    const openFor = openByAccount[accountId] || openDueKey;
    // Project missing N/M: future parcels after maxNum AND gaps below maxNum
    // (Pluggy often skips mid-series rows; e.g. 4/12 then 7/12 without 5–6).
    // Place relative to the highest known installment's due month.
    for (let n = 1; n <= total; n++) {
      if (hasInstallmentNumber(transactions, seriesKey, n)) continue;
      if (hasSimilarInstallment(transactions, sample, n)) continue;
      const futureDue = ymAdd(maxDue, n - maxNum);
      // Do not project into already-closed cycles
      if (futureDue < openFor) continue;
      if (!map[futureDue]) {
        map[futureDue] = {
          dueMonthKey: futureDue,
          items: [],
          total: 0,
          dueDate: inferDueDateForMonth(futureDue, officialBills),
        };
      }
      if (hasInstallmentNumber(map[futureDue].items, seriesKey, n)) continue;
      if (hasSimilarInstallment(map[futureDue].items, sample, n)) continue;
      const baseDesc = normalizeInstallmentDesc(sample.description);
      map[futureDue].items.push({
        ...sample,
        id: `proj_${sample.id}_${n}`,
        description: `${baseDesc} (Parcela ${n}/${total})`,
        creditCardMetadata: {
          ...(sample.creditCardMetadata || {}),
          installmentNumber: n,
          totalInstallments: total,
          // Projected parcels are not tied to the sample's official bill
          billId: undefined,
          billForecastDate: futureDue,
        },
        billId: undefined,
        currentInstallment: n,
        totalInstallmentsCount: total,
        isProjected: true,
        status: 'PENDING',
        date: `${inferDueDateForMonth(futureDue, officialBills)}T00:00:00.000Z`,
      });
    }
  }

  const sortedDueKeys = Object.keys(map).filter((k) => k !== 'Outros').sort();

  const activeCards =
    selectedCardId === 'all'
      ? creditCards
      : creditCards.filter((c) => c.id === selectedCardId);

  const bills = {};
  for (const dueYm of sortedDueKeys) {
    const bucket = map[dueYm];
    let totalAmount = 0;
    let isPaid = true;
    let hasOfficial = false;
    let dueDate = bucket.dueDate || inferDueDateForMonth(dueYm, officialBills);

    const cardsForTotals = activeCards.length ? activeCards : [{ id: null }];

    for (const card of cardsForTotals) {
      const cardAcc = card.id ? creditCards.find((c) => c.id === card.id) : null;
      const profile = resolveConnectorProfile({
        account: cardAcc,
        connectorName: cardAcc?.connectorName || cardAcc?._connector,
        connectorId: cardAcc?.connectorId || cardAcc?._connectorId,
      });
      const official = officialBills.find(
        (b) =>
          (!card.id || b.accountId === card.id) &&
          ymFromIso(b.dueDate) === dueYm
      );

      const scopedItems = bucket.items.filter(
        (t) => !card.id || !t.accountId || t.accountId === card.id
      );
      const cardOpenKey = openByAccount[card.id] || openDueKey;
      const chargeSumMode = profile?.chargeSumMode || 'signed_net';

      if (official) {
        // Official total is authoritative for real charges, but Amazon/Bradesco
        // open drafts often omit installment parcels we project into this bucket.
        const officialAmt = Number(official.totalAmount) || 0;
        const projectedAmt = sumProjectedCharges(scopedItems, { chargeSumMode });
        totalAmount += officialAmt + projectedAmt;
        hasOfficial = true;
        dueDate = String(official.dueDate).slice(0, 10);
        if (
          !isBillSettled(official, {
            transactions,
            officialBills,
            forecastToDueOffset: globalOffset,
          })
        ) {
          // Open / near-open cycles: trust unsettled. Older history often lacks
          // payments[] (Inter/Nubank) — treating years of paid statements as
          // unpaid floods Agenda and Moment with false overdue.
          const unpaidCutoff = ymAdd(cardOpenKey, -2);
          if (dueYm >= unpaidCutoff) isPaid = false;
        }
      } else if (dueYm === cardOpenKey) {
        const openTotal = resolveOpenBillTotal(cardAcc, scopedItems, profile, {
          transactions: transactions.filter((t) => !card.id || t.accountId === card.id),
          openDueKey: dueYm,
          officialBills: officialBills.filter((b) => !card.id || b.accountId === card.id),
          forecastToDueOffset: card.id
            ? offsetForAccount(card.id, transactions, officialBills, offsetCache, creditCards)
            : globalOffset,
        });
        totalAmount += openTotal;
        if (openTotal > 0) isPaid = false;
      } else {
        // Past without official, or future: sum cycle charges (+ projections for future)
        const includeProjected = dueYm > cardOpenKey;
        const sumTxs = sumCycleCharges(scopedItems, {
          includeProjected,
          chargeSumMode,
        });
        totalAmount += sumTxs;
        // Reconstructed past (no official bill) is assumed settled — Pluggy drops
        // paid statements; marking every historical bucket unpaid is wrong.
        // Future stays unpaid (also forced below when type === FUTURE).
        if (dueYm > cardOpenKey && sumTxs > 0) isPaid = false;
      }
    }

    if (!activeCards.length && !hasOfficial) {
      totalAmount = sumCycleCharges(bucket.items, {
        includeProjected: dueYm > openDueKey || dueYm === openDueKey,
        chargeSumMode: 'signed_net',
      });
      if (totalAmount > 0 && dueYm >= openDueKey) isPaid = false;
    }

    let type = 'PAST';
    if (dueYm === openDueKey) type = 'CURRENT_OPEN';
    else if (dueYm > openDueKey) type = 'FUTURE';

    // Settled official bill can never be "Em Aberto"
    if (type === 'CURRENT_OPEN' && hasOfficial && isPaid) {
      type = 'PAST';
    }

    bills[dueYm] = {
      dueMonthKey: dueYm,
      monthKey: dueYm,
      items: bucket.items,
      total: totalAmount,
      dueDate,
      isPaid: type === 'FUTURE' ? false : isPaid,
      type,
      hasOfficial,
    };
  }

  return {
    forecastToDueOffset: globalOffset,
    openDueKey,
    sortedDueKeys,
    bills,
  };
}

/**
 * Compact open/last-paid summary for a single credit card (Telegram, KPIs).
 */
export function summarizeCardOpenBill(card, transactions = [], officialBills = []) {
  const txs = (transactions || []).map((t) => ({
    ...t,
    accountId: t.accountId || card.id,
  }));
  const bills = (officialBills || []).map((b) => ({
    ...b,
    accountId: b.accountId || card.id,
  }));

  const built = buildCreditCardBills({
    transactions: txs,
    officialBills: bills,
    creditCards: [card],
    selectedCardId: card.id,
  });

  const open = built.bills[built.openDueKey];
  const lastPaidKey = [...built.sortedDueKeys]
    .reverse()
    .find((k) => {
      const b = built.bills[k];
      // Ignore empty placeholder months (e.g. payment-only bucket)
      return b?.isPaid && b?.type === 'PAST' && (b.hasOfficial || (Number(b.total) || 0) > 0.05);
    });
  const lastPaid = lastPaidKey ? built.bills[lastPaidKey] : null;
  const profile = resolveConnectorProfile({ account: card });
  // Prefer the bill-builder total (already cycle-scoped); never raw card.balance
  const openTotal =
    open?.total != null
      ? Number(open.total)
      : resolveOpenBillTotal(card, open?.items || [], profile, {
          transactions: txs,
          openDueKey: built.openDueKey,
          officialBills: bills,
          forecastToDueOffset: built.forecastToDueOffset,
        });

  return {
    openDueKey: built.openDueKey,
    openTitle: formatDueMonthTitle(built.openDueKey),
    openTotal,
    openDueDate: open?.dueDate || inferDueDateForMonth(built.openDueKey, bills),
    openItemCount: (open?.items || []).filter((t) => !t.isProjected && !isBillPayment(t)).length,
    lastPaidKey: lastPaidKey || null,
    lastPaidTitle: lastPaidKey ? formatDueMonthTitle(lastPaidKey) : null,
    lastPaidTotal: lastPaid ? lastPaid.total : null,
    lastPaidDueDate: lastPaid?.dueDate || null,
    creditLimit: card.creditData?.creditLimit ?? null,
    availableLimit: card.creditData?.availableCreditLimit ?? null,
    forecastToDueOffset: built.forecastToDueOffset,
    connectorProfileId: profile.id,
  };
}
