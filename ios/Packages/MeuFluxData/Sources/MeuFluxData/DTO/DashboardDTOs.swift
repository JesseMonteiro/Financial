import Foundation

public struct DashboardDTO: Codable, Sendable {
    public let displayName: String
    public let selectedMonth: String
    public let summary: DashboardSummaryDTO
    public let cashflow: DashboardCashflowDTO
    public let monthOverMonth: DashboardMonthOverMonthDTO
    public let netWorthSeries: [DashboardSeriesPointDTO]
    public let incomeExpenseSeries: [DashboardCashflowPointDTO]
    public let categoryExpenses: [DashboardCategoryExpenseDTO]
    public let insights: [DashboardInsightDTO]
    public let weeklyRecap: DashboardWeeklyRecapDTO
    public let recentTransactions: [DashboardRecentTransactionDTO]
    public let budgetCategories: [DashboardBudgetCategoryDTO]
    public let calculationVersion: String?
}

public struct DashboardSummaryDTO: Codable, Sendable {
    public let netWorth: Double
    public let bankBalance: Double
    public let reservedBalance: Double
    public let investmentTotal: Double
    public let creditDebt: Double
    public let openBillsTotal: Double?
    public let loansTotal: Double
    public let totalAssets: Double
    public let bankCount: Int
    public let creditCount: Int
}

public struct DashboardCashflowDTO: Codable, Sendable {
    public let income: Double
    public let expense: Double
    public let net: Double
    public let savingsRate: Double?
}

public struct DashboardMonthOverMonthDTO: Codable, Sendable {
    public let expenseDeltaPct: Double
    public let currentExpense: Double
    public let previousExpense: Double
}

public struct DashboardSeriesPointDTO: Codable, Sendable {
    public let ym: String
    public let month: String
    public let value: Double
}

public struct DashboardCashflowPointDTO: Codable, Sendable {
    public let ym: String
    public let month: String
    public let receita: Double
    public let despesa: Double
    public let net: Double
}

public struct DashboardCategoryExpenseDTO: Codable, Sendable {
    public let name: String
    public let value: Double
    public let color: String?
}

public struct DashboardInsightDTO: Codable, Sendable {
    public let id: String
    public let type: String
    public let text: String
}

public struct DashboardWeeklyRecapDTO: Codable, Sendable {
    public let total: Double
    public let deltaPct: Double
    public let topCategory: DashboardTopCategoryDTO?
}

public struct DashboardTopCategoryDTO: Codable, Sendable {
    public let name: String
    public let value: Double
}

public struct DashboardRecentTransactionDTO: Codable, Sendable {
    public let id: String
    public let description: String
    public let category: String
    public let categoryId: String?
    public let date: String
    public let dateRelative: String
    public let amount: Double
    public let isCredit: Bool
    public let isPending: Bool
}

public struct DashboardBudgetCategoryDTO: Codable, Sendable {
    public let category: String
    public let spent: Double
    public let limit: Double
    public let percent: Int
    public let color: String?
}

