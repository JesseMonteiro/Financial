import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { PluggyClient, pluggyJson } from "./pluggy.ts";

export interface PluggyWebhookPayload {
  event: string;
  eventId?: string;
  itemId?: string;
  id?: string; // fallback for itemId in some events
  accountId?: string;
  transactionIds?: string[];
  createdTransactionsLink?: string;
  data?: unknown;
}

export async function processWebhookEvent(
  supabase: SupabaseClient,
  payload: PluggyWebhookPayload,
  systemPluggyClient?: { clientId: string; clientSecret: string },
): Promise<{ processed: boolean; reason?: string }> {
  const event = payload.event;
  const eventId = payload.eventId || crypto.randomUUID();
  const itemId = payload.itemId || payload.id;

  if (!event) {
    return { processed: false, reason: "No event name in payload" };
  }

  // 1. Idempotency check
  const { data: existing } = await supabase
    .from("pluggy_webhook_events")
    .select("event_id, processed")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing && existing.processed) {
    return { processed: false, reason: "Event already processed" };
  }

  // Record receipt if not already recorded
  if (!existing) {
    await supabase.from("pluggy_webhook_events").insert({
      event_id: eventId,
      event_type: event,
      item_id: itemId || null,
      payload,
      received_at: new Date().toISOString(),
      processed: false,
    });
  }

  if (!itemId && !payload.accountId) {
    await markEventProcessed(supabase, eventId);
    return { processed: true, reason: "Event has no itemId or accountId to associate" };
  }

  // 2. Resolve user_id from itemId
  let userId: string | null = null;
  let userPluggyClient: { clientId: string; clientSecret: string } | null = systemPluggyClient || null;

  if (itemId) {
    // Check pluggy_sync_items first
    const { data: syncItem } = await supabase
      .from("pluggy_sync_items")
      .select("user_id")
      .eq("pluggy_item_id", itemId)
      .maybeSingle();

    if (syncItem?.user_id) {
      userId = syncItem.user_id;
    }
  }

  if (!userId && itemId) {
    // Check profiles table with array contains
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, pluggy_client_id, pluggy_client_secret")
      .contains("pluggy_item_ids", [itemId])
      .maybeSingle();

    if (profile?.id) {
      userId = profile.id;
      if (profile.pluggy_client_id && profile.pluggy_client_secret) {
        userPluggyClient = {
          clientId: profile.pluggy_client_id,
          clientSecret: profile.pluggy_client_secret,
        };
      }
    }
  }

  if (!userId && payload.accountId) {
    // Check cached_accounts
    const { data: acc } = await supabase
      .from("cached_accounts")
      .select("user_id, pluggy_item_id")
      .eq("pluggy_account_id", payload.accountId)
      .maybeSingle();

    if (acc?.user_id) {
      userId = acc.user_id;
    }
  }

  if (!userId) {
    console.warn(`[webhookProcessor] Could not resolve user for item ${itemId} or account ${payload.accountId}`);
    await markEventProcessed(supabase, eventId);
    return { processed: false, reason: "User not found for connection" };
  }

  // Fallback to environment credentials if user doesn't have custom credentials
  if (!userPluggyClient || !userPluggyClient.clientId) {
    const envClientId = Deno.env.get("PLUGGY_CLIENT_ID");
    const envClientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
    if (envClientId && envClientSecret) {
      userPluggyClient = { clientId: envClientId, clientSecret: envClientSecret };
    }
  }

  const client: PluggyClient = {
    clientId: userPluggyClient?.clientId || "",
    clientSecret: userPluggyClient?.clientSecret || "",
    itemIds: itemId ? [itemId] : [],
    userId,
    supabase,
  };

  const nowIso = new Date().toISOString();

  // 3. Process event types
  try {
    switch (event) {
      case "transactions/created": {
        const accountId = payload.accountId;
        if (!accountId) break;

        // Fetch transactions from Pluggy
        let txs: Array<Record<string, unknown>> = [];
        if (payload.createdTransactionsLink) {
          try {
            // createdTransactionsLink is relative or full URL
            const linkPath = payload.createdTransactionsLink.replace(/^https:\/\/api\.pluggy\.ai/, "");
            const res = (await pluggyJson(client, linkPath)) as { results?: Array<Record<string, unknown>> };
            txs = res.results || [];
          } catch (e) {
            console.warn("[webhookProcessor] Failed using createdTransactionsLink, falling back to account fetch:", e);
          }
        }

        if (txs.length === 0) {
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - 7); // last 7 days
          const res = (await pluggyJson(client, "/v2/transactions", {
            params: { accountId, from: fromDate.toISOString().slice(0, 10) },
          })) as { results?: Array<Record<string, unknown>> };
          txs = res.results || [];
        }

        if (txs.length > 0) {
          const rows = txs.map((tx) => {
            const rawDate = String(tx.date || nowIso).slice(0, 10);
            const cat = tx.category as string | { name?: string } | undefined;
            const catName = typeof cat === "string" ? cat : cat?.name || null;
            return {
              user_id: userId,
              pluggy_transaction_id: String(tx.id),
              account_id: accountId,
              date: rawDate,
              amount: typeof tx.amount === "number" ? tx.amount : 0,
              type: (tx.type as string) || null,
              category: catName,
              category_id: (tx.categoryId as string) || null,
              description: (tx.description as string) || "",
              status: (tx.status as string) || null,
              data: tx,
              updated_at: nowIso,
            };
          });

          await supabase.from("cached_transactions").upsert(rows, {
            onConflict: "user_id,pluggy_transaction_id",
          });
        }
        break;
      }

      case "transactions/updated": {
        const txIds = payload.transactionIds || [];
        const accountId = payload.accountId;
        if (txIds.length > 0 && accountId) {
          try {
            const res = (await pluggyJson(client, "/v2/transactions", {
              params: { accountId, ids: txIds.join(",") },
            })) as { results?: Array<Record<string, unknown>> };

            const updatedTxs = res.results || [];
            if (updatedTxs.length > 0) {
              const rows = updatedTxs.map((tx) => {
                const rawDate = String(tx.date || nowIso).slice(0, 10);
                const cat = tx.category as string | { name?: string } | undefined;
                const catName = typeof cat === "string" ? cat : cat?.name || null;
                return {
                  user_id: userId,
                  pluggy_transaction_id: String(tx.id),
                  account_id: accountId,
                  date: rawDate,
                  amount: typeof tx.amount === "number" ? tx.amount : 0,
                  type: (tx.type as string) || null,
                  category: catName,
                  category_id: (tx.categoryId as string) || null,
                  description: (tx.description as string) || "",
                  status: (tx.status as string) || null,
                  data: tx,
                  updated_at: nowIso,
                };
              });

              await supabase.from("cached_transactions").upsert(rows, {
                onConflict: "user_id,pluggy_transaction_id",
              });
            }
          } catch (e) {
            console.warn("[webhookProcessor] Failed fetching updated transactions:", e);
          }
        }
        break;
      }

      case "transactions/deleted": {
        const txIds = payload.transactionIds || [];
        if (txIds.length > 0) {
          await supabase
            .from("cached_transactions")
            .delete()
            .eq("user_id", userId)
            .in("pluggy_transaction_id", txIds);
        }
        break;
      }

      case "item/updated": {
        if (itemId) {
          // Fetch updated accounts to refresh balances
          try {
            const accRes = (await pluggyJson(client, "/accounts", {
              params: { itemId },
            })) as { results?: Array<Record<string, unknown>> };

            for (const acc of accRes.results || []) {
              const accId = String(acc.id || "");
              if (!accId) continue;
              await supabase.from("cached_accounts").upsert(
                {
                  user_id: userId,
                  pluggy_account_id: accId,
                  pluggy_item_id: itemId,
                  name: (acc.name as string) || null,
                  type: (acc.type as string) || null,
                  subtype: (acc.subtype as string) || null,
                  balance: typeof acc.balance === "number" ? acc.balance : null,
                  currency_code: (acc.currencyCode as string) || "BRL",
                  data: acc,
                  updated_at: nowIso,
                },
                { onConflict: "user_id,pluggy_account_id" },
              );
            }
          } catch (e) {
            console.warn("[webhookProcessor] Failed fetching accounts on item/updated:", e);
          }

          // Update sync status
          await supabase.from("pluggy_sync_items").upsert(
            {
              user_id: userId,
              pluggy_item_id: itemId,
              status: "UPDATED",
              execution_status: "SUCCESS",
              error_message: null,
              last_synced_at: nowIso,
              updated_at: nowIso,
            },
            { onConflict: "user_id,pluggy_item_id" },
          );
        }
        break;
      }

      case "item/waiting_user_input":
      case "item/waiting_user_action":
      case "item/error": {
        if (itemId) {
          const status = event.replace("item/", "").toUpperCase();
          await supabase.from("pluggy_sync_items").upsert(
            {
              user_id: userId,
              pluggy_item_id: itemId,
              status,
              updated_at: nowIso,
            },
            { onConflict: "user_id,pluggy_item_id" },
          );
        }
        break;
      }

      default:
        console.log(`[webhookProcessor] Unhandled event type: ${event}`);
    }

    await markEventProcessed(supabase, eventId);
    return { processed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhookProcessor] Error processing ${event}:`, err);
    return { processed: false, reason: message };
  }
}

async function markEventProcessed(supabase: SupabaseClient, eventId: string) {
  try {
    await supabase
      .from("pluggy_webhook_events")
      .update({ processed: true })
      .eq("event_id", eventId);
  } catch {
    // ignore
  }
}
