/**
 * Hydrate manual_accounts rows into Pluggy-shaped accounts (port of src/utils/manualAccounts.js).
 */
// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function hydrateManualAccount(row: AnyRec = {}): AnyRec {
  const type = row.type === "CREDIT" ? "CREDIT" : "BANK";
  const institution = row.institutionName || row.institution_name || "";
  const billAmount = Number(row.billAmount ?? row.bill_amount);
  const safeBill = Number.isFinite(billAmount) ? billAmount : 0;
  const rawBalance = Number(row.balance);
  const bankBalance = Number.isFinite(rawBalance) ? rawBalance : 0;
  const balance = type === "CREDIT" ? safeBill : bankBalance;
  const dueDayRaw = row.billDueDay ?? row.bill_due_day;
  const dueDay = dueDayRaw == null || dueDayRaw === "" ? null : Number(dueDayRaw);
  const creditLimit = Number(row.creditLimit ?? row.credit_limit) || 0;
  const name = row.name || (type === "CREDIT" ? "Cartão manual" : "Conta manual");

  return {
    id: row.id,
    itemId: null,
    type,
    name,
    originalName: name,
    number: row.number || "",
    balance,
    marketingName: institution,
    updatedAt: row.updatedAt || row.updated_at || null,
    isManual: true,
    pairId: row.pairId || row.pair_id || null,
    billAmount: type === "CREDIT" ? (Number.isFinite(billAmount) ? billAmount : null) : null,
    billDueDay: Number.isFinite(dueDay) ? dueDay : null,
    userId: row.userId || row.user_id || null,
    ownerUserId: row.ownerUserId || row.userId || row.user_id || null,
    ownerLabel: row.ownerLabel || null,
    bankData: type === "BANK" ? { institutionName: institution || "Manual" } : undefined,
    creditData:
      type === "CREDIT"
        ? {
          institutionName: institution || "Manual",
          creditLimit,
          availableCreditLimit: creditLimit > 0 ? Math.max(0, creditLimit - safeBill) : 0,
        }
        : undefined,
  };
}

export function nextDueDateFromDay(dueDay: unknown, today = new Date()): string {
  const day = Math.min(31, Math.max(1, Number(dueDay) || 10));
  let year = today.getFullYear();
  let month = today.getMonth();
  if (today.getDate() > day) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  const clamped = Math.min(day, lastDayOfMonth(year, month));
  return `${year}-${pad2(month + 1)}-${pad2(clamped)}`;
}

export function syntheticManualBill(card: AnyRec, today = new Date()): AnyRec | null {
  if (!card?.id) return null;
  const dueDate = nextDueDateFromDay(card.billDueDay, today);
  const total = Number(card.billAmount ?? card.balance) || 0;
  return {
    id: `manual-bill-${card.id}-${dueDate.slice(0, 7)}`,
    accountId: card.id,
    dueDate,
    totalAmount: total,
    isManual: true,
  };
}
