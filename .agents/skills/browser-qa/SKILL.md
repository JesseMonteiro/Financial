---
name: browser-qa
description: "QA autônomo via Chrome DevTools MCP após toda implementação de UI. Valida a UI real em viewports mobile (390x844) e desktop (1280x800). Step obrigatório antes de marcar qualquer mudança de UI como done."
---

# Browser QA — Validação Autônoma no Browser

Esta skill define o QA obrigatório via browser que roda **depois de toda implementação** e **depois dos testes automatizados passarem**. Usa Chrome DevTools MCP.

## Pré-requisitos

1. `npm run lint` passa (0 erros Oxlint)
2. `npm run test:fixtures` passa (todos os bancos)
3. Dev server rodando (`npm run dev` — iniciar se não estiver, porta 5173)

## Rotas do MeuFlux para Verificar

Por domínio de mudança, verificar as rotas afetadas:

| Domínio | Rotas Principais |
|---------|------------------|
| Dashboard | `/` |
| Cartões/Faturas | `/cartoes` |
| Transações | `/transacoes` |
| Contas | `/contas` |
| Orçamento | `/orcamento` |
| Relatórios | `/relatorios` |
| Metas | `/metas` |
| Configurações | `/configuracoes` |
| Login | `/login` |

Se a mudança afetou lógica compartilhada (ex: creditBillPeriod), verificar TODAS as rotas que mostram valores financeiros.

## Runbook

### Step 1 — Identificar Rotas Afetadas

Do escopo da implementação, listar toda rota que a mudança pode afetar. Incluir:
- A rota primária sendo mudada
- Qualquer rota que consome os mesmos dados

### Step 2 — Validação Mobile (390×844)

Para **cada rota afetada**:

1. **Navegar**: `navigate_page` para `http://localhost:5173<rota>`
2. **Redimensionar**: `resize_page` para 390×844 (iPhone 14)
3. **Aguardar conteúdo**: `wait_for` o indicador principal (card de dados, título da página)
4. **Screenshot**: `take_screenshot` — salvar em artifacts como `qa-mobile-<rota>.png`
5. **Accessibility snapshot**: `take_snapshot` — verificar:
   - Botões/links sem nome acessível
   - Níveis de heading que pulam (h1 → h3)
   - Elementos interativos fora da tab order
6. **Console check**: `list_console_messages` com `types: ["error", "warning"]`
   - Qualquer JS error = **FAIL**
   - React warnings (key, hook order) = **FAIL**
7. **Inspeção visual do screenshot**:
   - Overflow horizontal = **FAIL**
   - Texto cortado = **FAIL**
   - Touch targets < 44px = **FAIL**
   - Liquid Glass com valores financeiros errados = **FAIL**

### Step 3 — Validação Desktop (1280×800)

Para as mesmas rotas:

1. `resize_page` para 1280×800
2. `take_screenshot` — salvar como `qa-desktop-<rota>.png`
3. Verificar layout de sidebar/nav
4. Verificar que charts/gráficos renderizam
5. Console check (mesmos critérios)

### Step 4 — Parity Check

Se a mudança afetou lógica financeira, verificar paridade:

```bash
# Rodar testes de fixture para confirmar parity Edge vs client
npm run test:fixtures

# Se o chatbot foi afetado, verificar retorno do Gemini
# (testar manualmente no UI ou via Telegram)
```

### Step 5 — Relatório

Gerar relatório com:
- Screenshots de mobile e desktop (links para artifacts)
- Lista de rotas verificadas
- Console clean: ✓ / ✗
- A11y issues encontrados
- Parity status
- **Verdict: PASS** (tudo ok) ou **FAIL** (issues a corrigir)

Em caso de FAIL, listar cada issue com:
- Rota onde apareceu
- Descrição do problema
- Screenshot relevante

O item não fecha sem um **PASS** documentado.

## Integração com Design Critique Loop

Após PASS do QA:
1. Screenshots vão para Lucas Silva (`lucas_silva_frontend`) para critique de design
2. Lucas emite `IMPROVE` (volta para implementador) ou `APPROVED`
3. Loop continua até `APPROVED`
4. Apenas `APPROVED` permite fechar o item
