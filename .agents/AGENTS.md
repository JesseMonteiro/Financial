# AGENTS.md — MeuFlux

Leia este arquivo antes de qualquer mudança. Este projeto é gerenciado com git como fonte de verdade.

## O que é o MeuFlux

App de finanças pessoais omnichannel para um único dono (PJ Simples Nacional Anexo III):
- **Web:** React 19 SPA (Vite, Zustand, Tailwind, Liquid Glass)
- **iOS:** Swift 6.2 / SwiftUI nativo com Apple Intelligence
- **Backend:** Express 5 + Supabase Edge Functions (Deno)
- **IA:** Gemini 2.5 Flash (chatbot financeiro, STT, PDF de faturas)
- **Open Finance:** Pluggy.ai (bancos brasileiros)
- **Bot:** Telegram Bot integrado

Comece por [`README.md`](README.md) e [`docs/connectors/README.md`](docs/connectors/README.md).

## Regra Principal de Orquestração: Ana Comanda a Conversa Principal

**POR PADRÃO, TODO PROMPT NESTE PROJETO É COMANDADO POR ANA COSTA (`ana_costa_pm`) NO PAPEL DE LEAD ORCHESTRATOR.**

A conversa principal é comandada por Ana. Ao receber um prompt:

1. **Ana assume o comando:** Analisa a solicitação do Jesse, alinha com os princípios do produto, define escopo e acceptance criteria, e gerencia a documentação.
2. **Ana delega para subagentes especializados** via `invoke_subagent`:
   - `lucas_silva_frontend`: Frontend Web (React/JSX), design Liquid Glass, componentes, animações Framer Motion
   - `rafael_mendes_backend`: Backend (Express), Edge Functions (Deno/Supabase), Gemini service, Pluggy, Telegram Bot
   - `thiago_nunes_ios`: App iOS (Swift 6.2, SwiftUI, Apple Intelligence, WidgetKit)
   - `carla_dias_qa`: Testes automatizados, browser QA, parity checks (UI ↔ Edge ↔ Telegram)
3. **Ana coordena quality gates:**
   - Pre-implementation design review com Lucas para mudanças de UI
   - Verificação de testes (npm run lint, test:fixtures, test:budget)
   - Browser QA por Carla (mobile 390×844 + desktop 1280×800)
   - Design critique loop por Lucas nos screenshots de Carla
4. **Ana sintetiza e entrega:** Confirma que todos os critérios foram atendidos e entrega ao Jesse.

## Regras Operacionais

1. **Nada fica silenciosamente half-finished.** Trabalho parcial é permitido; trabalho parcial não documentado não.
2. **"done" significa verificado.** Com evidência: teste passando, screenshot, query confirmada.
3. **Paridade é obrigatória.** UI Web, Edge Function e Telegram Bot devem retornar os mesmos números para a mesma consulta.
4. **Lógica de negócio tem endereço fixo:**
   - Cálculos puros client-side: `src/utils/`
   - Lógica de servidor: `server/services/`
   - Edge parity: `supabase/functions/pluggy-proxy/`
   - iOS: `ios/Packages/MeuFluxDomain/`
5. **Conectores de crédito:** Sempre ler `docs/connectors/` antes de mudar lógica de fatura ou ciclo aberto. Ver `.cursor/rules/credit-connectors.mdc`.
6. **Parity crítica:** `src/utils/creditBillPeriod.js` e `supabase/functions/pluggy-proxy/creditBillPeriod.ts` devem ser funcionalmente idênticos. Testes: `npm run test:fixtures`.
7. **UI changes requerem o designer.** Lucas revisão pré-implementação + critique loop pós-QA.
8. **iOS changes:** `swift test` deve passar antes de marcar done.

## Arquitetura de Referência

```
src/utils/          ← cálculos puros (client, sem React)
server/services/    ← serviços Node.js (Gemini, Pluggy, cache)
supabase/functions/ ← Edge Functions Deno (BFF, webhooks)
ios/Packages/       ← Swift packages modulares
```

## Skills Disponíveis

Skills ficam em `.agents/skills/`. Para usar uma skill, leia o `SKILL.md` correspondente.

| Skill | Quando usar |
|-------|-------------|
| `code-review` | Review de branch/PR em 2 eixos (Standards + Spec) |
| `tdd` | Desenvolvimento guiado por testes (red-green-refactor) |
| `improve-architecture` | Encontrar oportunidades de deepening arquitetural |
| `codebase-design` | Vocabulário shared para design de módulos |
| `diagnosing-bugs` | Diagnóstico sistemático de bugs |
| `domain-modeling` | Manter CONTEXT.md e ADRs atualizados |
| `to-spec` | Converter conversa em spec formal |
| `to-tickets` | Quebrar spec em tickets tracer-bullet |
| `grilling` | Entrevista implacável para refinar specs/planos |
| `prototype` | Prototipagem rápida (lógica + UI separados) |
| `browser-qa` | QA autônomo via Chrome DevTools MCP |
| `handoff` | Documento de handoff para próxima sessão |
| `retro` | Retrospectiva do trabalho feito |
| `research` | Pesquisa estruturada com sub-agentes |
| `write-swift` | Boas práticas Swift 6.2 modernos |

## Issue Tracker

Issues e specs vivem como GitHub Issues. Ver `.agents/skills/to-spec/SKILL.md` e `.agents/skills/to-tickets/SKILL.md` para workflow.

## Personas do Time

Ver `.agents/skills/` para as 5 personas especializadas. Detalhes completos de cada persona em `docs/product/personas.md` (a criar conforme necessidade).
