# Relatório Consolidado de Auditoria Técnica — MeuFlux

**Líder de Orquestração:** Ana Costa (`ana_costa_pm`)  
**Equipe de Especialistas:** Lucas Silva (Frontend), Rafael Mendes (Backend/Edge), Thiago Nunes (iOS), Carla Dias (QA)  
**Data:** 28 de Setembro de 2026  
**Status do Repositório:** 165 arquivos analisados, 114 warnings Oxlint, 8 fixtures bancárias validadas

---

## 1. Sumário Executivo & Diagnóstico Geral

A auditoria multidisciplinar do MeuFlux revelou uma aplicação rica em recursos de ponta a ponta (Open Finance brasileiro, inteligência artificial multimodal com Gemini 2.5 Flash, app nativo iOS moderno com Apple Intelligence e bot Telegram integrado), mas com **sérios pontos de atenção arquitetural, vulnerabilidades de segurança imediatas e dívida técnica estrutural**.

### Resumo do Diagnóstico por Camada:
- **Segurança (CRÍTICO):** Identificada exposição pública não autenticada de transações e saldos financeiros de todos os usuários via endpoint de resumo diário (`/telegram/daily-summary`), falta de validação de segredo no webhook do Telegram no Express e cache multi-tenant vulnerável a cross-user pollution.
- **Backend & Edge (ALTO):** Dois god-files concentram o sistema (`pluggy-proxy/index.ts` com 2.231 linhas e `chatbot.js` com 1.240 linhas). Embora haja paridade matemática estrita em `creditBillPeriod`, há drift semântico em categorias (`translateCategory`) e inconsistências de schema camelCase vs snake_case.
- **Frontend Web & Design (MÉDIO/ALTO):** 8 componentes de tela monolíticos entre 800 e 1.100 linhas com acoplamento cruzado (importação de modais entre páginas), cálculos de lógica de negócio e projeções de 24 meses embutidos no JSX, quebra de Fast Refresh do Vite e falha de contraste WCAG AA no token `--text-muted`.
- **iOS Nativo (MÉDIO):** Excelente uso de `@Observable` (100% de conformidade), mas com quebra de concorrência estruturada por 14 usos abusivos de `Task.detached`, pontos de gráfico usando `Double` e 0% de adoção do framework moderno `Swift Testing`.
- **QA & Testes (MÉDIO):** Ausência de um test runner unificado (Vitest); 0% de cobertura de testes unitários na fórmula mestre do Momento Financeiro; e as 8 fixtures bancárias possuem o array `transactions` vazio, não testando estornos nem parcelamentos reais.

---

## 2. Matriz de Vulnerabilidades & Débitos Técnicos por Severidade

