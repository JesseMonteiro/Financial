/**
 * Optional webhook verification helpers.
 * Configure TELEGRAM_WEBHOOK_SECRET / PLUGGY_WEBHOOK_SECRET in Edge Function secrets.
 */
export function verifyTelegramWebhook(req: Request): boolean {
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!expected) {
    console.warn("[webhooks] TELEGRAM_WEBHOOK_SECRET not set — accepting webhook without verification");
    return true;
  }
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  return got === expected;
}

/** Alias used by index.ts */
export const verifyTelegramSecret = verifyTelegramWebhook;

export function verifyPluggyWebhook(req: Request): boolean {
  const expected = Deno.env.get("PLUGGY_WEBHOOK_SECRET");
  if (!expected) {
    console.warn("[webhooks] PLUGGY_WEBHOOK_SECRET not set — accepting webhook without verification");
    return true;
  }
  const got = req.headers.get("x-pluggy-signature") || req.headers.get("x-webhook-secret");
  return got === expected;
}
