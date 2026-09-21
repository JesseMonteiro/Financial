import { v1Err, v1Ok, featureFlags, sanitizeProfile } from "../middleware/http.ts";
import { requireAuth } from "../middleware/auth.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

type DomainTable =
  | "budgets"
  | "goals"
  | "receivables"
  | "manual_transactions"
  | "manual_accounts"
  | "meal_benefits"
  | "meal_benefit_purchases"
  | "purchase_categories";

const TABLE_MAP: Record<string, DomainTable> = {
  budgets: "budgets",
  goals: "goals",
  receivables: "receivables",
  "manual-transactions": "manual_transactions",
  "manual-accounts": "manual_accounts",
  "meal-benefits": "meal_benefits",
  "meal-benefit-purchases": "meal_benefit_purchases",
  "purchase-categories": "purchase_categories",
};

const DEFAULT_PURCHASE_CATEGORIES = [
  { key: "Food and drinks", label: "Alimentação", color: "#f97316", icon: "utensils", sort_order: 0 },
  { key: "Groceries", label: "Supermercados", color: "#fb923c", icon: "cart", sort_order: 1 },
  { key: "Housing", label: "Habitação", color: "#a855f7", icon: "home", sort_order: 2 },
  { key: "Transportation", label: "Transporte", color: "#0ea5e9", icon: "car", sort_order: 3 },
  { key: "Services", label: "Serviços", color: "#0284c7", icon: "wrench", sort_order: 4 },
  { key: "Shopping", label: "Compras", color: "#ec4899", icon: "bag", sort_order: 5 },
  { key: "Healthcare", label: "Saúde", color: "#10b981", icon: "heart", sort_order: 6 },
  { key: "Education", label: "Educação", color: "#eab308", icon: "graduationcap", sort_order: 7 },
  { key: "Leisure", label: "Lazer", color: "#f43f5e", icon: "ticket", sort_order: 8 },
  { key: "Digital services", label: "Serviços digitais", color: "#8b5cf6", icon: "tv", sort_order: 9 },
  { key: "Travel", label: "Viagens", color: "#06b6d4", icon: "airplane", sort_order: 10 },
  { key: "Income", label: "Renda", color: "#22c55e", icon: "banknote", sort_order: 11 },
  { key: "Investments", label: "Investimentos", color: "#3b82f6", icon: "chart", sort_order: 12 },
  { key: "Transfers", label: "Transferências", color: "#8b5cf6", icon: "creditcard", sort_order: 13 },
  { key: "Same person transfer", label: "Transferência entre mesma pessoa", color: "#6366f1", icon: "creditcard", sort_order: 14 },
  { key: "Loans and Financing", label: "Empréstimos e Financiamentos", color: "#ef4444", icon: "percent", sort_order: 15 },
  { key: "Bank fees", label: "Taxas bancárias", color: "#78716c", icon: "percent", sort_order: 16 },
  { key: "Taxes", label: "Impostos", color: "#dc2626", icon: "doc", sort_order: 17 },
  { key: "Insurance", label: "Seguro", color: "#2563eb", icon: "shield", sort_order: 18 },
  { key: "Donations", label: "Doações", color: "#14b8a6", icon: "handraised", sort_order: 19 },
  { key: "Gambling", label: "Jogos de azar", color: "#d946ef", icon: "sparkles", sort_order: 20 },
  { key: "Legal obligations", label: "Obrigações legais", color: "#64748b", icon: "doc", sort_order: 21 },
  { key: "Other", label: "Outros", color: "#64748b", icon: "ellipsis", sort_order: 22 },
];

async function listPurchaseCategories(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: unknown[] | null; error: { message: string } | null }> {
  const listed = await supabase
    .from("purchase_categories")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (listed.error) return listed;
  if (listed.data && listed.data.length > 0) return listed;

  const rows = DEFAULT_PURCHASE_CATEGORIES.map((row) => ({ ...row, user_id: userId }));
  const inserted = await supabase.from("purchase_categories").insert(rows).select("*");
  if (!inserted.error) {
    return { data: inserted.data ?? [], error: null };
  }

  const retry = await supabase
    .from("purchase_categories")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  return retry;
}

