/**
 * Momento Financeiro BFF — same aggregation as the web FinancialMoment page.
 */
import { errorResponse, jsonResponse } from "../middleware/http.ts";
import {
  getPluggyApiKey,
  PLUGGY_API,
  pluggyJson,
  type PluggyClient,
} from "./pluggy.ts";
import {
  buildFinancialMomentMonthList,
  computeFinancialMomentMonth,
  computeFinancialMomentMonthsStatus,
} from "../utils/financialMomentMonth.ts";
import {
  getMonthlySalaries,
  resolveMonthSalary,
  saveMonthlySalaries,
  withSavedMonthSalary,
} from "../utils/monthSalary.ts";

async function fetchAccounts(client: PluggyClient): Promise<Record<string, unknown>[]> {
  const chunks = await Promise.all(client.itemIds.map(async (iid) => {
    try {
      const [d, item] = await Promise.all([
        pluggyJson(client, "/accounts", { params: { itemId: iid } }) as Promise<{
          results?: Record<string, unknown>[];
        }>,
        pluggyJson(client, `/items/${iid}`).catch(() => null) as Promise<{
          connector?: { name?: string };
        } | null>,
      ]);
      const connectorName = item?.connector?.name ? String(item.connector.name) : "";
      return (d.results || []).map((acc) => ({
        ...acc,
        itemId: acc.itemId || iid,
        _connector: connectorName,
      }));
    } catch (e) {
      console.error("[financial-moment] accounts", iid, e);
      return [] as Record<string, unknown>[];
    }
  }));
  return chunks.flat();
}

function lastFour(account: Record<string, unknown>): string {
  const raw = String(
    account.number ?? (account.creditData as { number?: string } | undefined)?.number ?? "",
  );
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return "****";
}

type FaceOverlay = {
  key?: string;
  facePath?: string;
  face_path?: string;
  faceUrl?: string;
  face_url?: string;
};

async function loadCardFaceOverlays(client: PluggyClient): Promise<{
  icons: Record<string, FaceOverlay>;
  names: Record<string, string>;
  signed: Record<string, string>;
}> {
  try {
    const { data } = await client.supabase
      .from("profiles")
      .select("custom_account_icons, custom_account_names")
      .eq("id", client.userId)
      .maybeSingle();
    const icons = (data?.custom_account_icons && typeof data.custom_account_icons === "object")
      ? data.custom_account_icons as Record<string, FaceOverlay>
      : {};
    const names = (data?.custom_account_names && typeof data.custom_account_names === "object")
      ? Object.fromEntries(
        Object.entries(data.custom_account_names as Record<string, unknown>)
          .filter(([, v]) => typeof v === "string" && v.trim())
          .map(([k, v]) => [k, String(v)]),
      )
      : {};
    const paths = [...new Set(
      Object.values(icons)
        .map((o) => o?.facePath || o?.face_path)
        .filter((p): p is string => Boolean(p)),
    )];
    const signed: Record<string, string> = {};
    await Promise.all(paths.map(async (path) => {
      const { data: signedData } = await client.supabase.storage
        .from("account-icons")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signedData?.signedUrl) signed[path] = signedData.signedUrl;
    }));
    return { icons, names, signed };
  } catch (e) {
    console.error("[financial-moment] overlays", e);
    return { icons: {}, names: {}, signed: {} };
  }
}

function overlayFor(icons: Record<string, FaceOverlay>, id: string): FaceOverlay {
  return icons[id] || icons[String(id)] || {};
}

type CardFaceMeta = {
  lastFour: string;
  institutionName: string;
  marketingName: string | null;
  connectorName: string | null;
  iconKey: string | null;
  cardFaceUrl: string | null;
};

function buildCardFaceMeta(
  creditCards: Record<string, unknown>[],
  overlays: { icons: Record<string, FaceOverlay>; signed: Record<string, string> },
): Record<string, CardFaceMeta> {
  const meta: Record<string, CardFaceMeta> = {};
  for (const card of creditCards) {
    const id = String(card.id || "");
    if (!id) continue;
    const overlay = overlayFor(overlays.icons, id);
    const facePath = overlay.facePath || overlay.face_path || null;
    const cardFaceUrl = overlay.faceUrl || overlay.face_url
      || (facePath ? overlays.signed[facePath] : null)
      || null;
    meta[id] = {
      lastFour: lastFour(card),
      institutionName: String(card._connector || card.name || ""),
      marketingName: card.marketingName ? String(card.marketingName) : null,
      connectorName: card._connector ? String(card._connector) : null,
      iconKey: overlay.key || null,
      cardFaceUrl,
    };
  }
  // Propagate face URL to cards sharing the same iconKey (web/credit-cards parity)
  const faceByKey = new Map<string, string>();
  for (const m of Object.values(meta)) {
    if (m.iconKey && m.cardFaceUrl) faceByKey.set(m.iconKey, m.cardFaceUrl);
  }
  for (const m of Object.values(meta)) {
    if (!m.cardFaceUrl && m.iconKey && faceByKey.has(m.iconKey)) {
      m.cardFaceUrl = faceByKey.get(m.iconKey)!;
    }
  }
  return meta;
}

