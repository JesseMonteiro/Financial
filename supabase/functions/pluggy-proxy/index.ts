// Pluggy Proxy — Supabase Edge Function (multi-user via profiles.pluggy_item_ids)
// Modular BFF: middleware + handlers + /v1 router; legacy unversioned paths preserved.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS, correlationId, errorResponse } from "./middleware/http.ts";
import { handleV1 } from "./v1/router.ts";
import { handleLegacyRequest } from "./routes/legacy.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const requestId = correlationId(req);
  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/pluggy-proxy/, "");
  if (!path.startsWith("/")) path = "/" + path;

  const segments = path.split("/").filter(Boolean);
  const resource = segments[0] ?? "";

  // Versioned API — envelope responses under /v1/*
  if (resource === "v1") {
    const pathAfterV1 = "/" + segments.slice(1).join("/");
    const v1Res = await handleV1(req, pathAfterV1, { requestId });
    if (v1Res) return v1Res;
    return errorResponse(`Route /v1${pathAfterV1 === "/" ? "" : pathAfterV1} not found`, 404);
  }

  // Legacy unversioned API routes
  return await handleLegacyRequest(req, path, segments);
});
