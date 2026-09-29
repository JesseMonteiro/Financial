import { jsonResponse, errorResponse } from "../middleware/http.ts";
import { PluggyClient } from "./pluggy.ts";
import { syncItemToCache } from "../services/syncEngine.ts";

const MINUTE_MS = 60 * 1000;
const FRESH_MAX_AGE_MS = 15 * MINUTE_MS; // < 15min -> fresh
const AGING_MAX_AGE_MS = 60 * MINUTE_MS; // < 1h -> aging, >= 1h -> stale

export type FreshnessLevel = "never" | "fresh" | "aging" | "stale";

export function classifyFreshness(ageMs: number | null): {
  level: FreshnessLevel;
  label: string;
} {
  if (ageMs == null) {
    return { level: "never", label: "nunca sincronizado" };
  }
  if (ageMs < FRESH_MAX_AGE_MS) {
    return { level: "fresh", label: "atualizado" };
  }
  if (ageMs < AGING_MAX_AGE_MS) {
    return { level: "aging", label: "sincronizado há pouco" };
  }
  return { level: "stale", label: "dados podem estar desatualizados" };
}

export async function handleSyncStatus(client: PluggyClient): Promise<Response> {
  const supabase = client.supabase;
  const userId = client.userId;

  try {
    const { data: rows, error } = await supabase
      .from("pluggy_sync_items")
      .select("*")
      .eq("user_id", userId)
      .order("last_synced_at", { ascending: false });

    if (error) {
      console.warn("[syncHandler] Error reading pluggy_sync_items:", error.message);
      // Fallback if table doesn't exist yet or query fails
      return jsonResponse({
        items: [],
        globalLastSyncedAt: null,
        freshness: { level: "never", label: "nunca sincronizado" },
        itemCount: 0,
      });
    }

    const now = Date.now();
    const items = (rows || []).map((row) => {
      const syncDate = row.last_synced_at ? new Date(row.last_synced_at) : null;
      const ageMs = syncDate ? Math.max(0, now - syncDate.getTime()) : null;
      const freshness = classifyFreshness(ageMs);

      return {
        pluggyItemId: row.pluggy_item_id,
        connectorName: row.connector_name,
        status: row.status,
        executionStatus: row.execution_status,
        errorMessage: row.error_message,
        lastSyncedAt: row.last_synced_at,
        ageMs,
        freshness,
      };
    });

    const existingIds = new Set((rows || []).map((r) => r.pluggy_item_id));
    const missingIds = client.itemIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      // Trigger background sync for items not yet in pluggy_sync_items
      const bgPromise = Promise.all(
        missingIds.map((itemId) =>
          syncItemToCache(client, itemId).catch((err) =>
            console.warn(`[syncHandler] Initial sync failed for ${itemId}:`, err)
          )
        )
      );
      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
        // @ts-ignore
        EdgeRuntime.waitUntil(bgPromise);
      }
    }

    const pendingItems = missingIds.map((id) => ({
      pluggyItemId: id,
      connectorName: "Banco",
      status: "PENDING",
      executionStatus: "INITIALIZING",
      errorMessage: null,
      lastSyncedAt: null,
      ageMs: null,
      freshness: classifyFreshness(null),
    }));

    const allItems = [...items, ...pendingItems];

    const validDates = allItems
      .map((i) => (i.lastSyncedAt ? new Date(i.lastSyncedAt).getTime() : null))
      .filter((t): t is number => typeof t === "number" && Number.isFinite(t));

    // Global freshness: based on the oldest connection that is configured
    // If no items, never
    const globalLastSyncedAt =
      validDates.length > 0 ? new Date(Math.min(...validDates)).toISOString() : null;
    const globalAgeMs = globalLastSyncedAt
      ? Math.max(0, now - new Date(globalLastSyncedAt).getTime())
      : null;
    const globalFreshness = classifyFreshness(globalAgeMs);

    return jsonResponse({
      items: allItems,
      globalLastSyncedAt,
      freshness: globalFreshness,
      itemCount: allItems.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(`Erro ao verificar status de sincronização: ${message}`, 500);
  }
}

export async function handleSyncRefresh(
  client: PluggyClient,
  body: unknown,
): Promise<Response> {
  const reqBody = (body as { itemId?: string; itemIds?: string[] }) || {};
  let targetItemIds: string[] = [];

  if (reqBody.itemId) {
    targetItemIds = [reqBody.itemId];
  } else if (Array.isArray(reqBody.itemIds) && reqBody.itemIds.length > 0) {
    targetItemIds = reqBody.itemIds;
  } else {
    targetItemIds = client.itemIds;
  }

  if (targetItemIds.length === 0) {
    return jsonResponse({
      success: true,
      message: "Nenhuma conexão para sincronizar",
      results: [],
    });
  }

  const results = [];
  for (const itemId of targetItemIds) {
    // Only allow syncing items belonging to the user
    if (!client.itemIds.includes(itemId)) {
      continue;
    }
    const res = await syncItemToCache(client, itemId);
    results.push(res);
  }

  const allOk = results.every((r) => r.ok);
  return jsonResponse({
    success: allOk,
    message: `${results.filter((r) => r.ok).length} de ${results.length} conexão(ões) sincronizadas no cache.`,
    results,
  });
}
