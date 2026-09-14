/**
 * Agenda payload using the credit-bill engine (port of src/utils/agenda.js).
 */
import { jsonResponse, errorResponse } from "../middleware/http.ts";
import { pluggyJson, type PluggyClient } from "./pluggy.ts";
import { buildCreditCardBills, formatDueMonthShort } from "../creditBillPeriod.ts";
import { hydrateManualAccount } from "../utils/manualAccounts.ts";
import {
  fetchAccountsWithConnectors,
  loadCreditLedger,
  loadManualTransactions,
} from "../utils/creditLedger.ts";

// deno-lint-ignore no-explicit-any
type AnyRec = Record<string, any>;

const CREDIT_OVERDUE_LOOKBACK_DAYS = 93;

function toIsoDay(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function isTxPaid(t: AnyRec): boolean {
  return Boolean(t.isPaid === true || t.isPaid === 1 || t.isPaid === "true" || t.paidAt);
}

function lastFour(account: AnyRec): string {
  const raw = String(account.number ?? account.creditData?.number ?? "");
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

export async function handleAgenda(client: PluggyClient, url: URL): Promise<Response> {
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse("Parâmetro month obrigatório no formato YYYY-MM", 400);
  }

  const [pluggyAccounts, manuals, loansRaw, receivablesRes] = await Promise.all([
    fetchAccountsWithConnectors(client),
    loadManualTransactions(client),
    (async () => {
      const all: AnyRec[] = [];
      for (const iid of client.itemIds) {
        try {
          const d = await pluggyJson(client, "/loans", { params: { itemId: iid } }) as {
            results?: AnyRec[];
          };
          all.push(...(d.results || []));
        } catch { /* skip */ }
      }
      return all;
    })(),
    client.supabase.from("receivables").select("*").eq("user_id", client.userId),
  ]);

  const { data: manualAccountRows } = await client.supabase
    .from("manual_accounts")
    .select("*")
    .eq("user_id", client.userId);
  const accounts = [
    ...pluggyAccounts,
    ...((manualAccountRows || []) as AnyRec[]).map((row) => hydrateManualAccount(row)),
  ];
  const creditCards = accounts.filter((a) => String(a.type).toUpperCase() === "CREDIT");
  const { transactionsByAccount, billsByAccount } = await loadCreditLedger(client, creditCards);
  for (const tx of manuals) {
    const id = String(tx.accountId || "");
    if (transactionsByAccount[id]) transactionsByAccount[id].push(tx);
  }

  const items: AnyRec[] = [];

  for (const t of manuals) {
    if (Number(t.amount) > 0) continue;
    const date = toIsoDay(t.date);
    if (!date || !date.startsWith(month)) continue;
    items.push({
      id: `manual_${t.id}`,
      title: t.originalDescription || t.description || "Despesa manual",
      date,
      amount: Math.abs(Number(t.amount) || 0),
      kind: "custom",
      isCompleted: isTxPaid(t),
    });
  }

  const now = new Date();
  for (const card of creditCards) {
    const id = String(card.id);
    const built = buildCreditCardBills({
      transactions: transactionsByAccount[id] || [],
      officialBills: billsByAccount[id] || [],
      creditCards: [card],
      selectedCardId: id,
    });
    const name = String(card.marketingName || card.name || "Cartão");
    const last4 = lastFour(card);
    for (const [dueYm, bill] of Object.entries(built.bills || {})) {
      const b = bill as AnyRec;
      const date = b.dueDate ? toIsoDay(b.dueDate) : `${dueYm}-10`;
      if (!date || !dueYm.startsWith(month.slice(0, 7))) {
        // still include overdue unpaid PAST bills
      }
      let isPaid = Boolean(b.isPaid);
      const amount = Math.abs(Number(b.total || 0));
      if (amount <= 0) continue;
      if (!isPaid && b.type === "PAST") {
        const due = new Date(`${date}T12:00:00`);
        const ageDays = Math.round((now.getTime() - due.getTime()) / 86400000);
        if (ageDays > CREDIT_OVERDUE_LOOKBACK_DAYS) isPaid = true;
      }
      const inMonth = String(date).startsWith(month);
      const overdueUnpaid = !isPaid && String(date) < `${month}-01`;
      if (!inMonth && !overdueUnpaid) continue;
      items.push({
        id: `bill_${id}_${dueYm}`,
        title: `Fatura · ${name}${last4 ? ` · final ${last4}` : ""}`,
        date,
        amount,
        kind: "bill",
        isCompleted: isPaid,
        meta: `vence ${formatDueMonthShort(dueYm, date)}`,
      });
    }
  }

  for (const loan of loansRaw) {
    const date = toIsoDay(loan.dueDate || loan.nextPaymentDate);
    if (!date || !date.startsWith(month)) continue;
    items.push({
      id: `loan_${loan.id}`,
      title: String(loan.contractNumber || loan.name || "Empréstimo"),
      date,
      amount: Math.abs(Number(loan.installmentAmount || loan.paymentAmount || 0)),
      kind: "loan",
      isCompleted: Boolean(loan.isPaid),
    });
  }

  for (const row of (receivablesRes.data || []) as AnyRec[]) {
    const history = row.installment_history || row.installmentHistory || [];
    for (const inst of history) {
      const date = toIsoDay(inst.dueDate || inst.due_date);
      if (!date || !date.startsWith(month)) continue;
      items.push({
        id: `recv_${row.id}_${date}`,
        title: String(row.counterparty || row.description || "A receber"),
        date,
        amount: Math.abs(Number(inst.amount) || 0),
        kind: "receivable",
        isCompleted: Boolean(inst.paidAt || inst.paid_at || inst.isPaid),
      });
    }
  }

  items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return jsonResponse({ month, items });
}