export async function handleDomainV1(
  req: Request,
  segments: string[],
): Promise<Response | null> {
  // segments: ["domain", resource, id?]
  if (segments[0] !== "domain") return null;
  const resource = segments[1];
  const id = segments[2];
  const method = req.method;

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    const err = e as Error & { status?: number };
    return v1Err(err.message, err.status || 401, req);
  }

  if (resource === "profile") {
    return await handleProfile(req, auth.supabase, auth.user.id, method);
  }

  if (resource === "feature-flags" || resource === undefined) {
    return null;
  }

  const table = TABLE_MAP[resource];
  if (!table) return v1Err(`Domain resource /${resource} not found`, 404, req);

  const body = ["POST", "PATCH", "PUT"].includes(method) ? await safeJson(req) : null;

  if (method === "GET" && !id) {
    if (table === "purchase_categories") {
      const { data, error } = await listPurchaseCategories(auth.supabase, auth.user.id);
      if (error) return v1Err(error.message, 500, req);
      return v1Ok(data ?? [], req);
    }
    const { data, error } = await auth.supabase.from(table).select("*").eq("user_id", auth.user.id);
    if (error) return v1Err(error.message, 500, req);
    return v1Ok(data ?? [], req);
  }

  if (method === "GET" && id) {
    const { data, error } = await auth.supabase.from(table).select("*").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
    if (error) return v1Err(error.message, 500, req);
    if (!data) return v1Err("Not found", 404, req);
    return v1Ok(data, req);
  }

  if (method === "POST") {
    const row = { ...(body as Record<string, unknown>), user_id: auth.user.id };
    if (table === "budgets") {
      delete row.id;
      const period = String(row.period || "monthly");
      row.period = ["daily", "weekly", "biweekly", "monthly"].includes(period)
        ? period
        : "monthly";
      const { data, error } = await auth.supabase
        .from(table)
        .upsert(row, { onConflict: "user_id,category" })
        .select("*")
        .single();
      if (error) return v1Err(error.message, 500, req);
      return v1Ok(data, req, 201);
    }
    const { data, error } = await auth.supabase
      .from(table)
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();
    if (error) return v1Err(error.message, 500, req);
    return v1Ok(data, req, 201);
  }

  if ((method === "PATCH" || method === "PUT") && id) {
    const patch = { ...(body as Record<string, unknown>) };
    if (table === "purchase_categories") {
      delete patch.key;
      delete patch.user_id;
    }
    const { data, error } = await auth.supabase
      .from(table)
      .update(patch)
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select("*")
      .single();
    if (error) return v1Err(error.message, 500, req);
    return v1Ok(data, req);
  }

  if (method === "DELETE" && id) {
    const { error } = await auth.supabase.from(table).delete().eq("id", id).eq("user_id", auth.user.id);
    if (error) return v1Err(error.message, 500, req);
    return v1Ok({ success: true }, req);
  }

  return v1Err("Method not allowed", 405, req);
}

async function handleProfile(
  req: Request,
  supabase: SupabaseClient,
  userId: string,
  method: string,
): Promise<Response> {
  const safeSelect =
    "id, display_name, theme, primary_color, density, animations_enabled, currency, monthly_salaries, telegram_chat_id, pluggy_item_ids, custom_account_names, custom_account_icons";

  if (method === "GET") {
    const { data, error } = await supabase.from("profiles").select(safeSelect).eq("id", userId).maybeSingle();
    if (error) return v1Err(error.message, 500, req);
    return v1Ok(sanitizeProfile((data ?? {}) as Record<string, unknown>), req);
  }

  if (method === "PATCH" || method === "PUT") {
    const body = await safeJson(req);
    const allowed = [
      "display_name",
      "theme",
      "primary_color",
      "density",
      "animations_enabled",
      "currency",
      "monthly_salaries",
      "custom_account_names",
      "custom_account_icons",
    ];
    const patch: Record<string, unknown> = { id: userId };
    for (const key of allowed) {
      if (body && typeof body === "object" && key in (body as object)) {
        patch[key] = (body as Record<string, unknown>)[key];
      }
    }
    // Never accept secrets from mobile client.
    delete patch.pluggy_client_secret;
    delete patch.pluggy_client_id;

    const { data, error } = await supabase.from("profiles").upsert(patch, { onConflict: "id" }).select(safeSelect).single();
    if (error) return v1Err(error.message, 500, req);
    return v1Ok(sanitizeProfile((data ?? {}) as Record<string, unknown>), req);
  }

  return v1Err("Method not allowed", 405, req);
}

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function handleFeatureFlagsV1(req: Request): Response {
  return v1Ok(featureFlags(), req);
}
