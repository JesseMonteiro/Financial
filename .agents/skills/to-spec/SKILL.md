---
name: to-spec
description: "Converter uma conversa, ideia, ou issue em um spec formal com problem statement, user stories, implementation decisions e testing decisions. Publica como GitHub Issue com label ready-for-agent."
---

# To Spec — Converter em Spec Formal

Uma boa spec permite que um agente implementador comece sem fazer perguntas. Esta skill transforma contexto de conversa em especificação precisa.

## Process

### 1. Entender o Problema

Se necessário, rodar o `grilling` skill para refinar a ideia antes de escrever a spec. A spec só começa quando as perguntas centrais estão respondidas.

Ler `.agents/CONTEXT.md` para usar o vocabulário correto do domínio.

### 2. Identificar os Seams de Teste

Antes de escrever a spec, mapear em qual seam o comportamento será testado:

```
Seams disponíveis no MeuFlux:
- npm run test:fixtures  (lógica de fatura)
- npm run test:budget    (período de orçamento)
- src/utils/*.js         (funções puras)
- server/services/*.js   (serviços — mockar deps externas)
- supabase/functions/    (Edge — integração)
- ios/Packages/          (Swift — swift test)
- browser-qa skill       (UI end-to-end)
```

Confirmar os seams com o usuário. A spec deve nomear explicitamente onde os testes vão ficar.

### 3. Escrever o Spec

Usar o template abaixo. Publicar como GitHub Issue.

```markdown
## Problem Statement

[O problema que o usuário está enfrentando, da perspectiva do usuário.]

## Solution

[A solução para o problema, da perspectiva do usuário. Sem detalhes de implementação.]

## User Stories

1. Como [ator], quero [feature], para que [benefício]
2. Como [ator], quero [feature], para que [benefício]
[lista longa e extensiva — cobrir todos os aspectos da feature]

## Implementation Decisions

- Módulos que serão criados/modificados
- Interfaces desses módulos
- Clarificações técnicas
- Decisões de arquitetura
- Mudanças de schema Supabase (se aplicável)
- Paridade: quais endpoints Edge precisam ser atualizados
- iOS: quais packages Swift são afetados (se aplicável)

[Não incluir caminhos de arquivo ou código — ficam desatualizados rápido.]
[Exceção: se um protótipo gerou um snippet que encoda uma decisão precisamente, inlineá-lo e anotar que veio de protótipo.]

## Testing Decisions

- Seam onde os testes vão (ex: `src/utils/creditBillPeriod.js`)
- O que faz um bom teste aqui (comportamento via interface pública)
- Prior art: testes similares existentes no projeto
- Parity checks necessários (UI ↔ Edge ↔ Telegram)

## Out of Scope

[O que explicitamente NÃO está no escopo desta spec.]

## Further Notes

[Qualquer contexto adicional relevante.]
```

### 4. Publicar no GitHub

```bash
# Criar issue com label ready-for-agent
gh issue create \
  --title "[título da spec]" \
  --body-file spec.md \
  --label "ready-for-agent"
```

Retornar a URL do issue criado para referência.
