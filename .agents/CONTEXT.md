# MeuFlux Context

Fonte única de verdade para o domínio de finanças do app. Use estes termos exatamente em código, comentários e documentação.

## Linguagem do Domínio

**Fatura**
Ciclo de cobrança de cartão de crédito, indexado pelo **mês de vencimento** (não o mês de compra). Agrupada pelo campo `billId` do Pluggy ou pelo mês de vencimento calculado internamente.
_Avoid_: Invoice, monthly bill, fatura mensal

**Ciclo Aberto** (Open Cycle)
Compras do período corrente que ainda não fecharam em fatura. Calculadas projetando compras recentes contra o prazo de fechamento do conector.
_Avoid_: Current period, pending bill, fatura aberta

**Conector** (Connector Profile)
Perfil de comportamento por instituição bancária que define como calcular fatura, ciclo aberto, e deduplicar parcelas. Vive em `src/utils/creditConnectors/profiles.js` e `supabase/functions/pluggy-proxy/creditConnectors/profiles.ts`.
_Avoid_: Bank adapter, provider config

**Momento Financeiro** (Financial Moment)
Visão consolidada da saúde financeira do usuário num dado mês: entradas, saídas, faturas, investimentos. É a tela principal do app.
_Avoid_: Dashboard, overview, summary

**Transação Manual** (Manual Transaction)
Despesa ou receita registrada diretamente pelo usuário (não via Pluggy). Armazenada na tabela `manual_transactions` do Supabase.
_Avoid_: Custom transaction, user transaction, fake transaction

**Liquid Glass**
Design system visual do MeuFlux inspirado no iOS 26 e visionOS. Usa backdrop-filter, gradientes translúcidos e hierarquia de superfícies.
_Avoid_: Glassmorphism (termo genérico)

**Paridade** (Parity)
Garantia de que UI Web (`src/utils/`), Edge Function (`supabase/functions/pluggy-proxy/`) e Telegram Bot retornam os mesmos números para a mesma consulta. Violação de paridade é um bug.
_Avoid_: Consistency, sync, alignment

**Conta Manual** (Manual Account)
Conta financeira criada pelo usuário sem conexão Pluggy (ex: dinheiro em carteira, conta no exterior).
_Avoid_: Fake account, custom account

**Benefício Alimentação / VA / VR**
Vale alimentação, Vale refeição. Saldo e transações de benefícios de alimentação gerenciados separadamente de contas bancárias.
_Avoid_: Food benefit, meal allowance

**Resumo Diário** (Daily Summary)
Resumo automático de transações do dia anterior, enviado via Telegram toda manhã. Gerado pelo `scripts/send-daily-telegram-summary.mjs`.
_Avoid_: Daily report, morning digest

**Perfil Conjunto** (Joint Profile)
Visão compartilhada de finanças entre o usuário principal e um dependente/cônjuge via `joint_accounts` no Supabase.
_Avoid_: Shared account, family account

**Importação de Notificação** (Notification Import)
Captura de transações via notificação push do banco no iOS, antes de sincronizar com Pluggy.
_Avoid_: Push notification transaction, notification parsing

## Convenções de Código

- Meses de fatura: indexar por **mês de vencimento** (due month), NUNCA por mês de compra
- Valores: sempre em **BRL centavos** internamente, formatar com `formatters.js` na UI
- Categorias: usar as chaves canônicas de `src/utils/categories.js`
- Ícones de conta: usar `src/utils/accountIcons.js`
- Logos de merchant: usar `src/utils/merchantLogos.js`
