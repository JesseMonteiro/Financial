---
name: diagnosing-bugs
description: "Diagnóstico sistemático de bugs no MeuFlux. Use quando um bug foi reportado mas a causa raiz não é clara, quando um comportamento inesperado ocorre em produção, ou quando testes de fixture falham."
---

# Diagnosing Bugs — Diagnóstico Sistemático

Diagnóstico de bugs é separado de correção. Esta skill é sobre **encontrar a causa raiz**, não sobre consertar. A correção pertence ao `tdd` skill (escreva um teste que reproduz o bug, depois corrija).

## Os 3 Ambientes do MeuFlux

Bugs podem existir em qualquer camada:

```
Web UI (React)        → src/utils/, src/stores/, src/components/
Edge Function (Deno)  → supabase/functions/pluggy-proxy/
Server (Node)         → server/services/, server/routes/
Telegram Bot          → server/routes/chatbot.js
iOS (Swift)           → ios/Packages/
Paridade              → divergência entre os anteriores
```

Identifique em qual camada o bug se manifesta antes de investigar.

## Process

### 1. Reprodução Mínima

Antes de qualquer investigação:
1. Reproduzir o bug de forma controlada
2. Identificar o menor input que o provoca
3. Confirmar se é reproduzível (flaky vs. determinístico)

```bash
# Para bugs de fatura, usar fixtures:
npm run test:fixtures

# Para bugs de cálculo, isolar a função pura:
node -e "const { calcBillPeriod } = require('./src/utils/creditBillPeriod.js'); console.log(calcBillPeriod(...))"
```

### 2. Binary Search com Git

Se o bug regrediu (funcionava antes), usar git bisect:

```bash
git bisect start
git bisect bad              # HEAD está quebrado
git bisect good <commit>    # este commit funcionava
# Git vai checkoutar commits até encontrar a regressão
```

### 3. Hipóteses Estruturadas

Formular hipóteses antes de adicionar `console.log`:

```
Observação: [o que acontece]
Esperado: [o que deveria acontecer]
Hipótese 1: [causa mais provável]
Hipótese 2: [causa alternativa]
Teste para H1: [como confirmar/refutar]
```

Testar uma hipótese por vez. Uma hipótese refutada é progresso.

### 4. Bugs de Paridade

O tipo mais comum no MeuFlux: UI e Edge/Telegram retornam valores diferentes.

Diagnóstico:
```bash
# 1. Isolar o cálculo puro:
node scripts/validate-credit-fixtures.mjs

# 2. Comparar implementações:
diff src/utils/creditBillPeriod.js supabase/functions/pluggy-proxy/creditBillPeriod.ts

# 3. Testar com mesmo input:
# Chamar a função client-side e a Edge com os mesmos dados de fixture
```

### 5. Bugs de Conector

Para bugs em lógica de fatura/ciclo de um banco específico:
1. Ler `docs/connectors/[banco].md`
2. Verificar o profile em `src/utils/creditConnectors/profiles.js`
3. Comparar com fixture em `docs/fixtures/credit-bills/[banco]-open-cycle.json`
4. Rodar `npm run test:fixtures` com log detalhado

### 6. Loop HITL (Human-In-The-Loop)

Quando a investigação requer contexto que só o usuário tem:
1. Formular a pergunta mais específica possível
2. Mostrar o que foi descartado até aqui
3. Pedir o dado/contexto específico que falta
4. Voltar ao processo com a nova informação

Não fazer mais de 2-3 perguntas por round. Apresentar análise parcial para mostrar progresso.

### 7. Causa Raiz Encontrada

Documentar:
```
Causa raiz: [descrição precisa]
Arquivo(s) afetado(s): []
Por que aconteceu: []
Como reproduzir: []
Teste de regressão: [como verificar que a correção funciona]
```

Handoff para `tdd` skill: escrever o teste que reproduz o bug antes de corrigir.
