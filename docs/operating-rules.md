# Operating Rules — MeuFlux

Este arquivo define como o trabalho é feito no MeuFlux. Leia antes de qualquer mudança.

## Regras

1. **Nada fica silenciosamente half-finished.** Trabalho parcial é permitido; trabalho parcial não documentado não é. Se algo ficou incompleto, deixar claro no commit message ou num comentário `// TODO` com contexto.

2. **"done" significa verificado com evidência.** Uma feature só está done quando os critérios de aceitação foram verificados contra o app rodando, o banco de dados, ou um teste passando.

3. **Paridade é obrigatória.** UI Web, Edge Function e Telegram Bot devem retornar os mesmos números para a mesma consulta. Uma divergência é um bug, não uma feature.

4. **Lógica de negócio tem endereço fixo:**
   - Cálculos puros client-side: `src/utils/`
   - Lógica de servidor: `server/services/`
   - Edge parity: `supabase/functions/pluggy-proxy/`
   - iOS domain puro: `ios/Packages/MeuFluxDomain/`
   
   Componentes React NUNCA calculam totais financeiros.

5. **Conectores de crédito:** Sempre ler `docs/connectors/` antes de mudar lógica de fatura ou ciclo aberto. Ver `.cursor/rules/credit-connectors.mdc` para as regras detalhadas.

6. **Parity crítica em tempo de commit:** `src/utils/creditBillPeriod.js` e `supabase/functions/pluggy-proxy/creditBillPeriod.ts` devem ser funcionalmente idênticos. Mudança em um = mudança no outro no mesmo commit. Verificar: `npm run test:fixtures`.

7. **UI changes requerem o designer.** Qualquer mudança de UI passa por:
   - Pre-implementation review de layout e componentes
   - Post-implementation browser QA (mobile 390×844 + desktop 1280×800)
   - Screenshot critique loop

8. **Testes de fixture passam antes de marcar done.** Para qualquer mudança de lógica de crédito: `npm run test:fixtures`. Para orçamento: `npm run test:budget`. Para lint: `npm run lint`.

9. **iOS: `swift test` passa antes de done.** Toda mudança de código Swift deve ter todos os testes Swift passando.

10. **MCP é uma superfície de primeira classe.** Features de consulta financeira devem funcionar tanto na UI quanto via chatbot (Gemini). Uma feature que mostra dados na tela mas o chatbot não responde está incompleta.

## Cadência

- **Toda mudança de código:** incluir context no commit message (o quê e por quê)
- **Mudança de conector:** atualizar `docs/connectors/[banco].md` e adicionar/atualizar fixture
- **Decisão durável:** criar ADR em `.agents/decisions/ADR-NNN-[slug].md`
- **Bug de paridade:** corrigir em ambas as implementações no mesmo PR
