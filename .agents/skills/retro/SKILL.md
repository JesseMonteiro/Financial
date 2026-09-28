---
name: retro
description: "Retrospectiva do trabalho feito. Use ao final de uma feature, sprint, ou sessão para capturar aprendizados e melhorias para o próximo ciclo."
---

# Retro — Retrospectiva

Uma retrospectiva captura o que foi aprendido para melhorar o próximo ciclo. É curta, honesta, e orientada a ação.

## Formato

```markdown
# Retro — [Feature/Período]

## O que foi feito
[Resumo conciso do trabalho completado]

## O que funcionou bem ✓
- [O que deve ser repetido nos próximos ciclos]
- [Práticas que aceleraram o trabalho]
- [Decisões que se mostraram certas]

## O que não funcionou ✗
- [O que causou fricção ou atrasos]
- [Decisões que precisariam ser revisadas]
- [Processos que poderiam ser melhorados]

## Surpresas
- [Coisas que foram mais difíceis ou fáceis do que o esperado]
- [Descobertas inesperadas no codebase]

## Action Items
- [ ] [Ação concreta para o próximo ciclo, com owner]
- [ ] [Melhoria de processo ou tooling]

## Débito Técnico Identificado
- [O que foi deixado para trás propositalmente]
- [O que precisaria ser endereçado antes de escalar]
```

## Process

### 1. Reunir Fatos

Antes de opinar, reunir o que aconteceu:
- Quantos tickets foram completados vs. planejados?
- Quais bugs foram encontrados?
- Quais testes foram adicionados?
- Quanto tempo foi gasto em debugging vs. implementação?

### 2. Ser Honesto sobre Problemas

A retro só tem valor se os problemas reais são nomeados. Evitar:
- Retrospectivas puramente positivas (todo ciclo tem fricção)
- Atribuição de culpa a pessoas (focar em processos e sistemas)
- Problemas vagos sem action item

### 3. Action Items são Concretos

Cada action item deve ser:
- Específico (o que exatamente)
- Acionável (pode ser feito no próximo ciclo)
- Opcionalmente com owner (quem vai fazer)

### 4. Salvar

Se o usuário quiser registrar, salvar em `.agents/retros/YYYY-MM-DD-<feature>.md`.
Se for memória de sessão apenas, apresentar no chat e não salvar.
