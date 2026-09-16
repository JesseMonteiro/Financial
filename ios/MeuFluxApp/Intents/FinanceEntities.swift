import AppIntents
import CoreSpotlight
import Foundation
import MeuFluxCore

struct TransactionEntity: AppEntity, IndexedEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Transação")
    static let defaultQuery = TransactionEntityQuery()

    var id: String
    @Property(title: "Descrição")
    var name: String
    @Property(title: "Categoria")
    var category: String
    @Property(title: "Valor")
    var amountLabel: String
    @Property(title: "Quando")
    var dateRelative: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(category) · \(amountLabel)"
        )
    }

    init(id: String, name: String, category: String, amountLabel: String, dateRelative: String) {
        self.id = id
        self.name = name
        self.category = category
        self.amountLabel = amountLabel
        self.dateRelative = dateRelative
    }

    static func from(_ tx: SiriFinanceSnapshot.SiriTransaction) -> TransactionEntity {
        TransactionEntity(
            id: tx.id,
            name: tx.description,
            category: tx.category,
            amountLabel: tx.amountLabel,
            dateRelative: tx.dateRelative
        )
    }
}

struct BudgetCategoryEntity: AppEntity, IndexedEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Categoria de orçamento")
    static let defaultQuery = BudgetCategoryEntityQuery()

    var id: String
    @Property(title: "Categoria")
    var name: String
    @Property(title: "Gasto")
    var spentLabel: String
    @Property(title: "Limite")
    var limitLabel: String
    @Property(title: "Percentual")
    var percent: Int

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)",
            subtitle: "\(spentLabel) de \(limitLabel)"
        )
    }

    init(id: String, name: String, spentLabel: String, limitLabel: String, percent: Int) {
        self.id = id
        self.name = name
        self.spentLabel = spentLabel
        self.limitLabel = limitLabel
        self.percent = percent
    }
}

struct AccountSummaryEntity: AppEntity, IndexedEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Conta")
    static let defaultQuery = AccountSummaryEntityQuery()

    var id: String
    @Property(title: "Nome")
    var name: String
    @Property(title: "Valor")
    var amountLabel: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "\(amountLabel)")
    }

    init(id: String, name: String, amountLabel: String) {
        self.id = id
        self.name = name
        self.amountLabel = amountLabel
    }
}

struct BillSummaryEntity: AppEntity, IndexedEntity {
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Cartão")
    static let defaultQuery = BillSummaryEntityQuery()

    var id: String
    @Property(title: "Nome")
    var name: String
    @Property(title: "Valor")
    var amountLabel: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)", subtitle: "\(amountLabel)")
    }

    init(id: String, name: String, amountLabel: String) {
        self.id = id
        self.name = name
        self.amountLabel = amountLabel
    }
}

struct TransactionEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [TransactionEntity] {
        SpotlightFinanceIndexer.transactions().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [TransactionEntity] {
        SpotlightFinanceIndexer.transactions()
    }
}

struct BudgetCategoryEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [BudgetCategoryEntity] {
        SpotlightFinanceIndexer.budgets().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [BudgetCategoryEntity] {
        SpotlightFinanceIndexer.budgets()
    }
}

struct AccountSummaryEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [AccountSummaryEntity] {
        SpotlightFinanceIndexer.accounts().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [AccountSummaryEntity] {
        SpotlightFinanceIndexer.accounts()
    }
}

struct BillSummaryEntityQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [BillSummaryEntity] {
        SpotlightFinanceIndexer.bills().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [BillSummaryEntity] {
        SpotlightFinanceIndexer.bills()
    }
}

struct OpenTransactionIntent: OpenIntent {
    static var title: LocalizedStringResource { "Abrir transação" }
    static var openAppWhenRun: Bool { true }

    @Parameter(title: "Transação")
    var target: TransactionEntity

    @MainActor
    func perform() async throws -> some IntentResult {
        IntentRuntime.shared.open(.transactions)
        return .result()
    }
}

struct OpenBudgetCategoryIntent: OpenIntent {
    static var title: LocalizedStringResource { "Abrir orçamento" }
    static var openAppWhenRun: Bool { true }

    @Parameter(title: "Categoria")
    var target: BudgetCategoryEntity

    @MainActor
    func perform() async throws -> some IntentResult {
        IntentRuntime.shared.open(.budget)
        return .result()
    }
}

struct OpenAccountSummaryIntent: OpenIntent {
    static var title: LocalizedStringResource { "Abrir contas" }
    static var openAppWhenRun: Bool { true }

