import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class FinancialMomentDetailViewModel {
    public private(set) var state: FeatureLoadState<FinancialMomentDetail> = .idle
    public private(set) var detail: FinancialMomentDetail?
    public var selectedMonth: YearMonth = YearMonth(from: Date())
    public var errorMessage: String?

    // Salary management
    public var salaryInput: String = ""
    public private(set) var isSavingSalary: Bool = false
    
    // Manual expense management
    public private(set) var pendingExpenses: Set<String> = []
    public private(set) var purchaseCategories: [PurchaseCategory] = PurchaseCategoryCatalog.defaults

    /// Months from -6 … +5 relative to current (web-inspired strip).
    public let monthOptions: [YearMonth]

    private let buildFinancialMomentDetail: any BuildFinancialMomentDetailUseCase
    private let manageMonthlySalary: any ManageMonthlySalaryUseCase
    private let toggleManualExpensePaid: any ToggleManualExpensePaidUseCase
    private let manuals: (any ManualExpensesRepository)?
    private let receivables: (any ReceivablesRepository)?
    private let purchaseCategoriesRepository: (any PurchaseCategoriesRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        buildFinancialMomentDetail: any BuildFinancialMomentDetailUseCase = StubBuildFinancialMomentDetail(),
        manageMonthlySalary: any ManageMonthlySalaryUseCase = StubManageMonthlySalary(),
        toggleManualExpensePaid: any ToggleManualExpensePaidUseCase = StubToggleManualExpensePaid(),
        manuals: (any ManualExpensesRepository)? = nil,
        receivables: (any ReceivablesRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil
    ) {
        self.buildFinancialMomentDetail = buildFinancialMomentDetail
        self.manageMonthlySalary = manageMonthlySalary
        self.toggleManualExpensePaid = toggleManualExpensePaid
        self.manuals = manuals
        self.receivables = receivables
        self.purchaseCategoriesRepository = purchaseCategories
        
        let current = YearMonth(from: Date())
        self.monthOptions = (-6...5).map { current.adding(months: $0) }
        self.selectedMonth = current
    }

    public var selectedMonthIndex: Int {
        monthOptions.firstIndex(of: selectedMonth) ?? 6
    }

    public func selectMonth(at index: Int) {
        guard monthOptions.indices.contains(index) else { return }
        selectedMonth = monthOptions[index]
    }

    public func selectCurrentMonth() {
        selectedMonth = YearMonth(from: Date())
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
            async let detailTask = buildFinancialMomentDetail.execute(month: selectedMonth, force: force)
            async let categoriesTask = purchaseCategoriesRepository?.fetchCategories(force: force)
            let loaded = try await detailTask
            detail = loaded
            if let cats = try? await categoriesTask {
                purchaseCategories = PurchaseCategoryCatalog.resolved(cats)
            }
            
            let salarySetting = try await manageMonthlySalary.getCurrentSalary(for: selectedMonth)
            salaryInput = salarySetting.currentAmount.amount.formatted()
            
            let isEmpty = loaded.totals.income.isZero && 
                         loaded.totals.expenses.isZero && 
                         loaded.receivables.isEmpty && 
                         loaded.creditCards.isEmpty && 
                         loaded.automaticDebits.isEmpty && 
                         loaded.manualExpenses.isEmpty
            _ = isEmpty
            state = .loaded(loaded)
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

    public func saveSalary() async {
        guard !isSavingSalary else { return }
        
        let amount = Decimal(string: salaryInput.replacingOccurrences(of: ",", with: ".")) ?? .zero
        let money = Money(amount: amount)
        
        isSavingSalary = true
        
        do {
            try await manageMonthlySalary.saveSalary(money, for: selectedMonth)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            // Could show a toast or alert here
        }
        
        isSavingSalary = false
    }

    public func toggleManualExpensePaid(_ expenseId: String, isPaid: Bool) async {
        guard !pendingExpenses.contains(expenseId) else { return }
        
        pendingExpenses.insert(expenseId)
        
        do {
            try await toggleManualExpensePaid.execute(expenseId: expenseId, isPaid: isPaid)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            // Could show a toast or alert here
        }
        
        pendingExpenses.remove(expenseId)
    }

    public func deleteManual(id: String) async {
        guard let manuals else { return }
        pendingExpenses.insert(id)
        defer { pendingExpenses.remove(id) }
        do {
            try await manuals.deleteExpense(id: id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func updateManualCategory(id: String, category: String) async {
        guard let manuals else { return }
        pendingExpenses.insert(id)
        defer { pendingExpenses.remove(id) }
        do {
            guard var expense = try await manuals.fetchExpenses(month: nil, force: true).first(where: { $0.id == id }) else { return }
            expense.category = category
            try await manuals.updateExpense(expense)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func markReceivablePaid(id: String, installmentNumber: Int?) async {
        guard let receivables else { return }
        pendingExpenses.insert(id)
        defer { pendingExpenses.remove(id) }
        do {
            guard var item = try await receivables.fetchReceivables(force: true).first(where: { $0.id == id }) else { return }
            let number = installmentNumber ?? item.installmentHistory.first { !$0.isPaid }?.installmentNumber
            if let number, let index = item.installmentHistory.firstIndex(where: { $0.installmentNumber == number }) {
                item.installmentHistory[index].paidAt = InstantDate(from: Date())
                item.paidInstallments = item.installmentHistory.filter(\.isPaid).count
                if !item.isContinuous {
                    item.isReceived = item.paidInstallments >= item.installments
                }
            }
            try await receivables.saveReceivable(item)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func deleteReceivable(id: String) async {
        guard let receivables else { return }
        pendingExpenses.insert(id)
        defer { pendingExpenses.remove(id) }
        do {
            try await receivables.deleteReceivable(id: id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}