import Foundation
import WidgetKit
import MeuFluxCore
import MeuFluxData
import MeuFluxDomain

/// Persists the current month's joint moment into the App Group whenever it is loaded.
struct WidgetPublishingJointFinance: JointFinanceRepository {
    let inner: any JointFinanceRepository
    let store: JointFinanceWidgetStore
    let clock: any Clock
    let enabled: Bool

    func fetchLink(force: Bool) async throws -> JointLink? {
        let link = try await inner.fetchLink(force: force)
        if enabled, link?.isActive != true {
            store.save(.inactive(now: clock.now()))
            await reload()
        }
        return link
    }

    func fetchMoment(month: YearMonth, force: Bool) async throws -> JointMomentSnapshot {
        let snapshot = try await inner.fetchMoment(month: month, force: force)
        await publishIfCurrentMonth(snapshot)
        return snapshot
    }

    func saveMemberSalary(userId: String, month: YearMonth, amount: Money) async throws {
        try await inner.saveMemberSalary(userId: userId, month: month, amount: amount)
    }

    func createInvite() async throws -> String {
        try await inner.createInvite()
    }

    func acceptInvite(token: String) async throws {
        try await inner.acceptInvite(token: token)
    }

    func unlink() async throws {
        try await inner.unlink()
        guard enabled else { return }
        store.save(.inactive(now: clock.now()))
        await reload()
    }

    func publishIfCurrentMonth(_ snapshot: JointMomentSnapshot) async {
        guard enabled else { return }
        let current = YearMonth(from: clock.now())
        guard snapshot.detail.selectedMonth == current else { return }
        store.save(WidgetSnapshotMapper.jointFinance(snapshot, now: clock.now()))
        await reload()
    }

    private func reload() async {
        await MainActor.run {
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.jointFinance)
        }
    }
}

/// Persists the current month's budget into the App Group whenever it is loaded.
struct WidgetPublishingBudget: BudgetRepository {
    let inner: any BudgetRepository
    let store: BudgetWidgetStore
    let clock: any Clock
    let enabled: Bool

    func fetchLimits(month: YearMonth, force: Bool) async throws -> [BudgetLimit] {
        let limits = try await inner.fetchLimits(month: month, force: force)
        await publishIfCurrentMonth(limits, month: month)
        return limits
    }

    func saveLimit(_ limit: BudgetLimit) async throws {
        try await inner.saveLimit(limit)
    }

    func deleteLimit(id: String, category: String) async throws {
        try await inner.deleteLimit(id: id, category: category)
    }

    func publishIfCurrentMonth(_ limits: [BudgetLimit], month: YearMonth) async {
        guard enabled else { return }
        let current = YearMonth(from: clock.now())
        guard month == current else { return }
        store.save(WidgetSnapshotMapper.budget(limits, month: month, now: clock.now()))
        await MainActor.run {
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.budget)
        }
    }
}
