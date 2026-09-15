import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class DashboardViewModel {
    public private(set) var state: FeatureLoadState<DashboardSnapshot> = .idle
    public private(set) var selectedMonth: YearMonth
    public var errorMessage: String?

    private let loadDashboard: any LoadDashboardUseCase
    private let transactions: (any TransactionsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?
    public private(set) var categoryOptions: [LineItemCategoryOption] = []

    public init(
        loadDashboard: any LoadDashboardUseCase,
        transactions: (any TransactionsRepository)? = nil
    ) {
        self.loadDashboard = loadDashboard
        self.transactions = transactions
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
            if categoryOptions.isEmpty { await loadCategories(force: true) }
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
            await loadCategories(force: force)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
            state = .failed(errorMessage ?? "Erro ao carregar visão geral.")
            }
        }
    }

    public func changeCategory(id: String, option: LineItemCategoryOption) async {
        guard let transactions else { return }
        do {
            try await transactions.updateCategory(id: id, categoryId: option.id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    private func loadCategories(force: Bool) async {
        guard let transactions else { return }
        let cats = (try? await transactions.fetchCategories(force: force)) ?? []
        if !cats.isEmpty {
            categoryOptions = LineItemCategoryOption.pluggyOptions(cats)
        }
    }
}
