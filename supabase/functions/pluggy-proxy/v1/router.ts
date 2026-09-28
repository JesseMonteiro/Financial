import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { v1Ok, v1Err, featureFlags, CALCULATION_VERSION } from "../middleware/http.ts";
import { handleDomainV1, handleFeatureFlagsV1 } from "../routes/domain.ts";
import { requireAuth } from "../middleware/auth.ts";
import {
  asItemIdList,
  handleAccounts,
  handleBills,
  handleConnectors,
  handleInvestments,
  handleItems,
  handleLoans,
  handleTransactions,
  handleCategories,
  handleWebhooks,
  type PluggyClient,
} from "../handlers/pluggy.ts";
import { handleCreditCards } from "../handlers/creditCards.ts";
import { handleDashboard } from "../handlers/dashboard.ts";
import { handleAgenda } from "../handlers/agenda.ts";
import { handleBudgetScreen } from "../handlers/budgetScreen.ts";
import { handleReports } from "../handlers/reports.ts";
import { handleSubscriptions } from "../handlers/subscriptions.ts";
import {
  handleFinancialMoment,
  handleGetCurrentSalary,
  handleSaveSalary,
  handleToggleManualExpensePaid,
} from "../handlers/financialMoment.ts";
import { handleParseBill } from "../handlers/parseBill.ts";
import { handleJoint } from "../handlers/joint.ts";
import {
  handleTelegramWebhookRequest,
  handleEdgeChatbotMessage,
} from "../handlers/telegram/botHandler.ts";
import { handleDailySummaryRequest } from "../handlers/telegram/dailySummary.ts";

export interface V1Context {
  requestId: string;
}

/**
 * Versioned BFF router. Legacy unversioned paths remain in index.ts.
 */
