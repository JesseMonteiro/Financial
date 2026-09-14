/**
 * Automatic-debit helpers (port of src/utils/analytics.js for Momento Financeiro).
 */
import { isBillPayment } from "../creditBillPeriod.ts";

function normalizeDesc(text: unknown): string {
  return String(text || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function txDay(tx: Record<string, unknown>): string {
  const raw = String(tx?.date || "");
  return raw.length >= 10 ? raw.slice(0, 10) : "";
}

function ymFromDate(date: unknown): string | null {
  if (!date) return null;
  const raw = String(date);
  if (raw.length >= 7) return raw.slice(0, 7);
  return null;
}

function txSearchText(tx: Record<string, unknown>): string {
  const merchant = tx?.merchant as { name?: string; businessName?: string } | undefined;
  const paymentData = tx?.paymentData as {
    receiver?: { name?: string };
    payer?: { name?: string };
  } | undefined;
  return normalizeDesc(
    [
      tx?.description,
      tx?.descriptionRaw,
      merchant?.name,
      merchant?.businessName,
      paymentData?.receiver?.name,
      paymentData?.payer?.name,
    ]
      .filter(Boolean)
      .join(" | "),
  );
}

function isCreditCardFaturaPayment(tx: Record<string, unknown>): boolean {
  const d = txSearchText(tx);
  return (
    d.includes("PAGAMENTO DE FATURA") ||
    d.includes("PAGAMENTO RECEBIDO") ||
    d.includes("PAGAMENTO ON LINE") ||
    d.includes("PAGAMENTO ONLINE") ||
    d.includes("PAGTO FATURA") ||
    d.includes("PAGAMENTO FATURA")
  );
}

function isBankOutflow(tx: Record<string, unknown>): boolean {
  if (!tx) return false;
  if (tx.type === "CREDIT" || tx.type === "CREDIT_INCOME") return false;
  return Number(tx.amount) < 0 || tx.type === "DEBIT";
}

function isPersonOrRailTransfer(tx: Record<string, unknown>): boolean {
  const method = String(
    (tx?.paymentData as { paymentMethod?: string } | undefined)?.paymentMethod || "",
  ).toUpperCase();
  if (method === "PIX" || method === "TED" || method === "DOC" || method === "TEV") {
    return true;
  }

  const op = String(tx?.operationType || "").toUpperCase();
  if (
    op === "PIX" ||
    op === "TED" ||
    op === "DOC" ||
    op === "TRANSFERENCIA_MESMA_INSTITUICAO" ||
    op.includes("PIX") ||
    op.includes("TRANSFERENCIA")
  ) {
    return true;
  }

  const d = txSearchText(tx);
  if (!d) return false;
  if (/\bPIX\b/.test(d)) return true;

  return (
    d.includes("TED ENVIAD") ||
    /^TED\b/.test(d) ||
    /^DOC\b/.test(d) ||
    d.includes("TRANSFERENCIA ENVIADA") ||
    d.includes("TRANSF ENTRE CONTAS") ||
    d.includes("TRANSFERENCIA ENTRE CONTAS")
  );
}

function matchesAutomaticDebitDescription(tx: Record<string, unknown>): boolean {
  const d = txSearchText(tx);
  if (!d) return false;
  if (/\bPIX\b/.test(d)) return false;
  return (
    d.includes("DEBITO AUT") ||
    d.includes("DEB AUT") ||
    d.includes("DEB.AUT") ||
    d.includes("DEBITO AUTOMATICO") ||
    d.includes("DEBITO AUTOM") ||
    d.includes("DEBITO EM CONTA") ||
    /\bDA\b.*\b(CLARO|VIVO|TIM|OI|NET|SKY|ENERGIA|SABESP|CEMIG|LIGHT|ENEL)\b/.test(d) ||
    d.includes("SOCIEDADE DE CREDITO") ||
    d.includes("FINANCIAMENTO E INVESTIMENTO") ||
    d.includes("CREDITO, FINANCIAMENTO") ||
    d.includes("CREDITO FINANCIAMENTO")
  );
}

export function isAutomaticDebitTx(
  tx: Record<string, unknown>,
  opts: { bankAccountIds?: Set<string> | string[] } = {},
): boolean {
  if (!tx || tx.isManual) return false;
  if (!isBankOutflow(tx)) return false;
  if (isPersonOrRailTransfer(tx)) return false;
  if (isCreditCardFaturaPayment(tx)) return false;
  if (isBillPayment(tx)) return false;

  const bankAccountIds = opts.bankAccountIds;
  if (bankAccountIds) {
    const ids = bankAccountIds instanceof Set ? bankAccountIds : new Set(bankAccountIds);
    if (!ids.has(String(tx.accountId || ""))) return false;
  }

  if (tx.operationType === "CONVENIO_ARRECADACAO") return true;

  const op = String(tx.operationType || "").toUpperCase();
  const cat = String(tx.category || "").toLowerCase();
  const isLoanCat = cat.includes("loan") || cat.includes("financ");
  if (op === "BOLETO" && isLoanCat) return true;

  return matchesAutomaticDebitDescription(tx);
}

export function isAutomaticDebitPending(
  tx: Record<string, unknown>,
  now = new Date(),
): boolean {
  if (!tx) return false;
  if (tx.status === "POSTED") return false;
  if (tx.status === "PENDING") return true;
  const day = txDay(tx);
  const today = now.toISOString().slice(0, 10);
  return Boolean(day && day > today);
}

export function automaticDebitsForMonth(
  transactions: Record<string, unknown>[] = [],
  ym: string,
  opts: { bankAccountIds?: Set<string> | string[] } = {},
): Record<string, unknown>[] {
  if (!ym) return [];
  return transactions.filter((t) => {
    if (!isAutomaticDebitTx(t, opts)) return false;
    const day = txDay(t);
    if (day.startsWith(ym)) return true;
    return ymFromDate(t.date) === ym;
  });
}

