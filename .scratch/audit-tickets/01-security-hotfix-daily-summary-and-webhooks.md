# 01: Hotfix de Segurança: Endpoint de Resumo Diário, Webhook Telegram e Cache

**What to build:**
Blindagem imediata contra vazamento de dados de múltiplos usuários e negação de serviço:
1. Proteger o endpoint `/telegram/daily-summary` (na Edge Function e no Express) exigindo validação obrigatória do cabeçalho `Authorization: Bearer ${CRON_SECRET}`. Bloquear qualquer extração pública de dados de usuários no modo `?dryRun=true`.
2. Validar o cabeçalho `x-telegram-bot-api-secret-token` em `server/routes/chatbot.js` contra `process.env.TELEGRAM_WEBHOOK_SECRET`.
3. Proteger `POST /api/cache/clear` e `POST /api/webhooks` com verificação de assinatura da Pluggy (`x-pluggy-signature`).
4. Em `server/middleware/cache.js`, nunca gravar chaves sob `anonymous:` se a rota exigir autenticação.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Chamada a `/chatbot/telegram/daily-summary?dryRun=true` sem token retorna 401 Unauthorized
- [x] Chamada com `Authorization: Bearer <CRON_SECRET_CORRETO>` executa normalmente
- [x] Webhook do Telegram no Express rejeita requisições sem o segredo configurado
- [x] Limpeza de cache global não é mais acessível publicamente sem autenticação