| ID | Área | Descrição do Problema | Severidade | Esforço |
|---|---|---|---|---|
| **VULN-01** | Backend / Edge | Endpoint `/telegram/daily-summary?dryRun=true` público expondo dados de todos os usuários (bypass RLS) | 🔴 **Crítica** | Baixo |
| **VULN-02** | Backend Express | Webhook do Telegram sem validação do header `x-telegram-bot-api-secret-token` | 🔴 **Alta** | Baixo |
| **VULN-03** | Backend Express | Rota `POST /api/cache/clear` e webhooks desprotegidos permitindo DoS de cache e rate limit | 🔴 **Alta** | Baixo |
| **VULN-04** | Backend Express | Chave de cache em `cache.js` gravando sob `anonymous:` em falhas de auth, causando vazamento de dados | 🟠 **Alta** | Baixo |
| **BUG-01** | Frontend Web | `new Promise(async ...)` em `Accounts.jsx` engolindo erros no fluxo de conexão bancária | 🟠 **Alta** | Baixo |
| **BUG-02** | Frontend Web | `useMemo` em `JointFinancialMoment.jsx` omitindo `resolveCombinedSalary` gerando dados defasados | 🟠 **Alta** | Baixo |
| **ARCH-01** | Edge Function | God-file `pluggy-proxy/index.ts` com 2.231 linhas englobando rotas, bot Telegram, PDF e auth | 🟠 **Alta** | Médio |
| **ARCH-02** | Backend Express | God-file `server/routes/chatbot.js` com 1.240 linhas misturando transporte, IA e Markdown | 🟠 **Alta** | Médio |
| **PARITY-01**| Edge / Web | Drift semântico em categorias (`Groceries` = Supermercados vs Supermercado & Alimentação) | 🟡 **Média** | Baixo |
| **ARCH-03** | Frontend Web | Acoplamento circular: `CreditCards.jsx` importando modais de `ManualExpenses` e `Receivables` | 🟡 **Média** | Médio |
| **ARCH-04** | Frontend Web | Ausência de `src/utils/receivables.js` (cálculos de totais e projeções embutidos no JSX) | 🟡 **Média** | Baixo |
| **A11Y-01** | Design System | Token `--text-muted` (#94a3b8) com contraste 2.6:1 (reprovado na WCAG 2.1 AA) | 🟡 **Média** | Baixo |
| **IOS-01** | iOS / Swift | 14 usos de `Task.detached` quebrando concorrência estruturada e cancelamento cooperativo | 🟡 **Média** | Baixo |
| **IOS-02** | iOS / Swift | Tipagem monetária com `Double` no `Dashboard.swift` e conversão perigosa `Money(Decimal(double))` | 🟡 **Média** | Médio |
| **TEST-01** | QA / Testes | Ausência de runner unificado (Vitest) e zero testes para `computeFinancialMomentMonth` | 🟡 **Média** | Médio |
| **TEST-02** | QA / Testes | Fixtures de crédito com transações vazias (sem cobertura de parcelas 1/1, estornos e IOF) | 🟡 **Média** | Médio |
| **DX-01** | Frontend Web | Quebra de Fast Refresh em `AccountIcon.jsx` e `CategoryIcon.jsx` (`only-export-components`) | 🟢 **Baixa** | Baixo |

---

## 3. Detalhamento por Especialidade

### 3.1 Backend, Edge & Paridade (Rafael Mendes)
1. **Segurança do Resumo Diário:** O script `send-daily-telegram-summary.mjs` invoca a Edge Function e o servidor Express. A rota deve exigir o cabeçalho `Authorization: Bearer ${CRON_SECRET}` e rejeitar qualquer chamada externa não autorizada.
2. **Decomposição da Edge Function:**
   - Extrair a lógica do Telegram Bot (~1.440 linhas) para `handlers/telegram/botHandler.ts` e `handlers/telegram/dailySummary.ts`.
   - Mover a extração de fatura em PDF para `handlers/parseBill.ts`.
   - Fazer `v1/router.ts` assumir todas as rotas sem exceções que forcem fallback para o `index.ts`.
3. **Resolução de Drifts de Paridade:**
   - Criar uma fonte canônica para traduções de categorias (`src/utils/categories.js` ↔ Edge).
   - Adicionar compatibilidade com propriedades snake_case e camelCase em `src/utils/financialMomentMonth.js`.

### 3.2 Frontend Web & Design Liquid Glass (Lucas Silva)
1. **Extração de Modais Compartilhados:**
   - Criar a pasta `src/components/modals/` e migrar `PurchaseModal.jsx`, `ReceivableModal.jsx` e `AddManualAccountModal.jsx`.
   - Atualizar os imports em `CreditCards.jsx`, `ManualExpenses.jsx`, `Receivables.jsx` e `Accounts.jsx`, quebrando a dependência circular.
2. **Criação do Seam `src/utils/receivables.js`:**
   - Implementar `summarizeReceivables`, `receivableEffectiveTotal`, `groupReceivablesByPerson` e `reimbursementsReceivedInMonth`.
   - Remover mais de 160 linhas de cálculos e reduções matemáticas de `Receivables.jsx`.
3. **Design System & Acessibilidade:**
   - Atualizar `--text-muted` no tema claro para `#64748b` (contraste de **4.6:1**, atendendo WCAG AA).
   - Ajustar no tema escuro para `#94a3b8` (contraste **5.4:1**).
   - Garantir área de toque mínima de 44×44px no mobile para botões e links.

### 3.3 Aplicativo iOS & Swift 6.2 (Thiago Nunes)
1. **Eliminação de `Task.detached`:**
   - Em `BFFClient.swift`, `LiveLoadDashboard.swift` e `DashboardViewModel.swift`, invocar a decodificação JSON e construtores síncronos diretamente no fluxo estruturado.
2. **Precisão Monetária no Dashboard:**
   - Migrar `DashboardCashflowPoint` (`receita`, `despesa`, `net`), `DashboardSeriesPoint` e `DashboardCategoryExpense` para `Money` / `Decimal`.
   - Eliminar a conversão de ponto flutuante binário `Decimal(double)` em `DomainMapper.swift`.
3. **Pureza Arquitetural:**
   - Extrair o uso de `CryptoKit` de `NotificationImport.swift` para `MeuFluxCore`, garantindo zero imports fora de `Foundation` no `MeuFluxDomain`.

### 3.4 QA, Cobertura & Code Smells (Carla Dias)
1. **Erradicação dos Warnings do Oxlint:**
   - Mover `accountById` para `src/utils/accountIcons.js`.
   - Mover `CATEGORY_LUCIDE_ICONS` e `resolveLucideIcon` para `src/utils/categoryIcons.js`.
   - Corrigir o anti-pattern de `new Promise(async ...)` em `Accounts.jsx`.
   - Estabilizar dependências de hooks que usam `.join(',')`.
2. **Adoção do Vitest:**
   - Criar `vitest.config.js` e suite inicial com testes unitários para a função mestre `computeFinancialMomentMonth`.
   - Unificar os scripts soltos sob o comando padrão `npm test`.
3. **Expansão de Fixtures:**
   - Alimentar as fixtures com transações reais contemplando estornos, compras parceladas e faturas pagas parcialmente.

---

## 4. Plano de Ação em Fases Recomendado

```text
FASE 1: Segurança Imediata & Bugs Conhecidos (1-2 dias)
├── Bloqueio de endpoint público /telegram/daily-summary com CRON_SECRET
├── Validação de secret no webhook Telegram e proteção de cache
└── Correção dos 3 bugs de hooks e async promise executor (Oxlint)

FASE 2: Desacoplamento Frontend & Acessibilidade (2-3 dias)
├── Extração de modais para src/components/modals/
├── Criação de src/utils/receivables.js e desoneração do JSX
└── Ajuste de contraste WCAG AA nos tokens Liquid Glass

FASE 3: Modularização de God-Files & Paridade (3-4 dias)
├── Fatiamento de supabase/functions/pluggy-proxy/index.ts
├── Modularização de server/routes/chatbot.js
└── Alinhamento de categorias entre Edge e Web

FASE 4: Modernização iOS & Infraestrutura de Testes (3-4 dias)
├── Erradicação de Task.detached e Double no app iOS
├── Implantação do Vitest com suíte do Momento Financeiro
└── Enriquecimento das fixtures bancárias com casos reais
```
