import Foundation
import MeuFluxCore
import MeuFluxData
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
        let siriCards = SiriSnapshotMapper.cards(from: screen)
        let siriPurchases = SiriSnapshotMapper.creditPurchases(from: screen)
        if let snapshot = store.mergeCreditCardsAndPurchases(cards: siriCards, purchases: siriPurchases) {
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
        async let fetchedScreen = try? cards.fetchScreen(force: false)
        async let fetchedAccounts = try? accounts.fetchAccounts(force: false)

        if let screen = await fetchedScreen {
            let siriCards = SiriSnapshotMapper.cards(from: screen)
            let siriPurchases = SiriSnapshotMapper.creditPurchases(from: screen)
            _ = store.mergeCreditCardsAndPurchases(cards: siriCards, purchases: siriPurchases)
        }

        if let accts = await fetchedAccounts {
            let siriAccounts = SiriSnapshotMapper.accounts(from: accts)
            _ = store.mergeAccounts(siriAccounts)
        }

        return store.load()
    }

}

struct LiveRemoteChatbotProvider: RemoteChatbotProviding, Sendable {
    let bff: BFFClient
    let cards: (any CreditCardsRepository)?

    init(bff: BFFClient, cards: (any CreditCardsRepository)? = nil) {
        self.bff = bff
        self.cards = cards
    }

    func reply(
        message: String,
        history: [AssistantChatMessage],
        snapshot: SiriFinanceSnapshot
    ) async throws -> String {
        var activeSnapshot = snapshot

        if activeSnapshot.creditPurchases.isEmpty, let cards {
            if let screen = try? await cards.fetchScreen(force: false) {
                let purchases = SiriSnapshotMapper.creditPurchases(from: screen)
                if !purchases.isEmpty {
                    activeSnapshot.creditPurchases = purchases
                }
                let cardsList = SiriSnapshotMapper.cards(from: screen)
                if !cardsList.isEmpty {
                    activeSnapshot.cards = cardsList
                }
            }
        }

        let historyPayload = history.suffix(10).map { msg in
            ["role": msg.role.rawValue, "text": msg.text]
        }

        let contextDict: [String: Any] = [
            "displayName": activeSnapshot.displayName,
            "monthKey": activeSnapshot.monthKey,
            "bankBalance": activeSnapshot.bankBalanceLabel,
            "netWorth": activeSnapshot.netWorthLabel,
            "openBills": activeSnapshot.openBillsLabel,
            "cards": activeSnapshot.cards.map { [
                "name": $0.name,
                "openTotal": $0.openTotalLabel,
                "outstanding": $0.outstandingLabel,
                "lastFour": $0.lastFour
            ] },
            "creditPurchases": activeSnapshot.creditPurchases.prefix(150).map { [
                "cardName": $0.cardName,
                "description": $0.description,
                "amount": $0.amount,
                "amountLabel": $0.amountLabel,
                "purchaseDate": $0.purchaseDate ?? "",
                "date": $0.purchaseDate ?? "",
                "dueMonth": $0.dueMonth,
                "isInstallment": $0.isInstallment,
                "installmentLabel": $0.installmentLabel ?? "À vista",
                "category": $0.category ?? ""
            ] },
            "accounts": activeSnapshot.accounts.map { [
                "name": $0.name,
                "kind": $0.kind,
                "balance": $0.amountLabel
            ] },
            "categories": activeSnapshot.categories.map { [
                "name": $0.name,
                "amount": $0.amountLabel
            ] },
            "budgets": activeSnapshot.budgets.map { [
                "category": $0.category,
                "spent": $0.spentLabel,
                "limit": $0.limitLabel,
                "percent": $0.percent
            ] },
            "recentTransactions": activeSnapshot.recentTransactions.prefix(30).map { [
                "description": $0.description,
                "category": $0.category,
                "amount": $0.amountLabel,
                "dateRelative": $0.dateRelative,
                "isCredit": $0.isCredit
            ] }
        ]

        return try await bff.postChatbotMessage(
            message: message,
            history: historyPayload,
            context: contextDict
        )
    }
}
