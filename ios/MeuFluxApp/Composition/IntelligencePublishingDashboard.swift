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
        await withTaskGroup(of: Void.self) { group in
            group.addTask { _ = try? await cards.fetchScreen(force: false) }
            group.addTask { _ = try? await accounts.fetchAccounts(force: false) }
        }
        return store.load()
    }
}
