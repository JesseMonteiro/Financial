# 07: Implantação do Vitest e Testes Unitários do Momento Financeiro

**What to build:**
Criar uma base de testes unitários moderna e unificada no ecossistema Web/Node:
1. Instalar `vitest` e `@vitest/coverage-v8` como devDependencies.
2. Criar `vitest.config.js` apontando para `tests/` e integrando com o Vite.
3. Criar a primeira suíte de testes unitários abrangente para `src/utils/financialMomentMonth.js`:
   - Cálculo de receita líquida
   - Dedução de faturas abertas e cartões
   - Débitos automáticos e gastos manuais
   - Teste de limites e saldos reservados (caixinhas)
4. Unificar os scripts pontuais (`test:budget`, `test:line-item`, etc.) sob o comando `npm test`.

**Blocked by:** Ticket 05

**Status:** done

- [x] `npm test` executa todas as suítes via Vitest com saída legível (19 testes passando em 2.1s)
- [x] `computeFinancialMomentMonth` possui ao menos 10 cenários de teste unitário (13 cenários em `tests/financialMomentMonth.test.js`)
- [x] O script órfão `test-telegram-daily-summary.mjs` é integrado ao runner oficial (`tests/telegramDailySummary.test.js` e script `npm run test:telegram`)
