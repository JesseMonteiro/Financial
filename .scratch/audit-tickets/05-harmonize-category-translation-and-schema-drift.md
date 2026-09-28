# 05: Harmonização de Categorias e Resolução de Drift entre Client e Edge

**What to build:**
Garantir que a regra de ouro de paridade seja cumprida tanto no vocabulário semântico quanto nos schemas de dados:
1. Alinhar o dicionário de tradução de categorias em `supabase/functions/pluggy-proxy/utils/dashboardAnalytics.ts` com `src/utils/categories.js` (unificar "Supermercado & Alimentação" com "Supermercados", "Salário & Renda" com "Salário", etc.).
2. Adicionar suporte a snake_case (`due_date`, `is_manual`, `is_paid`) em `src/utils/financialMomentMonth.js` para compatibilidade idêntica ao Edge.
3. Criar teste de paridade automatizado para categorias no CI.

**Blocked by:** Ticket 04

**Status:** done

- [x] A consulta de despesas no Telegram Bot e na Web exibe as mesmas categorias para as mesmas transações
- [x] O cálculo de Momento Financeiro na Web aceita tanto DTOs camelCase quanto snake_case sem quebrar
- [x] `npm run test:categories` valida conformidade entre Web e Edge
