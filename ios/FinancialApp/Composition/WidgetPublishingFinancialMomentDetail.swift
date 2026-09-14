import Foundation
import WidgetKit
import FinancialCore
import FinancialData
import FinancialDomain

/// Persists the current month's financial moment into the App Group whenever it is loaded.
struct WidgetPublishingFinancialMomentDetail: BuildFinancialMomentDetailUseCase {
    let inner: any BuildFinancialMomentDetailUseCase
    let store: FinancialMomentWidgetStore
    let clock: any Clock
    let enabled: Bool

    func execute(month: YearMonth, force: Bool) async throws -> FinancialMomentDetail {
        let detail = try await inner.execute(month: month, force: force)
        await publishIfCurrentMonth(detail)
        return detail
    }

    func publishIfCurrentMonth(_ detail: FinancialMomentDetail) async {
        guard enabled else { return }
        let current = YearMonth(from: clock.now())
        guard detail.selectedMonth == current else { return }
        store.save(WidgetSnapshotMapper.financialMoment(detail, now: clock.now()))
        await MainActor.run {
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.financialMoment)
        }
    }
}

