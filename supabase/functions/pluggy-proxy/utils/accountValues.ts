/**
 * Canonical value-contract fields attached to accounts (web source of truth).
 * BANK: availableBalance + reserved*. CREDIT: openBillTotal vs outstanding.
 */
import { summarizeCardOpenBill } from "../creditBillPeriod.ts";
import {
  accountAvailableBalance,
  getReservedBalances,
  sumReservedBalances,
} from "./reservedBalances.ts";

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

export function enrichBankAccount(account: AnyRec): AnyRec {
  const reservedItems = getReservedBalances(account);
  const reservedBalance = sumReservedBalances(account);
  return {
    ...account,
    availableBalance: accountAvailableBalance(account),
    reservedBalance,
    reservedItems,
    outstanding: null,
    openBillTotal: null,
    openDueKey: null,
    openDueDate: null,
    lastPaidTotal: null,
    lastPaidKey: null,
    connectorProfileId: null,
  };
}

export function enrichCreditAccount(
  account: AnyRec,
  transactions: AnyRec[] = [],
  officialBills: AnyRec[] = [],
): AnyRec {
  const summary = summarizeCardOpenBill(account, transactions, officialBills);
  const outstanding = Math.abs(Number(account.balance) || 0);
  const openTotal = Number(summary.openTotal) || 0;
  const isManual = Boolean(account.isManual);
  const billAmount = isManual
    ? Number(account.billAmount ?? account.balance) || 0
    : openTotal;
  return {
    ...account,
    availableBalance: null,
    reservedBalance: 0,
    reservedItems: [],
    outstanding,
    openBillTotal: openTotal,
    openDueKey: summary.openDueKey || null,
    openDueDate: summary.openDueDate || null,
    lastPaidTotal: summary.lastPaidTotal != null ? Number(summary.lastPaidTotal) : null,
    lastPaidKey: summary.lastPaidKey || null,
    connectorProfileId: summary.connectorProfileId || null,
    billAmount,
  };
}

export function enrichAccounts(
  accounts: AnyRec[],
  transactionsByAccount: Record<string, AnyRec[]> = {},
  billsByAccount: Record<string, AnyRec[]> = {},
): AnyRec[] {
  return accounts.map((account) => {
    const type = String(account.type || "").toUpperCase();
    const id = String(account.id || "");
    if (type === "CREDIT") {
      return enrichCreditAccount(
        account,
        transactionsByAccount[id] || [],
        billsByAccount[id] || [],
      );
    }
    return enrichBankAccount(account);
  });
}

export function sumOpenBillsTotal(accounts: AnyRec[]): number {
  return accounts.reduce((sum, acc) => {
    if (String(acc.type).toUpperCase() !== "CREDIT") return sum;
    const open = acc.openBillTotal;
    if (open == null) return sum + Math.abs(Number(acc.balance) || 0);
    return sum + (Number(open) || 0);
  }, 0);
}
