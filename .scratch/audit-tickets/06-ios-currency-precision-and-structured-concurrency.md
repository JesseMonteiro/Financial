# 06: Modernização iOS: Concorrência Estruturada e Precisão Monetária

**What to build:**
Adequação do app nativo iOS aos padrões modernos do Swift 6.2 estabelecidos na skill `write-swift`:
1. Erradicar as 14 chamadas a `Task.detached` em `BFFClient.swift`, `LiveLoadDashboard.swift` e `DashboardViewModel.swift`, substituindo-as por chamadas assíncronas cooperativas e parsing inline.
2. Migrar os pontos de gráficos de `Dashboard.swift` (`receita`, `despesa`, `net`, `value`) de `Double` para `Money` / `Decimal`.
3. Eliminar a conversão `Money(amount: Decimal(amount))` em `DomainMapper.swift`.
4. Mover a dependência `CryptoKit` de `NotificationImport.swift` para `MeuFluxCore`, garantindo zero dependências fora de `Foundation` em `MeuFluxDomain`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Zero ocorrências de `Task.detached` em `ios/Packages/` e `ios/MeuFluxApp/`
- [x] Modelos de gráficos do Dashboard utilizam `Money` / `Decimal`
- [x] `MeuFluxDomain` importa estritamente `Foundation` (CryptoKit isolado em MeuFluxCore)
- [x] Suíte `swift test` 100% verde (159/159 testes passando em 0.31s)
