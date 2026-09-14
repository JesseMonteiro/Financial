import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class BudgetViewModel {
    public private(set) var state: FeatureLoadState<[BudgetLimit]> = .idle
    public private(set) var limits: [BudgetLimit] = []
    public var selectedMonth: YearMonth = YearMonth(from: Date())
    public var errorMessage: String?
    public var draftCategory = ""
    public var draftLimit = ""

    private let repository: (any BudgetRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        repository: (any BudgetRepository)? = nil,
        transactions: (any TransactionsRepository)? = nil
    ) {
        self.repository = repository
        _ = transactions
    }

    public var spentTotal: Money {
        limits.reduce(Money.zero) { $0.adding($1.spent) }
    }

    public var limitTotal: Money {
        limits.reduce(Money.zero) { $0.adding($1.limit) }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "budget:\(selectedMonth.key)"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) { return }
        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        guard let repository else {
        state = .empty
            return
        }
        do {
            limits = try await repository.fetchLimits(month: selectedMonth, force: force)
            state = limits.isEmpty ? .empty : .loaded(limits)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar.")
            }
        }
    }

    public func retry() async { await load(force: true) }

    public func saveDraft() async {
        guard let repository else { return }
        let category = draftCategory.trimmingCharacters(in: .whitespacesAndNewlines)
        let amount = Decimal(string: draftLimit.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard !category.isEmpty, amount > 0 else {
            errorMessage = "Informe categoria e limite."
            return
        }
        let limit = BudgetLimit(
            id: category,
            category: category,
            limit: Money(amount: amount),
            spent: .zero,
            month: selectedMonth
        )
        do {
            try await repository.saveLimit(limit)
            draftCategory = ""
            draftLimit = ""
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ limit: BudgetLimit) async {
        guard let repository else { return }
        do {
            try await repository.deleteLimit(id: limit.id, category: limit.category)
        await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
