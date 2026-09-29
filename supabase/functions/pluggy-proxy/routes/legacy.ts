import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { errorResponse, jsonResponse, featureFlags } from "../middleware/http.ts";
import { verifyPluggyWebhook } from "../middleware/webhooks.ts";
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
  resolvePluggyItemId,
  type PluggyClient,
} from "../handlers/pluggy.ts";
import { handleCreditCards } from "../handlers/creditCards.ts";
import {
  handleFinancialMoment,
  handleSaveSalary,
  handleGetCurrentSalary,
  handleToggleManualExpensePaid,
} from "../handlers/financialMoment.ts";
import { handleDashboard } from "../handlers/dashboard.ts";
import { handleAgenda } from "../handlers/agenda.ts";
import { handleBudgetScreen } from "../handlers/budgetScreen.ts";
import { handleReports } from "../handlers/reports.ts";
import { handleSubscriptions } from "../handlers/subscriptions.ts";
import { handleParseBill } from "../handlers/parseBill.ts";
import { handleJoint } from "../handlers/joint.ts";
import {
  handleTelegramWebhookRequest,
  handleEdgeChatbotMessage,
} from "../handlers/telegram/botHandler.ts";
import { handleDailySummaryRequest } from "../handlers/telegram/dailySummary.ts";
import { handleSyncStatus, handleSyncRefresh } from "../handlers/sync.ts";
import { processWebhookEvent } from "../handlers/webhookProcessor.ts";
import { syncItemToCache } from "../services/syncEngine.ts";

function resolvePluggyCredentials(profile?: {
  pluggy_client_id?: string | null;
  pluggy_client_secret?: string | null;
}): { clientId: string; clientSecret: string } | null {
  if (profile?.pluggy_client_id && profile?.pluggy_client_secret) {
    return { clientId: profile.pluggy_client_id, clientSecret: profile.pluggy_client_secret };
  }
  const envId = Deno.env.get("PLUGGY_CLIENT_ID");
  const envSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };
  return null;
}