async function fetchBillsForAccount(
  client: PluggyClient,
  accountId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const d = await pluggyJson(client, "/bills", { params: { accountId } }) as {
      results?: Record<string, unknown>[];
    };
    return (d.results || []).map((b) => ({ ...b, accountId: b.accountId || accountId }));
  } catch (e) {
    console.error("[financial-moment] bills", accountId, e);
    return [];
  }
}

async function fetchAllTransactionsForAccount(
  client: PluggyClient,
  accountId: string,
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];
  let next: string | null = null;
  let guard = 0;
  const apiKey = await getPluggyApiKey(client.clientId, client.clientSecret);
  do {
    try {
      const url = next
        ? (next.startsWith("http") ? next : `${PLUGGY_API}${next}`)
        : `${PLUGGY_API}/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
      const res = await fetch(url, {
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
      });
      if (!res.ok) break;
      const data = await res.json() as {
        results?: Record<string, unknown>[];
        next?: string | null;
      };
      for (const t of data.results || []) {
        results.push({ ...t, accountId: t.accountId || accountId });
      }
      next = data.next || null;
    } catch (e) {
      console.error("[financial-moment] txs", accountId, e);
      break;
    }
    guard++;
  } while (next && guard < 30);
  return results;
}

async function loadCustomNames(
  client: PluggyClient,
): Promise<Record<string, string>> {
  try {
    const { data } = await client.supabase
      .from("profiles")
      .select("custom_account_names")
      .eq("id", client.userId)
      .maybeSingle();
    const names = data?.custom_account_names;
    if (!names || typeof names !== "object") return {};
    return Object.fromEntries(
      Object.entries(names as Record<string, unknown>)
        .filter(([, v]) => typeof v === "string" && String(v).trim())
        .map(([k, v]) => [k, String(v)]),
    );
  } catch {
    return {};
  }
}

function displayName(
  account: Record<string, unknown>,
  customNames: Record<string, string>,
): string {
  const id = String(account.id || "");
  if (id && customNames[id]) return customNames[id];
  return String(account.marketingName || account.name || "Conta");
}

export function serializeMoment(
  selectedMonth: string,
  // deno-lint-ignore no-explicit-any
  moment: any,
  monthsStatus: Record<string, { isPositive: boolean; net: number }> = {},
  cardFaceMeta: Record<string, CardFaceMeta> = {},
) {
  return {
    selectedMonth,
    salary: Number(moment.salary) || 0,
    monthsStatus: Object.fromEntries(
      Object.entries(monthsStatus).map(([ym, s]) => [
        ym,
        { isPositive: Boolean(s.isPositive), net: Number(s.net) || 0 },
      ]),
    ),
    receivables: {
      items: (moment.activeReceivables || []).map((
        // deno-lint-ignore no-explicit-any
        r: any,
      ) => ({
        personName: String(r.personName || ""),
        personColor: String(r.personColor || "#6366f1"),
        description: String(r.description || ""),
        amount: Number(r.amount) || 0,
        installmentNumber: Number(r.installmentNumber) || 1,
        totalInstallments: Number(r.totalInstallments) || 1,
        isPaid: Boolean(r.isPaid || r.paidAt),
        ownerLabel: r.ownerLabel ? String(r.ownerLabel) : null,
      })),
      total: Number(moment.receivablesTotal) || 0,
    },
    creditCards: {
      bills: (moment.activeBills || []).map((
        // deno-lint-ignore no-explicit-any
        b: any,
      ) => {
        const cardId = String(b.cardId || "");
        const face = cardFaceMeta[cardId] || {};
        return {
          cardId,
          cardName: String(b.cardName || "Cartão"),
          amount: Number(b.amount) || 0,
          dueDate: String(b.dueDate || ""),
          isPaid: Boolean(b.isPaid),
          isFallback: Boolean(b.isFallback),
          ownerLabel: b.ownerLabel ? String(b.ownerLabel) : null,
          lastFour: face.lastFour || "****",
          institutionName: face.institutionName || "",
          marketingName: face.marketingName || null,
          connectorName: face.connectorName || null,
          iconKey: face.iconKey || null,
          cardFaceUrl: face.cardFaceUrl || null,
        };
      }),
      total: Number(moment.creditCardsTotal) || 0,
    },
    automaticDebits: {
      items: (moment.activeAutomaticDebits || []).map((
        // deno-lint-ignore no-explicit-any
        d: any,
      ) => ({
        id: String(d.id || ""),
        description: String(d.description || "Débito automático"),
        amount: Number(d.amountAbs ?? Math.abs(Number(d.amount) || 0)),
        date: String(d.date || "").slice(0, 10),
        accountId: String(d.accountId || ""),
        accountName: String(d.accountName || "Conta conectada"),
        isPending: Boolean(d.isPending),
        ownerLabel: d.ownerLabel ? String(d.ownerLabel) : null,
      })),
      total: Number(moment.automaticDebitsTotal) || 0,
    },
    manualExpenses: {
      items: (moment.activeManual || []).map((
        // deno-lint-ignore no-explicit-any
        m: any,
      ) => ({
        id: String(m.id || ""),
        description: String(m.description || "Despesa manual"),
        amount: Math.abs(Number(m.amount) || 0),
        date: String(m.date || "").slice(0, 10),
        category: String(m.category || "other"),
        isPaid: Boolean(m.isPaid || m.is_paid),
        ownerLabel: m.ownerLabel ? String(m.ownerLabel) : (m.owner_label ? String(m.owner_label) : null),
      })),
      total: Number(moment.manualExpensesTotal) || 0,
    },
    totals: {
      income: Number(moment.entriesTotal) || 0,
      expenses: Number(moment.expensesTotal) || 0,
      accountsPayable: Number(moment.accountsPayableTotal) || 0,
      netBalance: Number(moment.netBalance) || 0,
    },
    status: {
      isPositive: (Number(moment.netBalance) || 0) >= 0,
      net: Number(moment.netBalance) || 0,
    },
  };
}

export async function handleFinancialMoment(
  client: PluggyClient,
  url: URL,
): Promise<Response> {
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse("Parâmetro month obrigatório no formato YYYY-MM", 400);
  }

  const customNames = await loadCustomNames(client);
  const [accounts, overlays] = await Promise.all([
    fetchAccounts(client),
    loadCardFaceOverlays(client),
  ]);

  // Manual accounts from Supabase
  const { data: manualAccounts } = await client.supabase
    .from("manual_accounts")
    .select("*")
    .eq("user_id", client.userId);

  for (const row of (manualAccounts || []) as Record<string, unknown>[]) {
    const id = String(row.id || "");
    if (!id) continue;
    const type = row.type === "CREDIT" ? "CREDIT" : "BANK";
    accounts.push({
      id,
      type,
      name: String(row.name || (type === "CREDIT" ? "Cartão manual" : "Conta manual")),
      number: String(row.number || ""),
      isManual: true,
      balance: type === "CREDIT" ? Number(row.bill_amount) || 0 : Number(row.balance) || 0,
    });
  }

  // Prefer profile custom names for display (also in overlays.names)
  const nameMap = { ...customNames, ...overlays.names };
  const creditCards = accounts
    .filter((a) => String(a.type).toUpperCase() === "CREDIT")
    .map((a) => ({
      ...a,
      name: displayName(a, nameMap),
    }));
  const bankAccounts = accounts.filter((a) => String(a.type).toUpperCase() === "BANK");
  const bankAccountIds = bankAccounts.map((a) => String(a.id));
  const bankAccountNameById: Record<string, string> = {};
  for (const a of bankAccounts) {
    bankAccountNameById[String(a.id)] = displayName(a, nameMap);
  }

  const cardFaceMeta = buildCardFaceMeta(creditCards, overlays);

  const cardIds = creditCards.map((c) => String(c.id));
  const [cardBillsNested, cardTxNested, bankTxNested] = await Promise.all([
    Promise.all(cardIds.map((id) => fetchBillsForAccount(client, id))),
    Promise.all(cardIds.map((id) => fetchAllTransactionsForAccount(client, id))),
    Promise.all(bankAccountIds.filter((id) => !String(accounts.find((a) => a.id === id)?.isManual)).map(
      (id) => fetchAllTransactionsForAccount(client, id),
    )),
  ]);

  const cardBills = cardBillsNested.flat();
  const cardTransactions = cardTxNested.flat();
  const bankTransactions = bankTxNested.flat();

  const { data: manuals } = await client.supabase
    .from("manual_transactions")
    .select("*")
    .eq("user_id", client.userId);

  const manualTxs = ((manuals || []) as Record<string, unknown>[]).map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount,
    date: row.date,
    category: row.category,
    accountId: row.account_id || "manual",
    isManual: true,
    isPaid: Boolean(row.is_paid),
    paidAt: row.paid_at || null,
  }));

  const { data: receivables } = await client.supabase
    .from("receivables")
    .select("*")
    .eq("user_id", client.userId);

  const salaries = await getMonthlySalaries(client.supabase, client.userId);

  const allTransactions = [...bankTransactions, ...manualTxs];
  const moment = computeFinancialMomentMonth({
    selectedMonth: month,
    salaries,
    receivables: receivables || [],
    transactions: allTransactions,
    creditCards,
    cardBills,
    cardTransactions,
    bankAccountIds,
    bankAccountNameById,
  });

  if (!moment) {
    return errorResponse("Não foi possível calcular o momento financeiro", 500);
  }

  const monthsStatus = computeFinancialMomentMonthsStatus({
    monthList: buildFinancialMomentMonthList(),
    salaries,
    receivables: receivables || [],
    transactions: allTransactions,
    creditCards,
    cardBills,
    cardTransactions,
    bankAccountIds,
    creditBillPeriod: moment.creditBillPeriod,
  });

  return jsonResponse(serializeMoment(month, moment, monthsStatus, cardFaceMeta));
}

export async function handleGetCurrentSalary(
  client: PluggyClient,
  url: URL,
): Promise<Response> {
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse("Parâmetro month obrigatório no formato YYYY-MM", 400);
  }

  const salaries = await getMonthlySalaries(client.supabase, client.userId);
  const currentAmount = resolveMonthSalary(salaries, month);
  const isDefault = salaries[month] === undefined || salaries[month] === null;

  return jsonResponse({ currentAmount, isDefault });
}

export async function handleSaveSalary(
  client: PluggyClient,
  req: Request,
): Promise<Response> {
  let body: { amount?: number; month?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("JSON inválido", 400);
  }

  const month = String(body.month || "");
  const amount = Number(body.amount);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse("month inválido", 400);
  }
  if (!Number.isFinite(amount)) {
    return errorResponse("amount inválido", 400);
  }

  const salaries = await getMonthlySalaries(client.supabase, client.userId);
  const next = withSavedMonthSalary(salaries, month, amount);
  await saveMonthlySalaries(client.supabase, client.userId, next);

  return jsonResponse({ ok: true, currentAmount: amount, month });
}

export async function handleToggleManualExpensePaid(
  client: PluggyClient,
  req: Request,
): Promise<Response> {
  let body: { expenseId?: string; isPaid?: boolean };
  try {
    body = await req.json();
  } catch {
    return errorResponse("JSON inválido", 400);
  }

  const expenseId = String(body.expenseId || "");
  if (!expenseId) return errorResponse("expenseId obrigatório", 400);
  const isPaid = Boolean(body.isPaid);

  // Own row first
  const ownUpdate = await client.supabase
    .from("manual_transactions")
    .update({
      is_paid: isPaid,
      paid_at: isPaid ? new Date().toISOString() : null,
    })
    .eq("id", expenseId)
    .eq("user_id", client.userId)
    .select("id");

  if (ownUpdate.error) {
    console.error("[financial-moment] toggle paid", ownUpdate.error);
    return errorResponse(ownUpdate.error.message, 500);
  }
  if ((ownUpdate.data || []).length > 0) {
    return jsonResponse({ ok: true, expenseId, isPaid });
  }

  // Partner row when joint link is active (service role)
  const { data: link } = await client.supabase.rpc("get_my_joint_link");
  const partnerId = link?.partner_id as string | undefined;
  if (!partnerId || link?.status !== "active") {
    return errorResponse("Despesa não encontrada", 404);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey) {
    return errorResponse("Sem permissão para editar despesa do parceiro", 403);
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.39.8");
  const service = createClient(supabaseUrl, serviceKey);

  const partnerUpdate = await service
    .from("manual_transactions")
    .update({
      is_paid: isPaid,
      paid_at: isPaid ? new Date().toISOString() : null,
    })
    .eq("id", expenseId)
    .eq("user_id", partnerId)
    .select("id");

  if (partnerUpdate.error) {
    console.error("[financial-moment] toggle partner paid", partnerUpdate.error);
    return errorResponse(partnerUpdate.error.message, 500);
  }
  if ((partnerUpdate.data || []).length === 0) {
    return errorResponse("Despesa não encontrada", 404);
  }

  return jsonResponse({ ok: true, expenseId, isPaid });
}
