# 04: Decomposição do God-File `pluggy-proxy/index.ts` (2.231 linhas)

**What to build:**
Modularizar a Edge Function do Supabase para transformá-la em um despachante limpo e enxuto:
1. Extrair toda a lógica do bot do Telegram (~1.440 linhas) para sub-handlers:
   - `supabase/functions/pluggy-proxy/handlers/telegram/botHandler.ts`
   - `supabase/functions/pluggy-proxy/handlers/telegram/dailySummary.ts`
2. Mover o parser de fatura em PDF com Gemini para `supabase/functions/pluggy-proxy/handlers/parseBill.ts`.
3. Unificar a busca de dados conjuntos com `handlers/jointMoment.ts`, eliminando a função síncrona legada `loadMemberPluggyBundleEdge`.
4. Atualizar `v1/router.ts` para rotear diretamente sem bypasses manuais para `index.ts`.
5. Reduzir `index.ts` para menos de 100 linhas.

**Blocked by:** Ticket 01

**Status:** done

- [x] `supabase/functions/pluggy-proxy/index.ts` possui menos de 100 linhas (31 linhas)
- [x] Todas as chamadas ao Telegram Bot e Daily Summary continuam operacionais
- [x] `npm run test:fixtures` continua passando com paridade 100%
