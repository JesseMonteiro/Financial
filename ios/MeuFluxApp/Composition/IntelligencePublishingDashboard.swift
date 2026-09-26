import Foundation
import MeuFluxCore
import MeuFluxDomain
import MeuFluxIntelligence

struct IntelligencePublishingDashboard: LoadDashboardUseCase {
    let inner: any LoadDashboardUseCase
    let store: SiriSnapshotStore
    let narrator: InsightNarrator
    let onIndexed: (@Sendable (SiriFinanceSnapshot) async -> Void)?
    let enrich: (@Sendable () async -> Void)?

    init(
        inner: any LoadDashboardUseCase,
        store: SiriSnapshotStore = SiriSnapshotStore(),
        narrator: InsightNarrator = InsightNarrator(),
        onIndexed: (@Sendable (SiriFinanceSnapshot) async -> Void)? = nil,
        enrich: (@Sendable () async -> Void)? = nil
    ) {
        self.inner = inner
        self.store = store
        self.narrator = narrator
        self.onIndexed = onIndexed
        self.enrich = enrich
    }

    func execute(month: YearMonth, force: Bool) async throws -> DashboardSnapshot {
        var snapshot = try await inner.execute(month: month, force: force)
        snapshot.insights.append(contentsOf: InsightNarrator.budgetPressureInsights(from: snapshot))

        let immediateSnapshot = snapshot
        let siri = SiriSnapshotMapper.make(from: immediateSnapshot).preservingLists(from: store.load())
        store.save(siri)

        let narrator = self.narrator
        let store = self.store
        let onIndexed = self.onIndexed
        let enrich = self.enrich

        Task.detached(priority: .utility) {
            let narrated = await narrator.narrate(immediateSnapshot)
            if narrated.usedOnDeviceModel {
                var updatedSnapshot = immediateSnapshot
                updatedSnapshot.insights = narrated.items
                let updatedSiri = SiriSnapshotMapper.make(from: updatedSnapshot).preservingLists(from: store.load())
                store.save(updatedSiri)
                if let onIndexed {
                    await onIndexed(updatedSiri)
                }
            } else if let onIndexed {
                await onIndexed(siri)
            }
            if let enrich {
                await enrich()
            }
        }
        return snapshot
    }
}

struct IntelligencePublishingCreditCards: CreditCardsRepository, Sendable {
    let inner: any CreditCardsRepository
    let store: SiriSnapshotStore
    let onIndexed: (@Sendable (SiriFinanceSnapshot) async -> Void)?

    func fetchScreen(force: Bool) async throws -> CreditCardsScreen {
        let screen = try await inner.fetchScreen(force: force)
        if let snapshot = store.mergeCards(SiriSnapshotMapper.cards(from: screen)) {
            if let onIndexed {
                Task.detached(priority: .utility) {
                    await onIndexed(snapshot)
                }
            }
        }
        return screen
    }
}

struct IntelligencePublishingAccounts: AccountsRepository, Sendable {
    let inner: any AccountsRepository
    let store: SiriSnapshotStore
    let onIndexed: (@Sendable (SiriFinanceSnapshot) async -> Void)?

    func fetchAccounts(force: Bool) async throws -> [Account] {
        let accounts = try await inner.fetchAccounts(force: force)
        if let snapshot = store.mergeAccounts(SiriSnapshotMapper.accounts(from: accounts)) {
            if let onIndexed {
                Task.detached(priority: .utility) {
                    await onIndexed(snapshot)
                }
            }
        }
        return accounts
    }

    func fetchAccount(id: String) async throws -> Account {
        try await inner.fetchAccount(id: id)
    }

    func renameAccount(id: String, name: String) async throws {
        try await inner.renameAccount(id: id, name: name)
    }

    func fetchManualAccounts(force: Bool) async throws -> [ManualAccount] {
        try await inner.fetchManualAccounts(force: force)
    }

    func saveManualAccount(_ account: ManualAccount) async throws {
        try await inner.saveManualAccount(account)
    }

    func deleteManualAccount(id: String) async throws {
        try await inner.deleteManualAccount(id: id)
    }
}

struct LiveAssistantFinanceProvider: AssistantFinanceProviding, Sendable {
    let store: SiriSnapshotStore
    let cards: any CreditCardsRepository
    let accounts: any AccountsRepository

    func currentSnapshot() async -> SiriFinanceSnapshot? {
        var fetchedScreen: CreditCardsScreen?
        var fetchedAccounts: [Account]?

        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                fetchedScreen = try? await cards.fetchScreen(force: false)
            }
            group.addTask {
                fetchedAccounts = try? await accounts.fetchAccounts(force: false)
            }
        }

        if let screen = fetchedScreen {
            let siriCards = SiriSnapshotMapper.cards(from: screen)
            let siriPurchases = SiriSnapshotMapper.creditPurchases(from: screen)
            _ = store.mergeCreditCardsAndPurchases(cards: siriCards, purchases: siriPurchases)
        }

        if let accts = fetchedAccounts {
            let siriAccounts = SiriSnapshotMapper.accounts(from: accts)
            _ = store.mergeAccounts(siriAccounts)
        }

        return store.load()
    }
}

struct LiveRemoteChatbotProvider: RemoteChatbotProviding, Sendable {
    let bff: BFFClient

    func reply(
        message: String,
        history: [AssistantChatMessage],
        snapshot: SiriFinanceSnapshot
    ) async throws -> String {
        let historyPayload = history.suffix(10).map { msg in
            ["role": msg.role.rawValue, "text": msg.text]
        }

        let contextDict: [String: Any] = [
            "displayName": snapshot.displayName,
            "monthKey": snapshot.monthKey,
            "bankBalance": snapshot.bankBalanceLabel,
            "netWorth": snapshot.netWorthLabel,
            "openBills": snapshot.openBillsLabel,
            "cards": snapshot.cards.map { [
                "name": $0.name,
                "openTotal": $0.openTotalLabel,
                "outstanding": $0.outstandingLabel,
                "lastFour": $0.lastFour
            ] },
            "creditPurchases": snapshot.creditPurchases.prefix(150).map { [
                "cardName": $0.cardName,
                "description": $0.description,
                "amount": $0.amount,
                "amountLabel": $0.amountLabel,
                "purchaseDate": $0.purchaseDate ?? "",
                "dueMonth": $0.dueMonth,
                "isInstallment": $0.isInstallment,
                "installmentLabel": $0.installmentLabel ?? "À vista",
                "category": $0.category ?? ""
            ] },
            "accounts": snapshot.accounts.map { [
                "name": $0.name,
                "kind": $0.kind,
                "balance": $0.amountLabel
            ] },
            "categories": snapshot.categories.map { [
                "name": $0.name,
                "amount": $0.amountLabel
            ] },
            "budgets": snapshot.budgets.map { [
                "category": $0.category,
                "spent": $0.spentLabel,
                "limit": $0.limitLabel,
                "percent": $0.percent
            ] }
        ]

        return try await bff.postChatbotMessage(
            message: message,
            history: historyPayload,
            context: contextDict
        )
    }
}
