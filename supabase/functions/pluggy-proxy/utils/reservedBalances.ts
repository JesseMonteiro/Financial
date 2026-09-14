/**
 * Open Finance "caixinhas" / reserved balances (port of src/utils/reservedBalances.js).
 */
// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

function amountFromAvailable(entry: unknown): number {
  if (!entry || typeof entry !== "object") return 0;
  const amount = (entry as { amount?: number }).amount;
  return typeof amount === "number" ? amount : 0;
}

export function getReservedBalances(account?: AnyRec) {
  const raw = account?.bankData?.reservedBalances;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  return raw
    .map((item: AnyRec, index: number) => {
      const amounts = Array.isArray(item?.availableAmounts) ? item.availableAmounts : [];
      const amount = amounts.reduce((sum: number, a: unknown) => sum + amountFromAvailable(a), 0);
      const currencyCode = amounts.find((a: AnyRec) => a?.currencyCode)?.currencyCode || "BRL";
      const remuneration = amounts.find((a: AnyRec) => a?.remuneration)?.remuneration || null;
      const identification = String(item?.identification || `reserved-${index}`);
      const name = (item?.name && String(item.name).trim()) || "Caixinha";
      return { identification, name, amount, currencyCode, remuneration };
    })
    .filter((item: { amount: number }) => item.amount > 0);
}

export function sumReservedBalances(account?: AnyRec): number {
  return getReservedBalances(account).reduce((sum, item) => sum + (item.amount || 0), 0);
}

export function accountAvailableBalance(account?: AnyRec): number {
  return Number(account?.balance) || 0;
}

export function totalReservedBalances(accounts: AnyRec[] = []): number {
  return (accounts || []).reduce((sum, acc) => {
    if (String(acc?.type).toUpperCase() !== "BANK") return sum;
    return sum + sumReservedBalances(acc);
  }, 0);
}

function institutionLabel(account: AnyRec): string {
  return (
    account?.bankData?.institutionName ||
    account?.marketingName ||
    account?.name ||
    "Mercado Pago"
  );
}

function rateFromRemuneration(remuneration: AnyRec | null): number | null {
  if (!remuneration || typeof remuneration !== "object") return null;
  const pct = Number(remuneration.postFixedIndexerPercentage);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.round(pct * 10000) / 100;
}

export function reservedBalancesAsInvestments(accounts: AnyRec[] = []): AnyRec[] {
  const out: AnyRec[] = [];
  for (const account of accounts || []) {
    if (String(account?.type).toUpperCase() !== "BANK") continue;
    const boxes = getReservedBalances(account);
    if (!boxes.length) continue;

    const issuer = institutionLabel(account);
    const owner = account.ownerLabel || account.owner || null;
    const accountName = account.name || account.marketingName || issuer;

    for (const box of boxes) {
      const rate = rateFromRemuneration(box.remuneration);
      const rateType = box.remuneration?.indexer || "CDI";
      out.push({
        id: `caixinha-${account.id}-${box.identification}`,
        name: box.name,
        code: box.identification,
        type: "FIXED_INCOME",
        subtype: "CAIXINHA",
        balance: box.amount,
        amount: box.amount,
        quantity: 1,
        value: box.amount,
        currencyCode: box.currencyCode || "BRL",
        status: "ACTIVE",
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

export function mergeInvestmentsWithReserved(investments: AnyRec[] = [], accounts: AnyRec[] = []): AnyRec[] {
  const fromPluggy = Array.isArray(investments) ? investments.filter((i) => !i?.isReservedBalance) : [];
  const fromCaixinhas = reservedBalancesAsInvestments(accounts);
  const seen = new Set(fromPluggy.map((i) => String(i?.id || "")));
  const extra = fromCaixinhas.filter((i) => !seen.has(String(i.id)));
  return [...fromPluggy, ...extra];
}
