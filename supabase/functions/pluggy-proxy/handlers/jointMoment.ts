/**
 * Joint financial moment — same aggregation as web JointFinancialMoment.
 * Optimized for Edge Function CPU/memory limits (HTTP 546 = WORKER_RESOURCE_LIMIT).
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { errorResponse, jsonResponse } from "../middleware/http.ts";
import { serializeMoment } from "./financialMoment.ts";
import {
  buildFinancialMomentMonthList,
  buildCreditBillPeriodByCardId,
  computeFinancialMomentMonth,
  computeFinancialMomentMonthsStatus,
} from "../utils/financialMomentMonth.ts";
import {
  getMonthlySalaries,
  resolveMonthSalary,
  withSavedMonthSalary,
} from "../utils/monthSalary.ts";
import { asItemIdList, pluggyJson } from "./pluggy.ts";
import { momentItemsFor } from "../utils/mealBenefits.ts";

type AnyRec = Record<string, unknown>;

type FaceOverlay = {
  key?: string;
  facePath?: string;
  face_path?: string;
  faceUrl?: string;
  face_url?: string;
};

/**
 * Lean Pluggy load for Edge joint moment (avoids HTTP 546).
 * Credit: 1 page/account (projections). Bank: 1 page/account (auto-debits).
 * Skips /items connector round-trips used only for face styling.
 */
async function loadMemberPluggyBundle(
  profile: {
    pluggy_item_ids?: unknown;
    pluggy_client_id?: string | null;
    pluggy_client_secret?: string | null;
  },
): Promise<{
  accounts: AnyRec[];
  transactions: AnyRec[];
  billsByAccount: Record<string, AnyRec[]>;
}> {
  const itemIds = asItemIdList(profile?.pluggy_item_ids);
  const clientId = profile?.pluggy_client_id || Deno.env.get("PLUGGY_CLIENT_ID") || "";
  const clientSecret = profile?.pluggy_client_secret || Deno.env.get("PLUGGY_CLIENT_SECRET") || "";
  if (!clientId || !clientSecret || itemIds.length === 0) {
    return { accounts: [], transactions: [], billsByAccount: {} };
  }
  const creds = { clientId, clientSecret };

  const accountChunks = await Promise.all(itemIds.map(async (itemId) => {
    try {
      const d = await pluggyJson(creds, "/accounts", { params: { itemId } }) as {
        results?: AnyRec[];
      };
      return (d.results || []).map((acc) => ({
        ...acc,
        itemId: acc.itemId || itemId,
      }));
    } catch (e) {
      console.warn("[joint-moment] accounts", itemId, e);
      return [] as AnyRec[];
    }
  }));
  const accounts = accountChunks.flat();

  const creditAccounts = accounts.filter((a) => String(a.type).toUpperCase() === "CREDIT");
  const bankAccounts = accounts.filter((a) => String(a.type).toUpperCase() === "BANK");

  const [txLists, billEntries] = await Promise.all([
    Promise.all(
      [...creditAccounts, ...bankAccounts].map(async (acc) => {
        const accountId = String(acc.id || "");
        if (!accountId) return [] as AnyRec[];
        try {
          const d = await pluggyJson(creds, "/v2/transactions", {
            params: { accountId },
          }) as { results?: AnyRec[] };
          return (d.results || []).map((t) => ({
            ...t,
            accountId: String(t.accountId || accountId),
          }));
        } catch (e) {
          console.warn("[joint-moment] txs", accountId, e);
          return [] as AnyRec[];
        }
      }),
    ),
    Promise.all(creditAccounts.map(async (acc) => {
      const accountId = String(acc.id || "");
      if (!accountId) return [accountId, [] as AnyRec[]] as const;
      try {
        const d = await pluggyJson(creds, "/bills", { params: { accountId } }) as {
          results?: AnyRec[];
        } | AnyRec[];
        const list = Array.isArray(d) ? d : (d.results || []);
        return [
          accountId,
          list.map((b) => ({ ...b, accountId: String(b.accountId || accountId) })),
        ] as const;
      } catch (e) {
        console.warn("[joint-moment] bills", accountId, e);
        return [accountId, [] as AnyRec[]] as const;
      }
    })),
  ]);

  const transactions = txLists.flat();
  const billsByAccount: Record<string, AnyRec[]> = {};
  for (const [id, bills] of billEntries) {
    if (id) billsByAccount[id] = bills;
  }
  return { accounts, transactions, billsByAccount };
}