    @Parameter(title: "Conta")
    var target: AccountSummaryEntity

    @MainActor
    func perform() async throws -> some IntentResult {
        IntentRuntime.shared.open(.accounts)
        return .result()
    }
}

struct OpenBillSummaryIntent: OpenIntent {
    static var title: LocalizedStringResource { "Abrir faturas" }
    static var openAppWhenRun: Bool { true }

    @Parameter(title: "Cartão")
    var target: BillSummaryEntity

    @MainActor
    func perform() async throws -> some IntentResult {
        IntentRuntime.shared.open(.creditCards)
        return .result()
    }
}

enum SpotlightFinanceIndexer {
    static func index(_ snapshot: SiriFinanceSnapshot) async {
        let transactions = snapshot.recentTransactions.map(TransactionEntity.from)
        let budgets = snapshot.budgets.map {
            BudgetCategoryEntity(
                id: $0.category,
                name: $0.category,
                spentLabel: $0.spentLabel,
                limitLabel: $0.limitLabel,
                percent: $0.percent
            )
        }
        let accounts: [AccountSummaryEntity] = {
            if !snapshot.accounts.isEmpty {
                return snapshot.accounts.map {
                    AccountSummaryEntity(id: $0.id, name: $0.name, amountLabel: $0.amountLabel)
                }
            }
            return [
                AccountSummaryEntity(id: "bank-balance", name: "Saldo em contas", amountLabel: snapshot.bankBalanceLabel),
                AccountSummaryEntity(id: "net-worth", name: "Patrimônio líquido", amountLabel: snapshot.netWorthLabel),
            ]
        }()
        let bills: [BillSummaryEntity] = {
            if !snapshot.cards.isEmpty {
                return snapshot.cards.map {
                    BillSummaryEntity(id: $0.id, name: $0.name, amountLabel: $0.openTotalLabel)
                }
            }
            return [
                BillSummaryEntity(id: "open-bills", name: "Faturas abertas", amountLabel: snapshot.openBillsLabel)
            ]
        }()
        do {
            try await CSSearchableIndex.default().indexAppEntities(transactions)
            try await CSSearchableIndex.default().indexAppEntities(budgets)
            try await CSSearchableIndex.default().indexAppEntities(accounts)
            try await CSSearchableIndex.default().indexAppEntities(bills)
        } catch {
            // Spotlight is best-effort; Siri query intents still work from the snapshot store.
        }
    }

    static func clear() async {
        try? await CSSearchableIndex.default().deleteAppEntities(ofType: TransactionEntity.self)
        try? await CSSearchableIndex.default().deleteAppEntities(ofType: BudgetCategoryEntity.self)
        try? await CSSearchableIndex.default().deleteAppEntities(ofType: AccountSummaryEntity.self)
        try? await CSSearchableIndex.default().deleteAppEntities(ofType: BillSummaryEntity.self)
    }

    static func transactions() -> [TransactionEntity] {
        (SiriSnapshotStore().load()?.recentTransactions ?? []).map(TransactionEntity.from)
    }

    static func budgets() -> [BudgetCategoryEntity] {
        (SiriSnapshotStore().load()?.budgets ?? []).map {
            BudgetCategoryEntity(
                id: $0.category,
                name: $0.category,
                spentLabel: $0.spentLabel,
                limitLabel: $0.limitLabel,
                percent: $0.percent
            )
        }
    }

    static func accounts() -> [AccountSummaryEntity] {
        guard let snapshot = SiriSnapshotStore().load() else { return [] }
        if !snapshot.accounts.isEmpty {
            return snapshot.accounts.map {
                AccountSummaryEntity(id: $0.id, name: $0.name, amountLabel: $0.amountLabel)
            }
        }
        return [
            AccountSummaryEntity(id: "bank-balance", name: "Saldo em contas", amountLabel: snapshot.bankBalanceLabel),
            AccountSummaryEntity(id: "net-worth", name: "Patrimônio líquido", amountLabel: snapshot.netWorthLabel),
        ]
    }

    static func bills() -> [BillSummaryEntity] {
        guard let snapshot = SiriSnapshotStore().load() else { return [] }
        if !snapshot.cards.isEmpty {
            return snapshot.cards.map {
                BillSummaryEntity(id: $0.id, name: $0.name, amountLabel: $0.openTotalLabel)
            }
        }
        return [
            BillSummaryEntity(id: "open-bills", name: "Faturas abertas", amountLabel: snapshot.openBillsLabel)
        ]
    }
}
