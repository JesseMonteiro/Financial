import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { PluggyClient, pluggyJson } from "../handlers/pluggy.ts";

export interface SyncEngineResult {
  ok: boolean;
  itemId: string;
  connectorName?: string;
  status?: string;
  executionStatus?: string;
  accountsSynced: number;
  transactionsSynced: number;
  error?: string;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Syncs a single Pluggy Item into Supabase cache tables:
 * - pluggy_sync_items
 * - cached_accounts
 * - cached_transactions
 */
export async function syncItemToCache(
  client: PluggyClient,
  itemId: string,
): Promise<SyncEngineResult> {
  const supabase = client.supabase;
  const userId = client.userId;

  try {
    // 1. Fetch Item metadata
    const item = (await pluggyJson(client, `/items/${itemId}`)) as {
      id?: string;
      status?: string;
      executionStatus?: string;
      error?: { message?: string };
      connector?: { name?: string };
    };

    const connectorName = item?.connector?.name || "Banco";
    const status = item?.status || "UNKNOWN";
    const executionStatus = item?.executionStatus || null;
    const errorMessage = item?.error?.message || null;
    const nowIso = new Date().toISOString();

    // Upsert into pluggy_sync_items
    await supabase.from("pluggy_sync_items").upsert(
      {
        user_id: userId,
        pluggy_item_id: itemId,
        connector_name: connectorName,
        status,
        execution_status: executionStatus,
        error_message: errorMessage,
        last_synced_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id,pluggy_item_id" },
    );

    // If item is in error or waiting user input, accounts/transactions might not be updated
    if (status === "LOGIN_ERROR" || status === "WAITING_USER_INPUT") {
      return {
        ok: false,
        itemId,
        connectorName,
        status,
        executionStatus: executionStatus || undefined,
        accountsSynced: 0,
        transactionsSynced: 0,
        error: errorMessage || `Conexão requer ação do usuário: ${status}`,
      };
    }

    // 2. Fetch Accounts
    const accResponse = (await pluggyJson(client, "/accounts", {
      params: { itemId },
    })) as { results?: Array<Record<string, unknown>> };

    const accounts = accResponse?.results || [];
    let accountsSynced = 0;

    for (const acc of accounts) {
      const accId = String(acc.id || "");
      if (!accId) continue;

      const accRow = {
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
      };

      await supabase.from("cached_accounts").upsert(accRow, {
        onConflict: "user_id,pluggy_account_id",
      });
      accountsSynced++;
    }

    // 3. Fetch Transactions for all accounts (last 12 months)
    const now = new Date();
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 12);
    const fromStr = toIsoDate(fromDate);
    const toStr = toIsoDate(now);

    let transactionsSynced = 0;

    for (const acc of accounts) {
      const accId = String(acc.id || "");
      if (!accId) continue;

      let cursor: string | undefined = undefined;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore && pageCount < 10) {
        pageCount++;
        const params: Record<string, string | undefined> = {
          accountId: accId,
          from: fromStr,
          to: toStr,
        };
        if (cursor) params.cursor = cursor;

        type TxPage = {
          results?: Array<Record<string, unknown>>;
          nextCursor?: string;
        };

        let txPage: TxPage | null = null;
        try {
          txPage = (await pluggyJson(client, "/v2/transactions", {
            params,
          })) as TxPage;
        } catch (txErr) {
          console.warn(`[syncEngine] Failed to fetch transactions for account ${accId}:`, txErr);
          break;
        }

        const results = txPage?.results || [];
        if (results.length === 0) {
          hasMore = false;
          break;
        }

        const txRows = results.map((tx) => {
          const rawDate = String(tx.date || nowIso);
          const dateStr = rawDate.slice(0, 10);
          const cat = tx.category as string | { name?: string } | undefined;
          const catName = typeof cat === "string" ? cat : cat?.name || null;

          return {
            user_id: userId,
            pluggy_transaction_id: String(tx.id),
            account_id: accId,
            date: dateStr,
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

        // Upsert in batches of 200
        for (let i = 0; i < txRows.length; i += 200) {
          const batch = txRows.slice(i, i + 200);
          await supabase.from("cached_transactions").upsert(batch, {
            onConflict: "user_id,pluggy_transaction_id",
          });
        }

        transactionsSynced += txRows.length;
        cursor = txPage?.nextCursor;
        if (!cursor) {
          hasMore = false;
        }
      }
    }

    return {
      ok: true,
      itemId,
      connectorName,
      status,
      executionStatus: executionStatus || undefined,
      accountsSynced,
      transactionsSynced,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[syncEngine] Error syncing item ${itemId}:`, err);

    try {
      await supabase.from("pluggy_sync_items").upsert(
        {
          user_id: userId,
          pluggy_item_id: itemId,
          status: "ERROR",
          error_message: message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,pluggy_item_id" },
      );
    } catch {
      // ignore secondary failure
    }

    return {
      ok: false,
      itemId,
      accountsSynced: 0,
      transactionsSynced: 0,
      error: message,
    };
  }
}
