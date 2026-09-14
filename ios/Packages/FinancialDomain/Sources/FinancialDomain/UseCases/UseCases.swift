import Foundation

public protocol LoadDashboardUseCase: Sendable {
    func execute(month: YearMonth, force: Bool) async throws -> DashboardSnapshot
}

public extension LoadDashboardUseCase {
    func execute(month: YearMonth) async throws -> DashboardSnapshot {
        try await execute(month: month, force: false)
    }
}

public protocol SyncBankItemUseCase: Sendable {
    func execute(itemId: String) async throws
}

public struct FinancialMomentSummary: Sendable, Hashable {
    public var month: YearMonth
    public var income: Money
    public var expense: Money
    public var balance: Money
    public var highlights: [String]

    public init(month: YearMonth, income: Money, expense: Money, balance: Money, highlights: [String]) {
        self.month = month
        self.income = income
        self.expense = expense
        self.balance = balance
        self.highlights = highlights
    }
}

public protocol BuildFinancialMomentUseCase: Sendable {
    func execute(month: YearMonth) async throws -> FinancialMomentSummary
}

public struct OpenBillSummary: Sendable, Hashable {
    public var bill: Bill
    public var transactionCount: Int
    public var categoryBreakdown: [String: Money]

    public init(bill: Bill, transactionCount: Int, categoryBreakdown: [String: Money]) {
        self.bill = bill
        self.transactionCount = transactionCount
        self.categoryBreakdown = categoryBreakdown
    }
}

public protocol SummarizeOpenBillUseCase: Sendable {
    func execute(billId: String) async throws -> OpenBillSummary
}

public protocol ParseBillUseCase: Sendable {
    func execute(base64: String, mimeType: String) async throws -> ParsedBill
}

/// Stub implementations for composition wiring / previews.
public struct StubLoadDashboard: LoadDashboardUseCase {
    public init() {}
    public func execute(month: YearMonth, force: Bool) async throws -> DashboardSnapshot {
        _ = force
        return DashboardSnapshot(
            displayName: "usuário",
            selectedMonth: month,
            summary: DashboardSummary(
                netWorth: .zero,
                bankBalance: .zero,
                reservedBalance: .zero,
                investmentTotal: .zero,
                creditDebt: .zero,
                loansTotal: .zero,
                totalAssets: .zero,
                bankCount: 0,
                creditCount: 0
            ),
            cashflow: DashboardCashflow(income: .zero, expense: .zero, net: .zero, savingsRate: nil),
            monthOverMonth: DashboardMonthOverMonth(
                expenseDeltaPct: 0,
                currentExpense: .zero,
                previousExpense: .zero
            ),
            netWorthSeries: [],
            incomeExpenseSeries: [],
            categoryExpenses: [],
            insights: [],
            weeklyRecap: DashboardWeeklyRecap(
                total: .zero,
                deltaPct: 0,
                topCategoryName: nil,
                topCategoryValue: nil
            ),
            recentTransactions: [],
            budgetCategories: []
        )
    }
}

public struct StubSyncBankItem: SyncBankItemUseCase {
    public init() {}
    public func execute(itemId: String) async throws {}
}

public struct StubBuildFinancialMoment: BuildFinancialMomentUseCase {
    public init() {}
    public func execute(month: YearMonth) async throws -> FinancialMomentSummary {
        FinancialMomentSummary(
            month: month,
            income: .zero,
            expense: .zero,
            balance: .zero,
            highlights: []
        )
    }
}

public struct StubSummarizeOpenBill: SummarizeOpenBillUseCase {
    public init() {}
    public func execute(billId: String) async throws -> OpenBillSummary {
        throw FinancialError.notFound(entity: "Bill", id: billId)
    }
}

public struct StubBuildFinancialMomentDetail: BuildFinancialMomentDetailUseCase {
    public init() {}
    public func execute(month: YearMonth, force: Bool) async throws -> FinancialMomentDetail {
        _ = force
        return FinancialMomentDetail(
            selectedMonth: month,
            salary: .zero,
            receivables: ReceivablesSummary(items: [], total: .zero),
            creditCards: CreditCardsSummary(bills: [], total: .zero),
            automaticDebits: AutomaticDebitsSummary(items: [], total: .zero),
            manualExpenses: ManualExpensesSummary(items: [], total: .zero),
            totals: FinancialTotals(income: .zero, expenses: .zero, accountsPayable: .zero, netBalance: .zero),
            status: MonthStatus(isPositive: true, net: .zero)
        )
    }
}

public struct StubManageMonthlySalary: ManageMonthlySalaryUseCase {
    public init() {}
    public func getCurrentSalary(for month: YearMonth) async throws -> SalarySetting {
        SalarySetting(currentAmount: Money(amount: 5000), isDefault: true)
    }
    public func saveSalary(_ amount: Money, for month: YearMonth) async throws {}
}

public struct StubToggleManualExpensePaid: ToggleManualExpensePaidUseCase {
    public init() {}
    public func execute(expenseId: String, isPaid: Bool) async throws {}
}

public struct StubParseBill: ParseBillUseCase {
    public init() {}
    public func execute(base64: String, mimeType: String) async throws -> ParsedBill {
        _ = (base64, mimeType)
        throw FinancialError.validation("Leitura de fatura indisponível.")
    }
}
