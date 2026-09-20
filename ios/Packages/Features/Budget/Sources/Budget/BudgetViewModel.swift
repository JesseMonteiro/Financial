import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class BudgetViewModel {
    public private(set) var state: FeatureLoadState<[BudgetLimit]> = .idle
    public private(set) var limits: [BudgetLimit] = []
    public private(set) var purchaseCategories: [PurchaseCategory] = PurchaseCategoryCatalog.defaults
    public var selectedMonth: YearMonth = YearMonth(from: Date())
    public var errorMessage: String?
    public var draftCategory = BudgetCategoryCatalog.labels[0]
    public var draftLimit = ""
    public var draftPeriod: BudgetPeriod = .monthly
    /// When non-nil, the editor is updating an existing meta (category locked).
    public private(set) var editingCategory: String?
    /// Expanded category for showing transactions
    public var expandedCategory: String?

    private let repository: (any BudgetRepository)?
    private let purchaseCategoriesRepository: (any PurchaseCategoriesRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        repository: (any BudgetRepository)? = nil,
        transactions: (any TransactionsRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil
    ) {
        self.repository = repository
        self.purchaseCategoriesRepository = purchaseCategories
        _ = transactions
    }

    public var isEditing: Bool { editingCategory != nil }

    public var categoryPickerLabels: [String] {
        var labels = Set(BudgetCategoryCatalog.labels)
        for category in PurchaseCategoryCatalog.resolved(purchaseCategories) {
            labels.insert(category.label)
        }
        for limit in limits {
            labels.insert(limit.category)
        }
        // Filter out excluded categories
        return labels
            .filter { !BudgetCategoryCatalog.excludedCategories.contains($0) }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    /// Categories available when creating a new meta (exclude ones that already have a limit and excluded categories).
    public var availableCategoriesForCreate: [String] {
        let taken = Set(limits.filter(\.hasLimit).map(\.category))
        return categoryPickerLabels.filter { 
            !taken.contains($0) && !BudgetCategoryCatalog.excludedCategories.contains($0)
        }
    }

    public var spentTotal: Money {
        limits.reduce(Money.zero) { $0.adding($1.spent) }
    }

    public var limitTotal: Money {
        limits.filter(\.hasLimit).reduce(Money.zero) { $0.adding($1.limit) }
    }

    public var monthCapTotal: Money {
        limits.filter(\.hasLimit).reduce(Money.zero) { $0.adding($1.monthCap) }
    }

    public var categoriesWithBudget: Int {
        limits.filter(\.hasLimit).count
    }

    public var overBudgetCount: Int {
        limits.filter { $0.hasLimit && $0.spent.amount > $0.limit.amount }.count
    }

    public var budgetBalance: Money {
        Money(amount: abs(limitTotal.amount - spentTotal.amount))
    }

    public var isOverTotalAllowance: Bool {
        limitTotal.amount > 0 && spentTotal.amount > limitTotal.amount
    }

    public var canGoNext: Bool {
        selectedMonth < YearMonth(from: Date())
    }

    public func goToPreviousMonth() {
        selectedMonth = selectedMonth.previous
    }

    public func goToNextMonth() {
        guard canGoNext else { return }
        selectedMonth = selectedMonth.next
    }

    public func beginCreate() {
        editingCategory = nil
        draftPeriod = .monthly
        draftLimit = ""
        let available = availableCategoriesForCreate
        draftCategory = available.first
            ?? categoryPickerLabels.first
            ?? BudgetCategoryCatalog.labels[0]
    }

    public func beginEdit(_ limit: BudgetLimit) {
        editingCategory = limit.category
        draftCategory = limit.category
        draftPeriod = limit.period
        let amount = limit.periodAmount.amount
        if amount == 0 {
            draftLimit = ""
        } else {
            draftLimit = NSDecimalNumber(decimal: amount).stringValue
        }
    }

    public func beginSetLimit(_ limit: BudgetLimit) {
        editingCategory = limit.hasLimit ? limit.category : nil
        draftCategory = limit.category
        draftPeriod = limit.hasLimit ? limit.period : .monthly
        if limit.hasLimit, limit.periodAmount.amount > 0 {
            draftLimit = NSDecimalNumber(decimal: limit.periodAmount.amount).stringValue
        } else {
            draftLimit = ""
        }
    }

    public func cancelEditor() {
        editingCategory = nil
        draftLimit = ""
        draftPeriod = .monthly
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
            async let limitsTask = repository.fetchLimits(month: selectedMonth, force: force)
            async let categoriesTask = purchaseCategoriesRepository?.fetchCategories(force: force)
            limits = try await limitsTask
            if let loaded = try? await categoriesTask {
                purchaseCategories = PurchaseCategoryCatalog.resolved(loaded)
            }
            if !categoryPickerLabels.contains(draftCategory) {
                draftCategory = categoryPickerLabels.first ?? BudgetCategoryCatalog.labels[0]
            }
            // Keep loaded UI when there are spend rows without metas (parity with web).
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
        let category = (editingCategory ?? draftCategory)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let amount = Decimal(string: draftLimit.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard !category.isEmpty, amount > 0 else {
            errorMessage = "Informe categoria e valor da meta."
            return
        }
        let money = Money(amount: amount)
        let limit = BudgetLimit(
            id: editingCategory ?? category,
            category: category,
            limit: money,
            spent: .zero,
            month: selectedMonth,
            period: draftPeriod,
            periodAmount: money,
            monthCap: money,
            hasLimit: true
        )
        do {
            try await repository.saveLimit(limit)
            cancelEditor()
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ limit: BudgetLimit) async {
        guard limit.hasLimit else { return }
        guard let repository else { return }
        // Prefer UUID id from budget-screen; never DELETE with category label as path.
        let id = limit.id
        guard id != limit.category, !id.isEmpty else {
            errorMessage = "Não foi possível excluir esta meta. Atualize a tela e tente de novo."
            return
        }
        do {
            try await repository.deleteLimit(id: id, category: limit.category)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
