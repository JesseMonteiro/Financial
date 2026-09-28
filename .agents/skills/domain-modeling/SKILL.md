---
name: domain-modeling
description: "Manter CONTEXT.md com termos canônicos do domínio e registrar decisões duráveis como ADRs. Use quando surgir um novo conceito financeiro, quando um termo precisar ser canonicalizado, ou quando uma decisão de arquitetura for tomada."
---

# Domain Modeling — CONTEXT.md e ADRs

O domínio financeiro do MeuFlux tem conceitos complexos e específicos (fatura, ciclo aberto, conector, paridade). Esta skill garante que esses conceitos tenham nomes canônicos documentados e que decisões duráveis sejam registradas.

## Quando usar

- Um novo conceito financeiro emerge na conversa (ex: "reconciliação de notificação push")
- Um termo está sendo usado inconsistentemente no código
- Uma decisão de arquitetura é tomada que vai impactar futuros agentes
- Um conector novo de banco é adicionado

## Atualizando CONTEXT.md

O CONTEXT.md vive em `.agents/CONTEXT.md`. Siga o formato:

```markdown
**[Nome Canônico]** (Termo em inglês se aplicável)
[Definição precisa de uma frase.]
_Avoid_: [termos alternativos que causam confusão]
```

Regras:
- O nome canônico é o que aparece em variáveis, funções, e comentários de código
- Sempre incluir o que **evitar** — isso é tão importante quanto a definição
- Manter a definição curta e precisa; detalhes de implementação ficam em `docs/connectors/`
- Atualizar inline enquanto a conversa resolve coisas; não esperar o final da sessão

## Registrando ADRs

Decisões duráveis (que um agente futuro precisaria para não refazer o mesmo debate) vão como ADRs.

Formato: `.agents/decisions/ADR-NNN-[slug].md`

```markdown
# ADR-NNN: [Título]

## Status
proposed | accepted | deprecated

## Context
O que motivou esta decisão. Qual problema estava sendo resolvido.

## Decision
O que foi decidido. Seja específico.

## Consequences
- **Positivo:** ...
- **Negativo:** ...
- **Neutro:** ...
```

### Decisões que merecem ADR
- Mudança de como faturas são agrupadas (ex: por billId vs. por mês)
- Novo conector de banco com comportamento diferente
- Mudança na estratégia de paridade (Edge vs. client)
- Decisão de não implementar algo ("por que não usamos X")

### Decisões que NÃO precisam de ADR
- Escolhas óbvias de implementação
- Razões efêmeras ("não vale agora")
- Coisas que o tooling (oxlint) já governa

## Conectores de Crédito

Para cada banco suportado, existe documentação em `docs/connectors/[banco].md`. Ao adicionar suporte a novo banco ou corrigir comportamento existente:

1. Ler o guia existente em `docs/connectors/README.md`
2. Criar/atualizar `docs/connectors/[banco].md`
3. Adicionar/atualizar o profile em `src/utils/creditConnectors/profiles.js` e `supabase/functions/pluggy-proxy/creditConnectors/profiles.ts`
4. Adicionar fixture em `docs/fixtures/credit-bills/[banco]-open-cycle.json`
5. Verificar paridade com `npm run test:fixtures`
6. Documentar a decisão de comportamento como ADR se for não-óbvia

## Vocabulário Atual

Os termos canônicos vivem em `.agents/CONTEXT.md`. Ao nomear novos conceitos:
- Prefira nomes do domínio financeiro brasileiro ("fatura", não "bill")
- Prefira substantivos precisos sobre siglas
- Quando em inglês for necessário (código), usar o equivalente listado no CONTEXT.md
