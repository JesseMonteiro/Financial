# 02: Correção de Bugs do Oxlint, Fast Refresh e Hooks Críticos

**What to build:**
Resolução dos principais riscos apontados pelo Oxlint no frontend e backend:
1. Eliminar o anti-pattern `new Promise(async ...)` em `src/pages/Accounts.jsx:73`, tornando a função assíncrona pura e tratando erros adequadamente.
2. Corrigir dependências de `useMemo` em `src/pages/JointFinancialMoment.jsx` (incluir `resolveCombinedSalary`).
3. Mover `accountById` de `src/components/AccountIcon.jsx` para `src/utils/accountIcons.js`.
4. Mover `CATEGORY_LUCIDE_ICONS` e `resolveLucideIcon` de `src/components/CategoryIcon.jsx` para `src/utils/categoryIcons.js` restaurando o Fast Refresh (HMR) do Vite.
5. Substituir as expressões complexas `accountIds.join(',')` nos `useEffect` por chaves memoizadas estáveis.
6. Adicionar verificação explícita do `error` retornado pelo Supabase em `server/middleware/auth.js:32`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `Accounts.jsx` não possui mais `new Promise(async ...)`
- [x] Fast Refresh do Vite funciona sem recarregar a página ao editar `AccountIcon` e `CategoryIcon`
- [x] `npm run lint` reduz drasticamente os warnings do Oxlint
- [x] `JointFinancialMoment` recalcula o rateio salarial sem exibir dados defasados
