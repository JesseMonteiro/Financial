---
name: code-review
description: "Review changes since a fixed point (commit, branch, or merge-base) along two axes: Standards (does the code follow MeuFlux coding standards and connector rules?) and Spec (does the code match what the issue/spec asked for?). Runs both reviews as parallel sub-agents and reports side-by-side. Use when the user wants to review a branch, a PR, or work-in-progress changes."
---

# Code Review — Dois Eixos

Review do diff entre `HEAD` e um ponto fixo, em dois eixos independentes:

- **Standards**: o código segue os padrões documentados do MeuFlux?
- **Spec**: o código implementa fielmente o que o issue/spec pediu?

Ambos rodam como **sub-agentes paralelos** para não poluir o contexto um do outro.

## Process

### 1. Pin the fixed point

Usar o que o usuário forneceu (SHA, branch, `main`, `HEAD~5`). Se não especificou, perguntar.

```bash
git rev-parse <fixed-point>          # confirma que resolve
git diff <fixed-point>...HEAD        # three-dot diff
git log <fixed-point>..HEAD --oneline
```

Confirmar que o diff é não-vazio antes de spawnar sub-agentes.

### 2. Identify the spec source

Buscar em ordem:
1. Referências de issue nos commit messages (`#123`, `Closes #45`)
2. Path passado como argumento
3. Spec file em `docs/`, `.scratch/`, ou `.agents/`
4. Se nada encontrado, perguntar ao usuário

### 3. Identify the standards sources

Padrões do MeuFlux:
- **`.cursor/rules/credit-connectors.mdc`** — regras críticas de conector de crédito
- **`.agents/CONTEXT.md`** — vocabulário do domínio e convenções
- **`.agents/AGENTS.md`** — regras operacionais
- **`docs/connectors/`** — comportamento por banco
- **`.oxlintrc.json`** — regras de linting
- **Paridade obrigatória:** `src/utils/creditBillPeriod.js` ↔ `supabase/functions/pluggy-proxy/creditBillPeriod.ts`

Além dos padrões documentados, o eixo Standards sempre aplica o **smell baseline de Fowler** (Refactoring, cap.3):

| Smell | O que é | Como corrigir |
|-------|---------|---------------|
| **Mysterious Name** | Função/variável com nome obscuro | Renomear; se difícil achar nome, o design está confuso |
| **Duplicated Code** | Mesma lógica em mais de um lugar | Extrair função/módulo compartilhado |
| **Feature Envy** | Método que acessa dados de outro objeto mais que os próprios | Mover o método para o objeto que ele inveja |
| **Data Clumps** | Mesmos campos viajando juntos sempre | Criar um tipo/objeto para agrupá-los |
| **Primitive Obsession** | Primitivo representando conceito de domínio | Criar tipo próprio (ex: `Money`, `BillId`) |
| **Repeated Switches** | Mesmo switch/if-cascade em vários lugares | Substituir por polimorfismo ou mapa compartilhado |
| **Shotgun Surgery** | Uma mudança lógica força edições em muitos arquivos | Consolidar no módulo correto |
| **Divergent Change** | Um arquivo editado por razões diferentes | Separar em módulos com responsabilidade única |
| **Speculative Generality** | Abstração para necessidade que o spec não tem | Deletar; simplificar |
| **Message Chains** | `a.b().c().d()` — navegação longa | Esconder a travessia atrás de um método |
| **Middle Man** | Classe/função que só delega | Cortar, chamar o alvo direto |

Regras do smell baseline:
- O padrão documentado do repo sempre vence o baseline
- Smells são julgamentos, não violações duras
- Pular o que o tooling (oxlint) já verifica

### 4. Spawn both sub-agents in parallel

**Prompt do Standards sub-agent:** inclui o comando diff completo, lista de standards sources colada integralmente (o sub-agente não tem outro acesso), e o smell baseline. Brief: "Reporte por arquivo/hunk (a) onde o diff viola um padrão documentado (cite arquivo + regra); (b) qualquer smell do baseline (nomeie e cite o hunk). Violações de padrão documentado podem ser hard; smells são sempre julgamentos. Pule o que o tooling verifica. Máximo 400 palavras."

**Prompt do Spec sub-agent:** inclui o comando diff, conteúdo do spec/issue. Brief: "Reporte (a) requisitos que o spec pediu que estão ausentes ou parciais; (b) comportamento no diff que o spec não pediu (scope creep); (c) requisitos aparentemente implementados mas incorretamente. Cite a linha do spec. Máximo 400 palavras."

Se não há spec, pular o Spec sub-agent e notar no relatório final.

### 5. Aggregate

Apresentar os dois relatórios sob `## Standards` e `## Spec`. Não mesclar nem reranquear — os eixos são deliberadamente separados.

Finalizar com uma linha de resumo: total de findings por eixo e o pior issue de cada eixo.

## Por que dois eixos?

- Código que segue todos os padrões mas implementa a coisa errada → **Standards pass, Spec fail**
- Código que faz exatamente o que o issue pediu mas viola convenções → **Spec pass, Standards fail**

Reportar separadamente evita que um eixo mascare o outro.
