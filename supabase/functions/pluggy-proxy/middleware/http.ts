/**
 * HTTP helpers for pluggy-proxy BFF (v1 envelope + legacy).
 */
export const CALCULATION_VERSION = "2026.09.2";

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // TODO: tighten for web origins in production
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
};

export function correlationId(req: Request): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  const body = data && typeof data === "object" && !Array.isArray(data)
    ? { ...(data as Record<string, unknown>), calculationVersion: CALCULATION_VERSION }
    : data;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extraHeaders },
  });
}

export function errorResponse(message: string, status = 500, requestId?: string): Response {
  console.error(`[pluggy-proxy] Error Response (${status}): ${message}`);
  return jsonResponse({ error: message, message, requestId }, status);
}

export function v1Ok(data: unknown, req: Request, status = 200): Response {
  const requestId = correlationId(req);
  return jsonResponse(
    {
      data,
      meta: {
        calculationVersion: CALCULATION_VERSION,
        requestId,
        generatedAt: new Date().toISOString(),
      },
    },
    status,
    { "x-request-id": requestId },
  );
}

export function v1Err(message: string, status: number, req: Request, code?: string): Response {
  const requestId = correlationId(req);
  return jsonResponse(
    {
      data: null,
      error: { message, code: code || String(status) },
      meta: {
        calculationVersion: CALCULATION_VERSION,
        requestId,
        generatedAt: new Date().toISOString(),
      },
    },
    status,
    { "x-request-id": requestId },
  );
}

export function featureFlags() {
  return {
    pluggyConnect: true,
    pdfImport: true,
    joint: true,
    push: Deno.env.get("FEATURE_PUSH") === "true",
    telegram: Boolean(Deno.env.get("TELEGRAM_BOT_TOKEN")),
    widgets: true,
    biometricLock: true,
    killSwitches: {
      pluggy: Deno.env.get("KILL_PLUGGY") === "true",
      gemini: Deno.env.get("KILL_GEMINI") === "true",
      telegram: Deno.env.get("KILL_TELEGRAM") === "true",
    },
  };
}

/** Never leak secrets to clients. */
export function sanitizeProfile<T extends Record<string, unknown>>(profile: T): Omit<T, "pluggy_client_secret"> {
  const { pluggy_client_secret: _secret, ...rest } = profile as T & { pluggy_client_secret?: unknown };
  return rest;
}
