---
name: pr
description: "Gerar um Pull Request a partir de uma spec ou conjunto de tickets, usando implementadores paralelos em git worktrees. Inclui code-review final antes de marcar o PR como ready. Use para features grandes com múltiplos tickets interdependentes."
---

# PR — Pull Request com Implementadores Paralelos

Esta skill orquestra a implementação de uma feature completa como um Pull Request, usando worktrees e sub-agentes paralelos para maximizar concorrência.

## Quando usar

Usar quando houver:
- Uma spec aprovada (via `to-spec`)
- Múltiplos tickets (via `to-tickets`) com pelo menos algumas dependências paralelas
- Necessidade de um PR formal para review

Para mudanças pequenas e single-ticket, implementar diretamente sem este fluxo.

## Process

### 1. Criar a Branch de PR

```bash
git checkout -b feature/<slug>
```

### 2. Analisar os Tickets

A partir dos tickets (GitHub Issues ou `.scratch/`):
1. Identificar tickets sem dependências (podem começar imediatamente)
2. Mapear o grafo de dependências
3. Determinar o máximo de paralelismo possível

### 3. Criar Worktrees para Implementadores Paralelos

```bash
git worktree add .scratch/worktrees/implementer-1 -b impl/ticket-1
git worktree add .scratch/worktrees/implementer-2 -b impl/ticket-2
```

Cada implementador trabalha em seu próprio worktree, sem conflitos.

### 4. Spawnar Implementadores

Spawnar um sub-agente por ticket (tickets sem dependências em paralelo):

```
Implementer-1: Implementar ticket 1 (nenhum bloqueador)
  - Ler o ticket completo
  - Ler arquivos relevantes do codebase
  - Implementar e commitar no worktree
  - Rodar npm run lint e testes de fixture
  - Retornar: diff, testes passando, checklist

Implementer-2: Implementar ticket 2 (nenhum bloqueador)
  [mesmo processo]
```

### 5. Merge dos Worktrees para a Branch de PR

Após cada implementador completar:

```bash
# No worktree principal
git merge impl/ticket-1
npm run lint  # verificar após merge
```

Resolver conflitos se necessário antes de mergear o próximo.

### 6. Verificar Fronteira

Após cada merge, verificar se novos tickets foram desbloqueados. Spawnar novos implementadores para os recém-desbloqueados.

### 7. Code Review Final

Com todos os tickets implementados e mergeados:

```bash
# Via code-review skill
# Fixed point: main (ou o commit antes da branch)
git diff main...feature/<slug>
```

Correções do code review em um único implementador de cleanup.

### 8. Browser QA

Se houve mudanças de UI: rodar `browser-qa` skill na branch.

### 9. Marcar como Ready

```bash
gh pr create \
  --title "feat: [título da feature]" \
  --body "Closes #<issue-número>\n\n[resumo das mudanças]" \
  --base main
```

### 10. Limpeza

```bash
git worktree remove .scratch/worktrees/implementer-1
git worktree remove .scratch/worktrees/implementer-2
git branch -d impl/ticket-1 impl/ticket-2
```