function lastFour(account: AnyRec): string {
  const raw = String(
    account.number ?? (account.creditData as { number?: string } | undefined)?.number ?? "",
  );
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4);
  return "****";
}

async function signFacePaths(
  service: SupabaseClient,
  icons: Record<string, FaceOverlay>,
): Promise<Record<string, string>> {
  const paths = [...new Set(
    Object.values(icons)
      .map((o) => o?.facePath || o?.face_path)
      .filter((p): p is string => Boolean(p)),
  )];
  const signed: Record<string, string> = {};
  await Promise.all(paths.map(async (path) => {
    try {
      const { data } = await service.storage
        .from("account-icons")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (data?.signedUrl) signed[path] = data.signedUrl;
    } catch (e) {
      console.warn("[joint-moment] sign face", path, e);
    }
  }));
  return signed;
}

function buildJointCardFaceMeta(
  creditCards: AnyRec[],
  iconOverlays: Record<string, FaceOverlay>,
  signed: Record<string, string>,
): Record<string, {
  lastFour: string;
  institutionName: string;
  marketingName: string | null;
  connectorName: string | null;
  iconKey: string | null;
  cardFaceUrl: string | null;
}> {
  const meta: Record<string, {
    lastFour: string;
    institutionName: string;
    marketingName: string | null;
    connectorName: string | null;
    iconKey: string | null;
    cardFaceUrl: string | null;
  }> = {};

  for (const card of creditCards) {
    const id = String(card.id || "");
    if (!id) continue;
    const overlay = iconOverlays[id] || {};
    const facePath = overlay.facePath || overlay.face_path || null;
    const cardFaceUrl = overlay.faceUrl || overlay.face_url
      || (facePath ? signed[facePath] : null)
      || null;
    const connector = card._connector ? String(card._connector) : null;
    meta[id] = {
      lastFour: lastFour(card),
      institutionName: connector
        || String(
          (card.creditData as { institutionName?: string } | undefined)?.institutionName
            || card.name
            || "",
        ),
      marketingName: card.marketingName ? String(card.marketingName) : null,
      connectorName: connector,
      iconKey: overlay.key ? String(overlay.key) : null,
      cardFaceUrl: cardFaceUrl ? String(cardFaceUrl) : null,
    };
  }

  // Same product face shared across members / cards with the same catalog key
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

function serviceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(supabaseUrl, serviceKey || Deno.env.get("SUPABASE_ANON_KEY") || "");
}

export async function handleJointFinancialMoment(
  supabaseClient: SupabaseClient,
  userId: string,
  url: URL,
): Promise<Response> {
  try {
    return await handleJointFinancialMomentInner(supabaseClient, userId, url);
  } catch (err) {
    console.error("[joint-moment] fatal", err);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`Falha ao calcular momento conjunto: ${message}`, 500);
  }
}

