---
name: write-swift
description: "Boas práticas para escrever código Swift 6.2 moderno no app iOS MeuFlux. Use ao criar ou modificar qualquer arquivo .swift no projeto. Cobre SwiftUI, Observation, structured concurrency, Apple Intelligence, e Swift Testing."
---

# Write Swift — Código Swift 6.2 Moderno para MeuFlux

O app iOS do MeuFlux usa Swift 6.2 com SwiftUI, structured concurrency, e arquitetura limpa modular. Esta skill garante que novo código Swift siga as práticas modernas.

## Estrutura Modular do MeuFlux iOS

```
ios/
  Package.swift                    ← SPM root
  MeuFluxApp/                      ← app target
  Packages/
    MeuFluxCore/                   ← utilities, networking, extensions
    MeuFluxDomain/                 ← modelos, protocols, use cases (PURO)
    MeuFluxData/                   ← repositories, services (implementações)
    MeuFluxDesignSystem/           ← componentes UI, tokens, temas
    MeuFluxIntelligence/           ← Apple Intelligence + Gemini fallback
    Features/
      Dashboard/, Transactions/, CreditCards/, ...  ← feature packages
```

**Regra fundamental:** `MeuFluxDomain` não pode importar nada além de Foundation. É puro Swift — sem SwiftUI, sem URLSession, sem Supabase.

## Swift 6.2 — Boas Práticas

### Tipos de dados

```swift
// ✅ Prefira structs e enums sobre classes
struct Transaction: Codable, Identifiable {
    let id: UUID
    let amount: Decimal  // ← Decimal para dinheiro, NUNCA Double
    let description: String
    let category: TransactionCategory
}

// ✅ Enums com associated values para estados
enum SyncState {
    case idle
    case syncing(progress: Double)
    case failed(Error)
    case done([Transaction])
}
```

### Concorrência Estruturada

```swift
// ✅ async/await limpo
func fetchTransactions(for accountId: String) async throws -> [Transaction] {
    let data = try await repository.getTransactions(accountId: accountId)
    return data.map(Transaction.init)
}

// ✅ TaskGroup para paralelismo
func syncAllAccounts(_ accounts: [Account]) async throws {
    try await withThrowingTaskGroup(of: Void.self) { group in
        for account in accounts {
            group.addTask { try await self.syncAccount(account) }
        }
        try await group.waitForAll()
    }
}

// ❌ Evitar
DispatchQueue.global().async { ... }   // use @concurrent func
Task.detached { ... }                   // use Task { } dentro de contexto
```

### Observation Framework

```swift
// ✅ @Observable (Swift 5.9+) em vez de ObservableObject
@Observable
final class DashboardViewModel {
    var transactions: [Transaction] = []
    var isLoading = false
    
    func load() async { ... }
}

// ❌ Evitar
class DashboardViewModel: ObservableObject {
    @Published var transactions: [Transaction] = []
}
```

### Apple Intelligence — MeuFluxIntelligence

```swift
// ✅ Verificar disponibilidade antes de usar Foundation Models
import FoundationModels

func analyzeSpending(_ context: AssistantFinanceContext) async -> String {
    guard LanguageModel.isAvailable else {
        // Fallback para Gemini API
        return await geminiClient.analyzeSpending(context)
    }
    
    let session = LanguageModelSession()
    let response = try await session.respond(to: buildPrompt(context))
    return response.content
}

// ✅ @Generable para structured output
@Generable
struct SpendingInsight {
    let summary: String
    let topCategory: String
    let recommendation: String
}
```

### Swift Testing

```swift
// ✅ Use Swift Testing, não XCTestCase
import Testing

@Suite("Fatura Calculations")
struct FaturaTests {
    
    @Test("Ciclo aberto Nubank calcula com closingDate D-7")
    func nubankOpenCycle() {
        let transactions = [
            Transaction.fixture(date: .daysAgo(3), amount: -150)
        ]
        let result = FaturaCalculator.openCycle(
            transactions: transactions,
            connector: .nubank,
            today: .fixture("2026-09-28")
        )
        #expect(result.total == 150)
    }
    
    @Test("Múltiplos inputs", arguments: [
        (closingDay: 7, expected: 150.0),
        (closingDay: 10, expected: 300.0),
    ])
    func openCycleVariants(closingDay: Int, expected: Decimal) {
        // ...
        #expect(result.total == expected)
    }
    
    @Test("Bug conhecido — parcela duplicada")
    @available(iOS 17, *)
    func knownDuplicateInstallment() throws {
        // #require para falhar early em pré-condição
        let transaction = try #require(buildInstallmentTransaction())
        #expect(transaction.installment == 2)
    }
}
```

### Referência Rápida — O que usar

| Necessidade | Use | Não use |
|-------------|-----|--------|
| Tipo de dados | `struct` / `enum` | `class` sem motivo |
| Estado compartilhado | `actor`, `@MainActor class` | `class` + lock |
| Paralelismo fixo | `async let` | N Tasks não-estruturadas |
| Paralelismo dinâmico | `withTaskGroup` | loop de Tasks |
| Observação de estado | `@Observable` | `ObservableObject` + `@Published` |
| Modelo de linguagem | `LanguageModelSession` + `@Generable` | Strings cruas |
| Dinheiro | `Decimal` | `Double`, `Float` |
| Testes | `@Test` + `#expect` | `XCTestCase` + `XCTAssertEqual` |
| Logs de produção | `Logger` | `print` |

## Regras do MeuFlux iOS

1. **MeuFluxDomain é puro.** Zero imports de frameworks fora de Foundation.
2. **Decimal para dinheiro.** Nunca Double em valores financeiros.
3. **swift test deve passar** antes de marcar qualquer mudança como done.
4. **Apple Intelligence com fallback.** Sempre verificar `LanguageModel.isAvailable` e ter caminho Gemini.
5. **Modular.** Novas features como packages em `ios/Packages/Features/`.
