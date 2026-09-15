import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class FinancialMomentViewModel {
    public private(set) var state: FeatureLoadState<FinancialMomentSummary> = .idle
    public private(set) var summary: FinancialMomentSummary?
    public var selectedMonth: YearMonth = YearMonth(from: Date())
    public var errorMessage: String?

    /// Months from -5 … +2 relative to current (web-inspired strip).
    public let monthOptions: [YearMonth]

    private let buildFinancialMoment: any BuildFinancialMomentUseCase
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(buildFinancialMoment: any BuildFinancialMomentUseCase = StubBuildFinancialMoment()) {
        self.buildFinancialMoment = buildFinancialMoment
        let current = YearMonth(from: Date())
        self.monthOptions = (-5...2).map { current.adding(months: $0) }
        self.selectedMonth = current
    }

    public var selectedMonthIndex: Int {
        monthOptions.firstIndex(of: selectedMonth) ?? 5
    }

    public func selectMonth(at index: Int) {
        guard monthOptions.indices.contains(index) else { return }
        selectedMonth = monthOptions[index]
    }

    public func load(force: Bool = false) async {
        let cacheKey = selectedMonth.key
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) {
            return
        }

        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        do {
            let loaded = try await buildFinancialMoment.execute(month: selectedMonth)
            summary = loaded
            let empty = loaded.income.isZero && loaded.expense.isZero && loaded.highlights.isEmpty
            state = empty ? .empty : .loaded(loaded)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
            state = .failed(errorMessage ?? "Não foi possível carregar.")
            }
        }
    }

    public func retry() async {
        await load(force: true)
    }
}
