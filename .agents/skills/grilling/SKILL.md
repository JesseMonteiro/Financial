---
name: grilling
description: "Entrevista implacável para refinar um plano, spec, ou decisão de design. Use quando houver ambiguidade em requisitos, quando uma decisão de arquitetura precisa ser tomada, ou como base para o grill-me."
---

# Grilling — Entrevista de Refinamento

Grilling é uma conversa estruturada cujo único output são decisões. O agente faz rounds de perguntas — nunca mais de 3 por round — cada uma com uma **resposta recomendada anexada**. O usuário responde, e a conversa avança até que não haja mais ambiguidade.

## Regras do Grilling

1. **Nunca mais de 3 perguntas por round.** Se houver mais, priorize as 3 mais importantes.
2. **Cada pergunta tem uma recomendação.** Formatar como `→ Recomendo: [resposta recomendada] porque [razão curta]`
3. **Implacável, não exaustivo.** Foco nas decisões que mais impactam a implementação.
4. **Uma decisão por pergunta.** Não combinar múltiplas decisões numa pergunta.
5. **Progredir sempre.** Cada round deve reduzir a ambiguidade, não aumentá-la.

## Formato de Pergunta

```
**P[N]: [Pergunta clara e específica]**
Contexto: [por que esta pergunta importa]
→ Recomendo: [resposta recomendada]
Porque: [razão da recomendação]
```

## Process

### 1. Ler o contexto primeiro

Antes de começar a grelhar:
- Ler `.agents/CONTEXT.md` para vocabulário do domínio
- Ler `.agents/AGENTS.md` para regras operacionais
- Entender o que já está decidido vs. o que está em aberto

### 2. Mapear as ambiguidades

Identificar todas as perguntas abertas. Ordenar por impacto:
- Quais decisões desbloqueiam outras?
- Quais mudam fundamentalmente a implementação?
- Quais são apenas detalhes?

Começar pelas que têm maior impacto.

### 3. Round de perguntas

Apresentar 1-3 perguntas com recomendações. Aguardar resposta.

Exemplo:
```
Round 1:

**P1: As faturas devem incluir o ciclo aberto (compras não faturadas) no total?**
Contexto: Isso muda se o usuário vê "o que já fechou" ou "o que vai vencer"
→ Recomendo: Sim, exibir ciclo aberto separado mas incluído no total projetado
Porque: O usuário precisa saber o impacto real, não só o que já fechou

**P2: Filtro por perfil (eu vs. cônjuge) deve afetar o Momento Financeiro?**
Contexto: Se sim, muda a arquitetura de todos os handlers
→ Recomendo: Sim, mas como parâmetro opcional com "todos" como default
Porque: Consistência com o ProfileContext já existente
```

### 4. Registrar decisões

Cada decisão tomada vai para um log:
```
Decisão: [o que foi decidido]
Razão: [por que]
Alternativas descartadas: [o que não vai ser feito]
```

Se a decisão for durável (vai impactar agentes futuros), propor um ADR via `domain-modeling` skill.

### 5. Definition of Done

O grilling está completo quando um agente implementador poderia começar sem fazer uma única pergunta. Grelhar até então.
