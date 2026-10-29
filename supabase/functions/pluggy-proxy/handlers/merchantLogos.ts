import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { errorResponse, jsonResponse } from "../middleware/http.ts";
import { resolveMerchantLogos } from "../../../../server/services/merchantLogoCache.js";

export async function handleMerchantLogosResolve(body: unknown): Promise<Response> {
  const queries = (body as { queries?: unknown } | null)?.queries;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    try {
      const results = await resolveMerchantLogos({
        supabase: null,
        secret: "",
        queries,
      });
      return jsonResponse({ results });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(message, 500);
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const results = await resolveMerchantLogos({
      supabase,
      secret: Deno.env.get("LOGO_DEV_SECRET_KEY") ?? "",
      queries,
    });
    return jsonResponse({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[merchant-logos]", message);
    return errorResponse("Falha ao resolver logos", 500);
  }
}
