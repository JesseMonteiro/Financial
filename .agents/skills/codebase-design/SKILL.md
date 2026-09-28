---
name: codebase-design
description: "Vocabulário shared para design de módulos profundos (deep modules) no MeuFlux. Use quando quiser projetar ou melhorar a interface de um módulo, encontrar onde colocar um seam, tornar código mais testável, ou quando outra skill precisar deste vocabulário."
---

# Codebase Design — Vocabulário de Módulos Profundos

Projete **módulos profundos**: muito comportamento atrás de uma interface pequena, posicionado num seam limpo, testável através dessa interface. Use esta linguagem onde código está sendo projetado ou reestruturado.

## Glossário

Use estes termos exatamente. Não substitua por "component", "service", "API", ou "boundary".

**Módulo**: qualquer coisa com interface e implementação. Escala-agnóstico: uma função, classe, package, ou slice. _Avoid_: unit, component, service.

**Interface**: tudo que um caller precisa saber para usar o módulo corretamente: assinatura, invariants, ordering constraints, error modes, configuração requerida, e características de performance.

**Implementação**: o que está dentro do módulo. Distinta do **Adapter**: um módulo pode ser um adapter pequeno com implementação grande (repositório Pluggy) ou um adapter grande com implementação pequena (fake in-memory).

**Depth (Profundidade)**: leverage na interface. Quantidade de comportamento que um caller pode exercitar por unidade de interface aprendida. Módulo **profundo** = muito comportamento atrás de interface pequena. Módulo **raso** = interface quase tão complexa quanto a implementação.

**Seam** (Michael Feathers): lugar onde você pode alterar comportamento sem editar nesse lugar; a *localização* onde a interface de um módulo vive.

**Adapter**: coisa concreta que satisfaz uma interface num seam.

**Leverage**: o que callers ganham com profundidade. Mais capacidade por unidade de interface aprendida.

**Locality**: o que maintainers ganham com profundidade. Mudanças, bugs, conhecimento, e verificação se concentram num lugar.

## Deep vs Shallow no MeuFlux

**Módulo profundo** (desejado):
```
┌──────────────────────────────┐
│  Interface pequena           │  ← ex: creditBillPeriod(account, transactions)
├──────────────────────────────┤
│  Implementação profunda:     │
│  - lida com closing vs due   │
│  - dedup parcelas            │  ← complexidade escondida
│  - profiles de conector      │
│  - edge cases por banco      │
└──────────────────────────────┘
```

**Módulo raso** (evitar):
```
┌──────────────────────────────┐
│  interface grande:           │  ← ex: 15 parâmetros, caller precisa saber tudo
│  (closingDate, dueDate,      │
│   isClosingDayShifted,       │
│   connector, profileKey...)  │
├──────────────────────────────┤
│  implementação pequena       │  ← pouco comportamento escondido
└──────────────────────────────┘
```

## Deletion Test

Quando suspeitar que um módulo é raso, aplique o **deletion test**: deletar o módulo concentraria a complexidade (bom sinal), ou apenas moveria para outro lugar (módulo é genuinamente raso, pode remover)?

## Seams no MeuFlux

| Seam | O que fica atrás |
|------|------------------|
| `src/utils/creditBillPeriod.js` | Toda lógica de cálculo de fatura/ciclo |
| `server/services/pluggyClient.js` | Toda comunicação com Pluggy API |
| `server/services/geminiService.js` | Toda comunicação com Gemini API |
| `src/stores/*.js` | Estado global (Zustand) |
| `supabase/functions/pluggy-proxy/handlers/` | BFF handlers |
| `ios/Packages/MeuFluxDomain/` | Domínio iOS puro |

## Design-it-Twice

Para interfaces importantes, projete pelo menos duas alternativas antes de escolher:

1. Escreva Interface A (mais óbvia)
2. Escreva Interface B (alternativa — pode ser mais simples, mais genérica, ou com tradeoffs diferentes)
3. Compare: qual tem mais depth? qual é mais fácil de testar?
4. Documente a escolha em `.agents/CONTEXT.md` se for durável
