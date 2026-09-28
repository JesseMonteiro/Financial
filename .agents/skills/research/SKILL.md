---
name: research
description: "Pesquisa estruturada usando sub-agentes paralelos de investigação. Use quando precisar entender uma área do codebase, uma API externa, ou uma tecnologia antes de tomar decisões de implementação."
---

# Research — Pesquisa Estruturada

Pesquisa eficiente usa sub-agentes paralelos para cobrir diferentes aspectos de uma questão simultaneamente, depois consolida os achados em insights acionáveis.

## Quando usar

- Entender como uma área complexa do MeuFlux funciona antes de modificá-la
- Investigar uma API externa (Pluggy, Gemini, Supabase) antes de integrar
- Entender um bug antes de diagnosticá-lo
- Comparar abordagens alternativas para uma feature

## Process

### 1. Definir a Questão de Pesquisa

Formular uma questão clara e específica:
- ❌ "Como funciona o chatbot?"
- ✅ "Como o handleEdgeChatbotMessage processa intents e como os dados financeiros são injetados no contexto do Gemini?"

Uma boa questão de pesquisa tem uma resposta que pode guiar uma decisão de implementação.

### 2. Identificar Vetores de Pesquisa

Dividir a questão em vetores independentes para paralelizar:

**Exemplo para pesquisa do chatbot:**
- Vetor A: Como as intents são classificadas (server/routes/chatbot.js)
- Vetor B: Como o contexto financeiro é montado (server/services/geminiService.js)
- Vetor C: Como o Telegram bot difere do chatbot web

### 3. Spawnar Sub-agentes de Pesquisa

Criar um sub-agente por vetor:

```
Sub-agente A: Ler server/routes/chatbot.js e server/services/geminiService.js.
              Mapear o fluxo de classificação de intent.
              Retornar: diagrama do fluxo + dados de entrada/saída de cada step.

Sub-agente B: Ler src/services/api.js e o Edge handler de financialMoment.
              Entender como os dados financeiros chegam ao contexto do Gemini.
              Retornar: quais dados são incluídos no contexto, em que formato.
```

### 4. Consolidar

Após os sub-agentes retornarem, consolidar em:

```markdown
## Achados

### [Vetor A]
[Resumo do que foi descoberto]

### [Vetor B]
[Resumo do que foi descoberto]

## Insights para a Decisão
- [Implicação 1 para a decisão de implementação]
- [Implicação 2]

## Áreas de Incerteza
- [O que ainda não está claro]
- [O que precisaria de investigação adicional]

## Recomendação
[O que fazer com base na pesquisa]
```

### 5. Profundidade Adaptativa

Se a questão é simples (arquivo único, função clara), não spawnar sub-agentes — ler diretamente. Sub-agentes têm overhead; usar quando a pesquisa genuinamente se beneficia de paralelismo e isolamento de contexto.
