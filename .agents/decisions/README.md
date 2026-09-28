# Architecture Decision Records — MeuFlux

Decisões duráveis de arquitetura ficam aqui como ADRs. Um ADR é necessário quando:
- Uma decisão vai impactar o trabalho de agentes futuros
- Uma alternativa foi descartada por razão não-óbvia
- Um comportamento específico de conector foi definido
- Uma estratégia de paridade foi escolhida

## Formato

Arquivos: `ADR-NNN-[slug-descritivo].md`

```markdown
# ADR-NNN: [Título Descritivo]

## Status
proposed | accepted | deprecated

## Data
YYYY-MM-DD

## Context
O que motivou esta decisão. Qual problema estava sendo resolvido.
Que alternativas foram consideradas.

## Decision
O que foi decidido. Seja específico e operacional.

## Consequences
- **Positivo:** o que fica mais fácil ou melhor
- **Negativo:** trade-offs e custos aceitos
- **Neutro:** mudanças que são apenas diferentes, não melhores ou piores
```

## ADRs Implícitos Existentes

As seguintes decisões já foram tomadas no projeto mas ainda não formalizadas como ADRs. 
São documentadas aqui para referência:

### Sobre Faturas
- **Indexar por mês de vencimento, não de compra.** Razão: o usuário pensa no impacto quando vai pagar, não quando comprou.
- **Nunca usar `account.balance` como total de ciclo aberto** quando equals `creditLimit - availableCreditLimit`. Razão: esse valor representa o total outstanding, não o ciclo aberto.
- **Deduplicar parcelas** contra transações reais PENDING/POSTED com mesmo padrão N/M na descrição.

### Sobre Paridade
- **Implementação duplicada client/Edge é intencional e obrigatória.** `creditBillPeriod.js` e `creditBillPeriod.ts` são espelhos. Razão: Edge Functions não podem importar módulos client-side; a duplicação é o custo da paridade.

### Sobre AI
- **Gemini 2.5 Flash como modelo padrão.** Para chatbot, STT e PDF parsing.
- **iOS usa Apple Intelligence com fallback Gemini.** On-device primeiro, cloud como fallback.
- **Chatbot retorna JSON estruturado (intent + data).** Não texto livre. Razão: permite parsing determinístico de ações.

Ver `.cursor/rules/credit-connectors.mdc` para as regras detalhadas de conectores.
