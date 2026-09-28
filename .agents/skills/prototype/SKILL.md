---
name: prototype
description: "Prototipagem rápida separando lógica pura (LOGIC.md) de UI (UI.md) antes de implementar. Produce snippets que informam specs e decisions. Use quando houver incerteza sobre como uma feature vai funcionar ou parecer."
---

# Prototype — Prototipagem Rápida

Um protótipo é **efêmero por padrão**: construído para uma rodada, salvo num path de scratch ou `scripts/`, deletado quando o trabalho acaba. Commitá-lo apenas se representar um caminho de setup repetível.

O protótipo produz dois artefatos separados:
- **LOGIC.md**: lógica pura sem UI
- **UI.md**: interface sem lógica

Nunca misturar os dois. Esta separação reflete a arquitetura do MeuFlux onde `src/utils/` é puro e os componentes não calculam números.

## Process

### 1. Escopo do Protótipo

Definir o que o protótipo precisa responder:
- **Questão lógica**: como calcular [X] dado [Y]?
- **Questão de UX**: como mostrar [dados] de forma que faça sentido?
- **Questão de integração**: como [API A] e [API B] se combinam?

Um protótipo não precisa responder tudo. Focar na maior incerteza.

### 2. LOGIC.md — Lógica Pura

Protoype a lógica como funções puras em JavaScript vanilla (sem React, sem Zustand, sem fetch):

```javascript
// Exemplo: prototipar cálculo de ciclo aberto
function calcOpenCycle(transactions, closingDay, today = new Date()) {
  // lógica aqui
  return { total, items };
}

// Teste rápido com dados de exemplo
const result = calcOpenCycle(
  [{date: '2026-09-15', amount: -150, description: 'Mercado'}],
  7,  // closing day D-7
  new Date('2026-09-28')
);
console.log(result);
```

Executar com:
```bash
node .scratch/prototype-open-cycle.js
```

Se gerar insight útil para implementação, extrair o snippet relevante e incluir na spec via `to-spec`.

### 3. UI.md — Interface sem Lógica

Protoype a UI usando dados hardcoded (sem fetch, sem store):

```jsx
// Exemplo: protipar card de ciclo aberto
function OpenCycleCard({ total = 1234.56, items = [] }) {
  return (
    <div className="glass-surface p-4 rounded-2xl">
      <h3 className="text-sm text-white/60">Ciclo Aberto</h3>
      <p className="text-2xl font-bold">R$ {total.toFixed(2)}</p>
    </div>
  );
}
```

Foco em:
- Hierarquia visual e tipografia
- Responsividade mobile (390px)
- Estados: loading, vazio, erro
- Touch targets (mínimo 44px)

### 4. Iteração

Mostrar o protótipo ao usuário (ou screenshot via browser-qa) e refinar. O protótipo é descartável; o que importa são as **decisões** que ele revela.

Documentar as decisões tomadas com o protótipo:
```
Decisão: [o que foi aprendido]
Impacto na spec: [como isso muda a implementação planejada]
```

### 5. Limpeza

Após o protótipo informar a spec:
1. Deletar arquivos de scratch se não forem reutilizáveis
2. Extrair snippets relevantes para a spec
3. NÃO commitar código de protótipo como production code
