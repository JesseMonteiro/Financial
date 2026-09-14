import { v1Err, v1Ok, featureFlags, sanitizeProfile } from "../middleware/http.ts";
import { requireAuth } from "../middleware/auth.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

type DomainTable =
  | "budgets"
  | "goals"
  | "receivables"
  | "manual_transactions"
  | "manual_accounts";

const TABLE_MAP: Record<string, DomainTable> = {
  budgets: "budgets",
  goals: "goals",
  receivables: "receivables",
  "manual-transactions": "manual_transactions",
  "manual-accounts": "manual_accounts",
};

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
    const conflict = table === "budgets" ? "user_id,category" : row.id ? "id" : null;
    const query = conflict
      ? auth.supabase.from(table).upsert(row, { onConflict: conflict }).select("*").single()
      : auth.supabase.from(table).insert(row).select("*").single();
    const { data, error } = await query;
    if (error) return v1Err(error.message, 500, req);
    return v1Ok(data, req, 201);
  }

  if ((method === "PATCH" || method === "PUT") && id) {
    const { data, error } = await auth.supabase
      .from(table)
      .update(body as Record<string, unknown>)
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
      "telegram_chat_id",
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
