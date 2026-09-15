import Foundation
import MeuFluxCore
import MeuFluxDomain
import MeuFluxIntelligence

struct IntelligencePublishingDashboard: LoadDashboardUseCase {
    let inner: any LoadDashboardUseCase
    let store: SiriSnapshotStore
    let narrator: InsightNarrator
    let onIndexed: (@Sendable (SiriFinanceSnapshot) async -> Void)?

    init(
        inner: any LoadDashboardUseCase,
        store: SiriSnapshotStore = SiriSnapshotStore(),
        narrator: InsightNarrator = InsightNarrator(),
        onIndexed: (@Sendable (SiriFinanceSnapshot) async -> Void)? = nil
    ) {
        self.inner = inner
        self.store = store
        self.narrator = narrator
        self.onIndexed = onIndexed
    }

    func execute(month: YearMonth, force: Bool) async throws -> DashboardSnapshot {
        var snapshot = try await inner.execute(month: month, force: force)
        let narrated = await narrator.narrate(snapshot)
        snapshot.insights = narrated.items
        let siri = SiriSnapshotMapper.make(from: snapshot)
        store.save(siri)
        if let onIndexed {
            await onIndexed(siri)
        }
        return snapshot
    }
}
