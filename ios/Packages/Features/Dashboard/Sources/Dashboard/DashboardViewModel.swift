import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class DashboardViewModel {
    public private(set) var state: FeatureLoadState<DashboardSnapshot> = .idle
    public private(set) var selectedMonth: YearMonth
    public var errorMessage: String?

    private let loadDashboard: any LoadDashboardUseCase
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(loadDashboard: any LoadDashboardUseCase) {
        self.loadDashboard = loadDashboard
        self.selectedMonth = YearMonth(from: Date())
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
        do {
            let snapshot = try await loadDashboard.execute(month: selectedMonth, force: force)
            let hasAccounts = snapshot.summary.bankCount + snapshot.summary.creditCount > 0
            let hasActivity = !snapshot.recentTransactions.isEmpty
                || snapshot.summary.netWorth.amount != 0
                || !snapshot.insights.isEmpty
            if !hasAccounts && !hasActivity {
                state = .empty
            } else {
                state = .loaded(snapshot)
            }
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
            state = .failed(errorMessage ?? "Erro ao carregar visão geral.")
            }
        }
    }
}
