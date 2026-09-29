// Edge Function: pluggy-webhook
// Dedicated webhook receiver for Pluggy.ai events with Fast ACK (< 500ms)
// and background ingestion into Supabase cache tables.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { processWebhookEvent } from "../pluggy-proxy/handlers/webhookProcessor.ts";

function verifySecret(req: Request): boolean {
  const expectedSecret = Deno.env.get("PLUGGY_WEBHOOK_SECRET");
  if (!expectedSecret) {
    console.warn("[pluggy-webhook] PLUGGY_WEBHOOK_SECRET not set, accepting webhook without verification");
    return true;
  }
  const signature =
    req.headers.get("x-pluggy-signature") ||
    req.headers.get("x-webhook-secret") ||
    "";

  return signature === expectedSecret;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, x-pluggy-signature, x-webhook-secret",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify secret
  if (!verifySecret(req)) {
    console.warn("[pluggy-webhook] Invalid or missing webhook signature");
    return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("[pluggy-webhook] Event received:", payload.event, "itemId:", payload.itemId || payload.id);

  // Initialize Supabase service role client
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (supabaseUrl && serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const backgroundPromise = processWebhookEvent(supabase, payload as any).catch((err) => {
      console.error("[pluggy-webhook] Background processing error:", err);
    });

    // Fast ACK: return 200 OK immediately and execute in background
    // @ts-ignore – EdgeRuntime is provided in Supabase Deno Deploy
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(backgroundPromise);
    } else {
      // Local fallback without waitUntil
      backgroundPromise;
    }
  }

  return new Response(
    JSON.stringify({ status: "success", message: "Event received and queued for processing" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
