import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

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

    /// Months from -6 … +5 relative to current (web-inspired strip).
    public let monthOptions: [YearMonth]

    private let buildFinancialMomentDetail: any BuildFinancialMomentDetailUseCase
    private let manageMonthlySalary: any ManageMonthlySalaryUseCase
    private let toggleManualExpensePaid: any ToggleManualExpensePaidUseCase
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        buildFinancialMomentDetail: any BuildFinancialMomentDetailUseCase = StubBuildFinancialMomentDetail(),
        manageMonthlySalary: any ManageMonthlySalaryUseCase = StubManageMonthlySalary(),
        toggleManualExpensePaid: any ToggleManualExpensePaidUseCase = StubToggleManualExpensePaid()
    ) {
        self.buildFinancialMomentDetail = buildFinancialMomentDetail
        self.manageMonthlySalary = manageMonthlySalary
        self.toggleManualExpensePaid = toggleManualExpensePaid
        
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
            let loaded = try await buildFinancialMomentDetail.execute(month: selectedMonth, force: force)
            detail = loaded
            
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
}