async function handleJointFinancialMomentInner(
  supabaseClient: SupabaseClient,
  userId: string,
  url: URL,
): Promise<Response> {
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return errorResponse("Parâmetro month obrigatório no formato YYYY-MM", 400);
  }

  // Same aggregation inputs as web JointFinancialMoment (moment-data + client compute).

  const { data: link, error: linkError } = await supabaseClient.rpc("get_my_joint_link");
  if (linkError) return errorResponse(linkError.message, 500);
  if (!link || link.status !== "active" || !link.partner_id) {
    return errorResponse("Nenhuma conta conjunta ativa", 404);
  }

  const memberIds = [userId, link.partner_id as string];
  const service = serviceClient();

  const [
    profilesRes,
    manualsRes,
    manualAccountsRes,
    receivablesRes,
    mealBenefitsRes,
    mealPurchasesRes,
  ] = await Promise.all([
    service
      .from("profiles")
      .select(
        "id, display_name, pluggy_item_ids, pluggy_client_id, pluggy_client_secret, monthly_salaries, custom_account_names, custom_account_icons",
      )
      .in("id", memberIds),
    service.from("manual_transactions").select("*").in("user_id", memberIds),
    service.from("manual_accounts").select("*").in("user_id", memberIds),
    service.from("receivables").select("*").in("user_id", memberIds),
    service.from("meal_benefits").select("*").in("user_id", memberIds),
    service.from("meal_benefit_purchases").select("*").in("user_id", memberIds),
  ]);

  if (profilesRes.error) return errorResponse(profilesRes.error.message, 500);

  const profiles = profilesRes.data || [];
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const members = memberIds.map((id) => ({
    id,
    displayName: profileById[id]?.display_name || (id === userId ? "Você" : "Parceiro"),
    monthlySalaries: (profileById[id]?.monthly_salaries || {}) as Record<string, number>,
  }));
  const labelById = Object.fromEntries(members.map((m) => [m.id, m.displayName]));

  // Parallel Pluggy loads for both members — same bundle shape as web moment-data.
  const bundles = await Promise.all(memberIds.map(async (id) => {
    const label = labelById[id] || "Usuário";
    const profile = profileById[id] || {};
    const icons = (profile.custom_account_icons && typeof profile.custom_account_icons === "object")
      ? profile.custom_account_icons as Record<string, AnyRec>
      : {};
    const names = (profile.custom_account_names && typeof profile.custom_account_names === "object")
      ? profile.custom_account_names as Record<string, string>
      : {};
    const bundle = await loadMemberPluggyBundle(profile);
    return { id, label, icons, names, bundle };
  }));

  const accounts: AnyRec[] = [];
  const pluggyTxs: AnyRec[] = [];
  const billsByAccount: Record<string, AnyRec[]> = {};
  const seenAccountIds = new Set<string>();
  const iconOverlays: Record<string, AnyRec> = {};

  for (const { id, label, icons, names, bundle } of bundles) {
    Object.assign(iconOverlays, icons);
    for (const acc of bundle.accounts) {
      const accId = String(acc.id || "");
      if (!accId || seenAccountIds.has(accId)) continue;
      seenAccountIds.add(accId);
      const displayName = names[accId] || String(acc.marketingName || acc.name || "Conta");
      accounts.push({
        ...acc,
        originalName: acc.originalName || acc.name,
        name: displayName,
        ownerUserId: id,
        ownerLabel: label,
      });
    }
    for (const tx of bundle.transactions) {
      pluggyTxs.push({ ...tx, ownerUserId: id, ownerLabel: label });
    }
    for (const [accId, bills] of Object.entries(bundle.billsByAccount)) {
      billsByAccount[accId] = bills.map((b) => ({
        ...b,
        accountId: String(b.accountId || accId),
        ownerUserId: id,
        ownerLabel: label,
      }));
    }
  }

  for (const row of (manualAccountsRes.data || []) as AnyRec[]) {
    const id = String(row.id || "");
    if (!id || seenAccountIds.has(id)) continue;
    seenAccountIds.add(id);
    const type = row.type === "CREDIT" ? "CREDIT" : "BANK";
    const institution = String(row.institution_name || "Manual");
    const billAmount = Number(row.bill_amount) || 0;
    const bankBalance = Number(row.balance) || 0;
    const dueDayRaw = row.bill_due_day == null || row.bill_due_day === ""
      ? null
      : Number(row.bill_due_day);
    const dueDay = Number.isFinite(dueDayRaw) ? dueDayRaw : null;
    const creditLimit = Number(row.credit_limit) || 0;
    const ownerId = String(row.user_id || "");
    const ownerLabel = labelById[ownerId] || "Usuário";
    accounts.push({
      id,
      type,
      name: String(row.name || (type === "CREDIT" ? "Cartão manual" : "Conta manual")),
      number: String(row.number || ""),
      balance: type === "CREDIT" ? billAmount : bankBalance,
      isManual: true,
      ownerUserId: ownerId,
      ownerLabel,
      bankData: type === "BANK" ? { institutionName: institution } : undefined,
      creditData: type === "CREDIT"
        ? {
          institutionName: institution,
          creditLimit,
          availableCreditLimit: creditLimit > 0 ? Math.max(0, creditLimit - billAmount) : 0,
        }
        : undefined,
    });
    if (type === "CREDIT") {
      const now = new Date();
      let year = now.getFullYear();
      let monthIdx = now.getMonth();
      const day = Math.min(31, Math.max(1, dueDay || 10));
      if (now.getDate() > day) {
        monthIdx += 1;
        if (monthIdx > 11) {
          monthIdx = 0;
          year += 1;
        }
      }
      const last = new Date(year, monthIdx + 1, 0).getDate();
      const dueDate =
        `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
      billsByAccount[id] = [{
        id: `manual-bill-${id}-${dueDate.slice(0, 7)}`,
        accountId: id,
        dueDate,
        totalAmount: billAmount,
        isManual: true,
        ownerUserId: ownerId,
        ownerLabel,
      }];
    }
  }

  const creditCards = accounts.filter((a) => String(a.type).toUpperCase() === "CREDIT");
  const bankAccounts = accounts.filter((a) => String(a.type).toUpperCase() === "BANK");
  const bankAccountIds = bankAccounts.map((a) => String(a.id));
  const bankAccountNameById: Record<string, string> = {};
  for (const a of bankAccounts) {
    bankAccountNameById[String(a.id)] = String(a.name || "Conta");
  }

  const cardBills: AnyRec[] = [];
  for (const card of creditCards) {
    const list = billsByAccount[String(card.id)] || [];
    cardBills.push(...list.map((b) => ({ ...b, accountId: String(b.accountId || card.id) })));
  }

  const cardIds = new Set(creditCards.map((c) => String(c.id)));
  const cardTransactions = pluggyTxs.filter((t) =>
    cardIds.has(String(t.accountId))
  );

  // Match web jointStore: all manuals (no date window) + camelCase installment history.
  const manualsNorm = ((manualsRes.data || []) as AnyRec[]).map((row) => ({
    id: row.id,
    description: row.description,
    amount: row.amount,
    date: row.date,
    category: row.category,
    accountId: row.account_id || "manual",
    isManual: true,
    isPaid: Boolean(row.is_paid),
    paidAt: row.paid_at || null,
    ownerUserId: row.user_id,
    ownerLabel: labelById[String(row.user_id)] || "Usuário",
  }));

  const receivablesNorm = ((receivablesRes.data || []) as AnyRec[]).map((row) => {
    const historyRaw = row.installment_history || row.installmentHistory || [];
    const installmentHistory = Array.isArray(historyRaw)
      ? historyRaw.map((inst: AnyRec) => ({
        ...inst,
        dueDate: inst.dueDate || inst.due_date,
        amount: Number(inst.amount) || 0,
        installmentNumber: inst.installmentNumber || inst.installment_number,
        paidAt: inst.paidAt || inst.paid_at || null,
      }))
      : [];
    return {
      ...row,
      personName: row.person_name || row.personName,
      personColor: row.person_color || row.personColor,
      installments: row.installments,
      installmentHistory,
      ownerUserId: row.user_id,
      ownerLabel: labelById[String(row.user_id)] || "Usuário",
    };
  });

  // Match web: all Pluggy txs + manuals (automaticDebits filters to bankAccountIds).
  const allTransactions = [...pluggyTxs, ...manualsNorm];

  const combinedSalary = members.reduce(
    (sum, m) => sum + resolveMonthSalary(m.monthlySalaries || {}, month),
    0,
  );

  const salariesByMonth: Record<string, number> = {};
  const monthList = buildFinancialMomentMonthList();
  for (const m of monthList) {
    salariesByMonth[m.ym] = members.reduce(
      (sum, mem) => sum + resolveMonthSalary(mem.monthlySalaries || {}, m.ym),
      0,
    );
  }
  salariesByMonth[month] = combinedSalary;

  // Same as web JointFinancialMoment: one period per card. A shared
  // selectedCardId:'all' mix collides installment series (Amazon/Inter of both
  // members) and drops ~R$16k of future bills — chips stay too high every month.
  const periodByCardId = buildCreditBillPeriodByCardId(
    creditCards,
    cardTransactions,
    cardBills,
  );

  const moment = computeFinancialMomentMonth({
    selectedMonth: month,
    salary: combinedSalary,
    salaries: salariesByMonth,
    receivables: receivablesNorm,
    transactions: allTransactions,
    creditCards,
    cardBills,
    cardTransactions,
    bankAccountIds,
    bankAccountNameById,
    periodByCardId,
  });

  if (!moment) {
    return errorResponse("Não foi possível calcular o momento financeiro conjunto", 500);
  }

  const monthsStatus = computeFinancialMomentMonthsStatus({
    monthList,
    salaries: salariesByMonth,
    receivables: receivablesNorm,
    transactions: allTransactions,
    creditCards,
    cardBills,
    cardTransactions,
    bankAccountIds,
    periodByCardId,
  });

  // Face signing is nice-to-have — never block the moment payload on storage.
  let cardFaceMeta: Record<string, {
    lastFour: string;
    institutionName: string;
    marketingName: string | null;
    connectorName: string | null;
    iconKey: string | null;
    cardFaceUrl: string | null;
  }> = {};
  try {
    const signedFaces = await signFacePaths(service, iconOverlays as Record<string, FaceOverlay>);
    cardFaceMeta = buildJointCardFaceMeta(
      creditCards,
      iconOverlays as Record<string, FaceOverlay>,
      signedFaces,
    );
  } catch (e) {
    console.warn("[joint-moment] card faces", e);
    cardFaceMeta = buildJointCardFaceMeta(
      creditCards,
      iconOverlays as Record<string, FaceOverlay>,
      {},
    );
  }

  const serialized = serializeMoment(
    month,
    moment,
    monthsStatus,
    cardFaceMeta,
    {
      items: momentItemsFor(
        ((mealBenefitsRes.data || []) as AnyRec[]).map((row) => ({
          ...row,
          ownerLabel: labelById[String(row.user_id)] || "Usuário",
        })),
        (mealPurchasesRes.data || []) as AnyRec[],
        month,
      ),
    },
  );

  return jsonResponse({
    link: {
      id: String(link.id || ""),
      status: String(link.status || "active"),
      partnerId: link.partner_id ? String(link.partner_id) : null,
      partnerDisplayName: link.partner_display_name ? String(link.partner_display_name) : null,
      inviteToken: null,
      inviteExpiresAt: null,
    },
    members: members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      salary: resolveMonthSalary(m.monthlySalaries || {}, month),
      isCurrentUser: m.id === userId,
    })),
    ...serialized,
  });
}

export async function handleJointMemberSalary(
  supabaseClient: SupabaseClient,
  userId: string,
  body: unknown,
): Promise<Response> {
  const parsed = (body && typeof body === "object") ? body as {
    userId?: string;
    month?: string;
    amount?: number;
  } : {};

  const targetUserId = String(parsed.userId || "").trim();
  const month = String(parsed.month || "");
  const amount = Number(parsed.amount);
  if (!targetUserId) return errorResponse("userId obrigatório", 400);
  if (!/^\d{4}-\d{2}$/.test(month)) return errorResponse("month inválido", 400);
  if (!Number.isFinite(amount)) return errorResponse("amount inválido", 400);

  let current = await getMonthlySalaries(supabaseClient, targetUserId);
  if (Object.keys(current).length === 0 && targetUserId !== userId) {
    const service = serviceClient();
    current = await getMonthlySalaries(service, targetUserId);
  }
  const next = withSavedMonthSalary(current, month, amount);

  const { data, error } = await supabaseClient.rpc("update_linked_monthly_salaries", {
    p_target_user_id: targetUserId,
    p_salaries: next,
  });
  if (error) return errorResponse(error.message, 400);
  if (!data?.success) return errorResponse(data?.message || "Falha ao salvar salário", 400);

  return jsonResponse({ ok: true, userId: targetUserId, month, amount });
}
