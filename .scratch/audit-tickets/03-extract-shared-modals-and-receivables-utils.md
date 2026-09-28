# 03: Desacoplamento de Modais Cruzados e Criação de `src/utils/receivables.js`

**What to build:**
Eliminar as importações circulares entre páginas e extrair a lógica financeira do JSX para módulo puro:
1. Criar `src/components/modals/` e migrar `PurchaseModal.jsx` (de `ManualExpenses.jsx`) e `ReceivableModal.jsx` (de `Receivables.jsx`).
2. Atualizar imports em `CreditCards.jsx`, `Accounts.jsx`, `Receivables.jsx` e `ManualExpenses.jsx`.
3. Criar `src/utils/receivables.js` contendo funções puras:
   - `summarizeReceivables(receivables)`
   - `receivableEffectiveTotal(receivable)`
   - `groupReceivablesByPerson(receivables)`
   - `reimbursementsReceivedInMonth(receivables, ym)`
4. Desonerar `Receivables.jsx` e `Budget.jsx` removendo mais de 200 linhas de cálculos matemáticos inline.

**Blocked by:** Ticket 02

**Status:** done

- [x] Nenhuma página em `src/pages/` importa de outra página em `src/pages/`
- [x] `Receivables.jsx` utiliza as funções puras de `src/utils/receivables.js`
- [x] O cálculo de projeção de 24 meses de despesa contínua é coberto por testes unitários