export async function handleLegacyRequest(
  req: Request,
  _path: string,
  segments: string[],
): Promise<Response> {
  const resource = segments[0] ?? "";
  const actionOrId = segments[1];
  const subPath = segments[2];
  const method = req.method;
  const url = new URL(req.url);

  // 1. Chatbot & Telegram routes
  if (resource === "chatbot") {
    if ((actionOrId === "message" || !actionOrId) && method === "POST") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return errorResponse("Missing authorization header", 401);
      const token = authHeader.split(" ")[1];
      if (!token) return errorResponse("Invalid authorization format", 401);

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !user) return errorResponse("Invalid or expired authentication token", 401);

      let body: unknown = {};
      try { body = await req.json(); } catch (_) {}
      return await handleEdgeChatbotMessage(body, supabaseClient, user.id);
    }

    if (actionOrId === "telegram" && subPath === "webhook" && method === "POST") {
      return await handleTelegramWebhookRequest(req);
    }

    if (actionOrId === "telegram" && subPath === "link-token" && method === "POST") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return errorResponse("Missing authorization header", 401);
      const token = authHeader.split(" ")[1];
      if (!token) return errorResponse("Invalid authorization format", 401);

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);

      const { data: { user }, error: authError } = await serviceRoleClient.auth.getUser(token);
      if (authError || !user) return errorResponse("Invalid or expired authentication token", 401);

      const { data: linkToken, error: rpcError } = await serviceRoleClient.rpc(
        "generate_telegram_link_token",
        { p_user_id: user.id },
      );
      if (rpcError) return errorResponse(`RPC Error: ${rpcError.message}`, 500);
      return jsonResponse({ success: true, token: linkToken });
    }

    if (actionOrId === "telegram" && subPath === "daily-summary" && (method === "POST" || method === "GET")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);

      let body: unknown = {};
      if (method === "POST") {
        try { body = await req.json(); } catch (_) {}
      } else {
        body = {
          date: url.searchParams.get("date") || undefined,
          userId: url.searchParams.get("userId") || undefined,
          dryRun: url.searchParams.get("dryRun") === "true",
          force: url.searchParams.get("force") === "true",
        };
      }
      return await handleDailySummaryRequest(req, serviceRoleClient, body);
    }

    return errorResponse(`Route /${segments.join("/")} not found`, 404);
  }

  // 2. Webhook receiver
  if (resource === "webhooks" && method === "POST" && !actionOrId) {
    if (!verifyPluggyWebhook(req)) {
      return errorResponse("Assinatura ou segredo de webhook inválido", 403);
    }
    try {
      const payload = await req.json();
      const bgPromise = processWebhookEvent(serviceRoleClient, payload).catch((err) => {
        console.error("[legacy webhook] Background processing error:", err);
      });
      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
        // @ts-ignore
        EdgeRuntime.waitUntil(bgPromise);
      }
      return jsonResponse({ received: true, status: "processing" });
    } catch {
      return jsonResponse({ received: true });
    }
  }

  // 3. Health check
  if (resource === "health") {
    const configured = Boolean(Deno.env.get("PLUGGY_CLIENT_ID") && Deno.env.get("PLUGGY_CLIENT_SECRET"));
    return jsonResponse({
      status: "ok",
      timestamp: new Date().toISOString(),
      pluggyConfigured: configured,
    });
  }

  // 4. Feature flags
  if (resource === "feature-flags" && method === "GET") {
    return jsonResponse(featureFlags());
  }

  // 5. Authenticated endpoints
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return errorResponse("Missing authorization header", 401);
  const token = authHeader.split(" ")[1];
  if (!token) return errorResponse("Invalid authorization format", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
  if (authError || !user) return errorResponse("Invalid or expired authentication token", 401);

  let body: unknown = {};
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    try { body = await req.json(); } catch (_) {}
  }

  if (resource === "joint") {
    return await handleJoint(supabaseClient, user.id, method, actionOrId, body, url);
  }

  if ((resource === "parse-bill" || resource === "parsebill") && method === "POST") {
    return await handleParseBill(body);
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("pluggy_item_ids, pluggy_client_id, pluggy_client_secret")
    .eq("id", user.id)
    .maybeSingle();

  let itemIds = asItemIdList(profile?.pluggy_item_ids);

  if (resource === "items" && actionOrId === "register" && method === "POST") {
    const itemIdToRegister = (body as { itemId?: string })?.itemId;
    if (!itemIdToRegister || typeof itemIdToRegister !== "string") {
      return errorResponse("itemId é obrigatório", 400);
    }

    const credsEarly = resolvePluggyCredentials(profile);
    if (!credsEarly) {
      return errorResponse("Credenciais Pluggy não configuradas", 400);
    }

    let resolved;
    try {
      resolved = await resolvePluggyItemId(credsEarly, itemIdToRegister);
    } catch (e) {
      const err = e as Error & { status?: number };
      return errorResponse(err.message || "ID inválido", err.status || 400);
    }

    if (resolved.remappedFromAccount) {
      return errorResponse(
        `O ID informado é de uma conta Pluggy, não de uma conexão. Use o itemId ${resolved.itemId}` +
          (resolved.accountName ? ` (conta: ${resolved.accountName})` : "") +
          ".",
        400,
      );
    }

    const newItemIds = Array.from(new Set([...itemIds, resolved.itemId]));
    const { error: updateErr } = await supabaseClient
      .from("profiles")
      .upsert({ id: user.id, pluggy_item_ids: newItemIds }, { onConflict: "id" });

    if (updateErr) return errorResponse(`Failed to register item: ${updateErr.message}`, 500);

    // Initial background sync to populate cache immediately
    const clientConfig: PluggyClient = {
      clientId: credsEarly.clientId,
      clientSecret: credsEarly.clientSecret,
      itemIds: newItemIds,
      userId: user.id,
      supabase: supabaseClient,
    };
    const bgSync = syncItemToCache(clientConfig, resolved.itemId).catch((err) => {
      console.warn(`[items/register] Initial cache sync failed for ${resolved.itemId}:`, err);
    });
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(bgSync);
    }

    return jsonResponse({
      success: true,
      message: "Item registrado com sucesso no perfil.",
      itemIds: newItemIds,
    });
  }

  if (resource === "items" && actionOrId === "sync" && method === "POST") {
    const raw = (body as { itemIds?: unknown })?.itemIds;
    const incoming = Array.isArray(raw)
      ? asItemIdList(raw)
      : typeof raw === "string"
        ? asItemIdList(
            raw
              .split(/[\s,;]+/)
              .map((s) => s.trim())
              .filter(Boolean),
          )
        : [];

    const credsEarly = resolvePluggyCredentials(profile);
    if (!credsEarly && incoming.length) {
      return errorResponse("Credenciais Pluggy não configuradas", 400);
    }

    const resolvedIds: string[] = [];
    const rejected: Array<{ id: string; reason: string; resolvedItemId?: string }> = [];
    for (const id of Array.from(new Set(incoming))) {
      try {
        const resolved = await resolvePluggyItemId(credsEarly!, id);
        resolvedIds.push(resolved.itemId);
        if (resolved.remappedFromAccount) {
          rejected.push({
            id,
            reason: `ID de conta remapeado para conexão ${resolved.itemId}`,
            resolvedItemId: resolved.itemId,
          });
        }
      } catch (e) {
        rejected.push({ id, reason: (e as Error).message || "ID inválido" });
      }
    }

    const uniqueIds = Array.from(new Set(resolvedIds));
    const { error: updateErr } = await supabaseClient
      .from("profiles")
      .upsert({ id: user.id, pluggy_item_ids: uniqueIds }, { onConflict: "id" });

    if (updateErr) return errorResponse(`Failed to sync items: ${updateErr.message}`, 500);
    itemIds = uniqueIds;
    return jsonResponse({
      success: true,
      message: `${uniqueIds.length} conexão(ões) vinculada(s) ao perfil.`,
      itemIds: uniqueIds,
      rejected: rejected.length ? rejected : undefined,
    });
  }

  const clientId = profile?.pluggy_client_id || Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = profile?.pluggy_client_secret || Deno.env.get("PLUGGY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return errorResponse(
      "Credenciais Pluggy não configuradas. Defina Client ID/Secret em Configurações ou nas variáveis de ambiente da Edge Function.",
      500,
    );
  }

  const clientConfig: PluggyClient = {
    clientId,
    clientSecret,
    itemIds,
    userId: user.id,
    supabase: supabaseClient,
  };

  try {
    switch (resource) {
      case "accounts":
        return await handleAccounts(clientConfig, url, actionOrId);
      case "transactions":
        return await handleTransactions(clientConfig, url, method, actionOrId, body);
      case "categories":
        return await handleCategories(clientConfig);
      case "investments":
        return await handleInvestments(clientConfig, url, actionOrId);
      case "loans":
        return await handleLoans(clientConfig, url, actionOrId);
      case "bills":
        return await handleBills(clientConfig, url, actionOrId, subPath);
      case "credit-cards":
        return await handleCreditCards(clientConfig);
      case "dashboard":
        return await handleDashboard(clientConfig, url);
      case "agenda":
        if (method !== "GET") return errorResponse("Method not allowed", 405);
        return await handleAgenda(clientConfig, url);
      case "budget-screen":
        if (method !== "GET") return errorResponse("Method not allowed", 405);
        return await handleBudgetScreen(clientConfig, url);
      case "reports":
        if (method !== "GET") return errorResponse("Method not allowed", 405);
        return await handleReports(clientConfig, url);
      case "subscriptions":
        if (method !== "GET") return errorResponse("Method not allowed", 405);
        return await handleSubscriptions(clientConfig);
      case "financial-moment":
        if (actionOrId === "salary") {
          if (method === "GET") return await handleGetCurrentSalary(clientConfig, url);
          if (method === "POST") return await handleSaveSalary(clientConfig, body);
          return errorResponse("Method not allowed", 405);
        }
        if (actionOrId === "toggle-manual-expense") {
          if (method !== "POST") return errorResponse("Method not allowed", 405);
          return await handleToggleManualExpensePaid(clientConfig, body);
        }
        if (method !== "GET") return errorResponse("Method not allowed", 405);
        return await handleFinancialMoment(clientConfig, url);
      case "connectors":
        return await handleConnectors(clientConfig, url, actionOrId);
      case "items":
        return await handleItems(clientConfig, url, method, body, actionOrId);
      case "webhooks":
        return await handleWebhooks(clientConfig, url, method, body, actionOrId);
      case "sync":
        if ((actionOrId === "status" || !actionOrId) && method === "GET") {
          return await handleSyncStatus(clientConfig);
        }
        if (actionOrId === "refresh" && method === "POST") {
          return await handleSyncRefresh(clientConfig, body);
        }
        return errorResponse("Rota de sincronização não encontrada", 404);
      default:
        return errorResponse(`Route /${resource} not found`, 404);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      typeof (err as { status?: number })?.status === "number"
        ? (err as { status: number }).status
        : 500;
    const codeDescription = (err as { codeDescription?: string })?.codeDescription;
    const pluggyData = (err as { pluggyData?: unknown })?.pluggyData;
    return jsonResponse(
      {
        error: message,
        message,
        ...(codeDescription ? { codeDescription, code: codeDescription } : {}),
        ...(pluggyData !== undefined ? { data: pluggyData } : {}),
      },
      status,
    );
  }
}
