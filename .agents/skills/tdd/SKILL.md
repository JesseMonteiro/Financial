---
name: tdd
description: "Test-driven development no MeuFlux. Use quando quiser construir features ou corrigir bugs test-first, mencionar red-green-refactor, ou adicionar testes de fixture para lógica financeira."
---

# TDD — Test-Driven Development no MeuFlux

O loop TDD é: **red → green → (refactor na code-review)**. Esta skill define o que é um bom teste no MeuFlux, onde os testes ficam, os anti-patterns, e as regras do loop.

Sempre ler `.agents/CONTEXT.md` antes de escrever testes, para que nomes e vocabulário de interface correspondam à linguagem de domínio do projeto.

## O que é um bom teste no MeuFlux

Testes verificam **comportamento através de interfaces públicas**, não detalhes de implementação. Um bom teste lê como uma especificação: "ciclo aberto do Nubank calcula corretamente com closingDate D-7" diz exatamente qual capacidade existe e sobrevive a refatores.

## Seams (Interfaces de Teste) no MeuFlux

Um **seam** é a fronteira pública onde você observa comportamento sem acessar internals.

```
Seams disponíveis (do mais alto ao mais baixo):

1. Fixture scripts (npm run test:fixtures)     ← preferido para lógica de fatura
   └── scripts/validate-credit-fixtures.mjs
   └── docs/fixtures/credit-bills/*.json

2. Pure utility functions (src/utils/)         ← cálculos financeiros puros
   └── creditBillPeriod.js
   └── budgetPeriod.js
   └── calculations.js

3. Server services (server/services/)          ← Gemini, Pluggy (mockar)
   └── geminiService.js
   └── pluggyClient.js

4. Edge handlers (supabase/functions/)         ← integração Edge
   └── pluggy-proxy/handlers/

5. Swift packages (ios/Packages/)              ← iOS domain logic
   └── MeuFluxDomain/Sources/MeuFluxDomain/
```

**Sempre confirmar o seam com o usuário antes de escrever qualquer teste.**

## Estrutura de Testes Existente

O MeuFlux usa fixture-based testing para lógica crítica de crédito:

```bash
npm run test:fixtures   # Valida ciclo de crédito para 8 bancos
npm run test:budget     # Verifica período de orçamento
npm run test:line-item  # Verifica formatação de line item
npm run test:categories # Verifica mapeamento de categorias Pluggy
npm run test:merchants  # Verifica matching de logos
npm run lint            # Oxlint (<200ms)
```

Para iOS:
```bash
cd ios && swift test
```

**Use os fixtures existentes em `docs/fixtures/credit-bills/` como prior art para novos testes de crédito.**

## Anti-patterns

- **Implementation-coupled**: mock de internals, testes de métodos privados, verificação por side-channel (query no banco em vez de usar a interface). O sinal: o teste quebra quando você refatora mas o comportamento não mudou.
- **Tautológico**: a assertion recalcula o valor esperado do mesmo jeito que o código faz (`expect(calcBill(d)).toBe(calcBill(d))`). Valores esperados devem vir de uma fonte independente: um literal conhecido, um exemplo calculado na mão, o spec.
- **Horizontal slicing**: escrever todos os testes primeiro, depois toda a implementação. Trabalhe em **vertical slices**: um teste → uma implementação → repetir.

## Regras do Loop

- **Red antes de green.** Escrever o teste que falha primeiro, depois apenas o código mínimo para passá-lo.
- **Um slice de cada vez.** Um seam, um teste, uma implementação mínima por ciclo.
- **Refactoring não é parte do loop.** Pertence ao `code-review` skill.

## Mocking no MeuFlux

Para `server/services/` que chamam APIs externas:
- Mockar o Pluggy client (`server/services/pluggyClient.js`) com dados de fixture
- Mockar o Gemini via `jest.mock` ou `vi.mock` retornando JSON válido
- Nunca fazer chamadas reais a APIs em testes

Para Swift:
- Usar protocols para injetar dependências
- `MockFinanceRepository` implementando `FinanceRepository` protocol
