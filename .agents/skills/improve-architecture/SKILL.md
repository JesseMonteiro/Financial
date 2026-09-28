---
name: improve-architecture
description: "Scan do codebase MeuFlux em busca de oportunidades de deepening arquitetural. Apresenta candidatos como relatório HTML visual, depois grilla sobre o escolhido. Use quando houver fricção repetida numa área do código ou quando quiser melhorar testabilidade."
---

# Improve Architecture — Deepening Oportunidades

Superficiar fricção arquitetural e propor **oportunidades de deepening**: refatores que transformam módulos rasos em profundos. O objetivo é testabilidade e navegabilidade por agentes de IA.

Esta skill usa o vocabulário do `codebase-design` skill: **módulo, interface, depth, seam, adapter, leverage, locality**.

## Process

### 1. Escopo antes de Escanear (YAGNI)

- Se o usuário nomeou uma direção, seguir ela
- Caso contrário, analisar o histórico de commits para encontrar hot spots:

```bash
# Encontrar arquivos que mais mudam
git log --oneline -100 | head -50
git log --oneline --name-only -50 | sort | uniq -c | sort -rn | head -20
```

Concentrar atenção nas áreas que aparecem frequentemente. Se não houver hot spot claro, ampliar o escopo.

Ler `.agents/CONTEXT.md` antes de explorar.

### 2. Exploração Orgânica

Spawnar sub-agente para caminhar pelo codebase. Não seguir heurísticas rígidas — explorar organicamente e notar onde há fricção:

- Onde entender um conceito requer saltar entre vários arquivos pequenos?
- Onde módulos são **rasos** (interface quase tão complexa quanto a implementação)?
- Onde funções puras foram extraídas apenas para testabilidade, mas os bugs reais se escondem em como são chamadas (sem **locality**)?
- Onde módulos tightly coupled vazam pelos seus seams?
- Quais partes são difíceis de testar através da interface atual?

Aplicar o **deletion test** a qualquer módulo suspeito de ser raso.

### 3. Áreas de Atenção no MeuFlux

Áreas historicamente com fricção:

- **`src/utils/creditBillPeriod.js`**: lógica complexa de fatura que é difícil de testar?
- **`server/routes/chatbot.js`**: handleEdgeChatbotMessage — muito acoplado?
- **`src/stores/*.js`**: stores com lógica de negócio que deveria estar em utils?
- **`supabase/functions/pluggy-proxy/handlers/`**: handlers muito grandes?
- **Paridade Edge vs client**: duplicação de lógica que diverge?

### 4. Relatório HTML Visual

Escrever arquivo HTML self-contained em `/tmp/architecture-review-<timestamp>.html`:

```bash
open /tmp/architecture-review-<timestamp>.html
```

O relatório usa **Tailwind via CDN** e **Mermaid via CDN**. Cada candidato recebe um card com:

- **Arquivos**: quais módulos são afetados
- **Problema**: por que a arquitetura atual causa fricção
- **Solução**: o que mudaria (em inglês claro)
- **Benefícios**: em termos de locality e leverage, como os testes melhorariam
- **Before/After diagram**: side-by-side Mermaid ilustrando o deepening
- **Força da recomendação**: badge `Strong` / `Worth exploring` / `Speculative`

Finalizar com uma seção **Top Recommendation** nomeando o candidato a atacar primeiro.

Usar vocabulário do `.agents/CONTEXT.md` para nomes de domínio.

**Não propor interfaces ainda.** Após escrever o arquivo, perguntar: "Qual desses você quer explorar?"

### 5. Grilling Loop

Quando o usuário escolher um candidato, rodar o `grilling` skill para caminhar a árvore de decisão: constraints, dependências, forma do módulo deepened, o que fica atrás do seam, quais testes sobrevivem.

Efeitos colaterais inline conforme decisões cristalizam:
- Nomear novo módulo que não está no CONTEXT.md? Adicionar ao CONTEXT.md
- Usuário rejeitar candidato com razão importante? Propor ADR
