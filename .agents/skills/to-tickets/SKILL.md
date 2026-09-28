---
name: to-tickets
description: "Quebrar uma spec, plano, ou conversa em tickets tracer-bullet verticais, cada um declarando suas dependências. Publica como GitHub Issues com blocking edges ou como arquivos locais em .scratch/."
---

# To Tickets — Quebrar em Tickets Tracer-Bullet

Quebre trabalho em **tickets tracer-bullet**: cada ticket corta um caminho estreito mas completo por todas as camadas (schema → API → UI → testes).

## Process

### 1. Reunir Contexto

Trabalhar a partir do que já está na conversa. Se o usuário passou uma referência (número de issue, URL), buscar e ler o conteúdo completo.

```bash
gh issue view <número> --json title,body,comments
```

### 2. Explorar o Codebase

Se ainda não explorou, entender o estado atual do código. Nomes e descrições de tickets devem usar o vocabulário de `.agents/CONTEXT.md` e respeitar ADRs existentes.

Buscar oportunidades de **prefactoring**: "Make the change easy, then make the easy change."

### 3. Draftar Vertical Slices

Regras:
- Cada slice corta caminho completo: schema Supabase → Edge handler → client store → componente → teste
- Um slice completo é demonstrável ou verificável por conta própria
- Cada slice cabe numa única janela de contexto
- Prefactoring vem primeiro (ticket bloqueador)

**Camadas típicas no MeuFlux:**
```
Schema Supabase migration
↓
Edge Function handler (supabase/functions/pluggy-proxy/)
↓  
Server service (server/services/) — se necessário
↓
Zustand store (src/stores/)
↓
React component/page (src/components/ ou src/pages/)
↓
Teste de fixture ou unit test
```

### 4. Refactors Amplos (Wide Refactors)

Exception ao vertical slicing. Um **wide refactor** é uma mudança mecânica única (renomear campo, mudar tipo compartilhado) cujo blast radius abrange todo o codebase. Usar **expand-contract**:

1. **Expand**: adicionar nova forma ao lado da antiga (nada quebra)
2. **Migrate**: migrar call sites em batches (por diretório/package)
3. **Contract**: deletar a forma antiga quando não restar callers

### 5. Apresentar ao Usuário

```
Ticket 1: [Título]
Bloqueado por: nenhum (pode começar imediatamente)
Entrega: [comportamento end-to-end que este ticket faz funcionar]

Ticket 2: [Título]
Bloqueado por: Ticket 1
Entrega: [comportamento]
```

Perguntar:
- A granularidade está certa? (muito granular / muito amplo)
- Os blocking edges estão corretos?
- Algum ticket deve ser dividido ou mesclado?

Iterar até aprovação.

### 6. Publicar

**Como GitHub Issues:**
```bash
# Criar em ordem de dependência (blockers primeiro)
gh issue create \
  --title "[título]" \
  --body "## What to build\n[comportamento]\n\n## Acceptance criteria\n- [ ] critério 1\n\n## Blocked by\nNone (can start immediately)" \
  --label "ready-for-agent"
```

**Como arquivos locais (alternativa):**
```
.scratch/<feature-slug>/issues/
  01-<slug>.md
  02-<slug>.md
  ...
```

Template de arquivo local:
```markdown
# NN: [Título]

**What to build:** [comportamento end-to-end do ponto de vista do usuário]

**Blocked by:** None | [tickets bloqueadores]

**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```