export async function handleV1(
  req: Request,
  pathAfterV1: string,
  _ctx?: V1Context,
): Promise<Response | null> {
  const segments = pathAfterV1.split("/").filter(Boolean);
  const method = req.method;
  const url = new URL(req.url);

  if (segments.length === 0 || (segments[0] === "health" && method === "GET")) {
    return v1Ok(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        pluggyConfigured: Boolean(Deno.env.get("PLUGGY_CLIENT_ID") && Deno.env.get("PLUGGY_CLIENT_SECRET")),
        apiVersion: "v1",
        calculationVersion: CALCULATION_VERSION,
      },
      req,
    );
  }

  if (segments[0] === "feature-flags" && method === "GET") {
    return handleFeatureFlagsV1(req);
  }

  if (segments[0] === "domain") {
    return await handleDomainV1(req, segments);
  }

  if (segments[0] === "chatbot" && segments[1] === "telegram") {
    if (segments[2] === "webhook" && method === "POST") {
      return await handleTelegramWebhookRequest(req);
    }
    if (segments[2] === "daily-summary" && (method === "POST" || method === "GET")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, serviceKey);
      let body: unknown = {};
      if (method === "POST") {
        try { body = await req.json(); } catch (_) {}
      }
      return await handleDailySummaryRequest(req, supabase, body);
    }
  }

  // Authenticated Pluggy-backed resources under /v1/*
  const resource = segments[0];
  const actionOrId = segments[1];
  const subPath = segments[2];

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    const err = e as Error & { status?: number };
    return v1Err(err.message, err.status || 401, req);
  }

  let body: unknown = {};
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  if (resource === "joint") {
    const legacy = await handleJoint(auth.supabase, auth.user.id, method, actionOrId, body, url);
    return await wrapLegacyJsonAsV1(legacy, req);
  }

  if ((resource === "parse-bill" || resource === "parsebill") && method === "POST") {
    const legacy = await handleParseBill(body);
    return await wrapLegacyJsonAsV1(legacy, req);
  }

  if (resource === "chatbot") {
    if ((actionOrId === "message" || !actionOrId) && method === "POST") {
      const legacy = await handleEdgeChatbotMessage(body, auth.supabase, auth.user.id);
      return await wrapLegacyJsonAsV1(legacy, req);
    }
    if (actionOrId === "telegram" && subPath === "link-token" && method === "POST") {
      const { data: linkToken, error: rpcError } = await auth.supabase.rpc('generate_telegram_link_token', { p_user_id: auth.user.id });
      if (rpcError) return v1Err(`RPC Error: ${rpcError.message}`, 500, req);
      return v1Ok({ success: true, token: linkToken }, req);
    }
    return v1Err(`Route /v1/${segments.join('/')} not found`, 404, req);
  }


  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("pluggy_item_ids, pluggy_client_id, pluggy_client_secret")
    .eq("id", auth.user.id)
    .maybeSingle();

  const itemIds = asItemIdList(profile?.pluggy_item_ids);
  const clientId = profile?.pluggy_client_id || Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = profile?.pluggy_client_secret || Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return v1Err("Credenciais Pluggy não configuradas", 500, req);
  }

  const clientConfig: PluggyClient = {
    clientId,
    clientSecret,
    itemIds,
    userId: auth.user.id,
    supabase: auth.supabase,
  };

  try {
    let legacy: Response;
    switch (resource) {
      case "accounts":
        legacy = await handleAccounts(clientConfig, url, actionOrId);
        break;
      case "transactions":
        legacy = await handleTransactions(clientConfig, url, method, actionOrId, body);
        break;
      case "categories":
        legacy = await handleCategories(clientConfig);
        break;
      case "investments":
        legacy = await handleInvestments(clientConfig, url, actionOrId);
        break;
      case "loans":
        legacy = await handleLoans(clientConfig, url, actionOrId);
        break;
      case "bills":
        legacy = await handleBills(clientConfig, url, actionOrId, subPath);
        break;
      case "credit-cards":
        legacy = await handleCreditCards(clientConfig);
        break;
      case "dashboard":
        legacy = await handleDashboard(clientConfig, url);
        break;
      case "agenda":
        if (method !== "GET") return v1Err("Method not allowed", 405, req);
        legacy = await handleAgenda(clientConfig, url);
        break;
      case "budget-screen":
        if (method !== "GET") return v1Err("Method not allowed", 405, req);
        legacy = await handleBudgetScreen(clientConfig, url);
        break;
      case "reports":
        if (method !== "GET") return v1Err("Method not allowed", 405, req);
        legacy = await handleReports(clientConfig, url);
        break;
      case "subscriptions":
        if (method !== "GET") return v1Err("Method not allowed", 405, req);
        legacy = await handleSubscriptions(clientConfig);
        break;
      case "financial-moment":
        if (actionOrId === "salary") {
          if (method === "GET") legacy = await handleGetCurrentSalary(clientConfig, url);
          else if (method === "POST") legacy = await handleSaveSalary(clientConfig, body);
          else return v1Err("Method not allowed", 405, req);
        } else if (actionOrId === "toggle-manual-expense") {
          if (method !== "POST") return v1Err("Method not allowed", 405, req);
          legacy = await handleToggleManualExpensePaid(clientConfig, body);
        } else {
          if (method !== "GET") return v1Err("Method not allowed", 405, req);
          legacy = await handleFinancialMoment(clientConfig, url);
        }
        break;
      case "connectors":
        legacy = await handleConnectors(clientConfig, url, actionOrId);
        break;
      case "items":
        legacy = await handleItems(clientConfig, url, method, body, actionOrId);
        break;
      case "webhooks":
        legacy = await handleWebhooks(clientConfig, url, method, body, actionOrId);
        break;
      default:
        return null;
    }
    return await wrapLegacyJsonAsV1(legacy, req);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : 500;
    return v1Err(message, status, req);
  }
}

export async function wrapLegacyJsonAsV1(legacyResponse: Response, req: Request): Promise<Response> {
  const status = legacyResponse.status;
  const text = await legacyResponse.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (status >= 400) {
    const message =
      typeof parsed === "object" && parsed && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `Error ${status}`;
    return v1Err(message, status, req);
  }
  return v1Ok(parsed, req, status);
}

export { featureFlags };
