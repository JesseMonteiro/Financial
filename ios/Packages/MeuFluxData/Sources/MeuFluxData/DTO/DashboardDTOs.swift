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
    public let recentCreditPurchases: [DashboardRecentTransactionDTO]?
    public let dailySpend: [DashboardDailySpendDTO]?
    public let budgetCategories: [DashboardBudgetCategoryDTO]
    public let calculationVersion: String?
    public let lastSyncedAt: String?

    enum CodingKeys: String, CodingKey {
        case displayName
        case selectedMonth
        case summary
        case cashflow
        case monthOverMonth
        case netWorthSeries
        case incomeExpenseSeries
        case categoryExpenses
        case insights
        case weeklyRecap
        case recentTransactions
        case recentCreditPurchases
        case dailySpend
        case budgetCategories
        case calculationVersion
        case lastSyncedAt
        case lastSyncedAtSnake = "last_synced_at"
    }

    public init(
        displayName: String,
        selectedMonth: String,
        summary: DashboardSummaryDTO,
        cashflow: DashboardCashflowDTO,
        monthOverMonth: DashboardMonthOverMonthDTO,
        netWorthSeries: [DashboardSeriesPointDTO],
        incomeExpenseSeries: [DashboardCashflowPointDTO],
        categoryExpenses: [DashboardCategoryExpenseDTO],
        insights: [DashboardInsightDTO],
        weeklyRecap: DashboardWeeklyRecapDTO,
        recentTransactions: [DashboardRecentTransactionDTO],
        recentCreditPurchases: [DashboardRecentTransactionDTO]? = nil,
        dailySpend: [DashboardDailySpendDTO]? = nil,
        budgetCategories: [DashboardBudgetCategoryDTO],
        calculationVersion: String? = nil,
        lastSyncedAt: String? = nil
    ) {
        self.displayName = displayName
        self.selectedMonth = selectedMonth
        self.summary = summary
        self.cashflow = cashflow
        self.monthOverMonth = monthOverMonth
        self.netWorthSeries = netWorthSeries
        self.incomeExpenseSeries = incomeExpenseSeries
        self.categoryExpenses = categoryExpenses
        self.insights = insights
        self.weeklyRecap = weeklyRecap
        self.recentTransactions = recentTransactions
        self.recentCreditPurchases = recentCreditPurchases
        self.dailySpend = dailySpend
        self.budgetCategories = budgetCategories
        self.calculationVersion = calculationVersion
        self.lastSyncedAt = lastSyncedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        displayName = try container.decode(String.self, forKey: .displayName)
        selectedMonth = try container.decode(String.self, forKey: .selectedMonth)
        summary = try container.decode(DashboardSummaryDTO.self, forKey: .summary)
        cashflow = try container.decode(DashboardCashflowDTO.self, forKey: .cashflow)
        monthOverMonth = try container.decode(DashboardMonthOverMonthDTO.self, forKey: .monthOverMonth)
        netWorthSeries = try container.decode([DashboardSeriesPointDTO].self, forKey: .netWorthSeries)
        incomeExpenseSeries = try container.decode([DashboardCashflowPointDTO].self, forKey: .incomeExpenseSeries)
        categoryExpenses = try container.decode([DashboardCategoryExpenseDTO].self, forKey: .categoryExpenses)
        insights = try container.decode([DashboardInsightDTO].self, forKey: .insights)
        weeklyRecap = try container.decode(DashboardWeeklyRecapDTO.self, forKey: .weeklyRecap)
        recentTransactions = try container.decode([DashboardRecentTransactionDTO].self, forKey: .recentTransactions)
        recentCreditPurchases = try container.decodeIfPresent([DashboardRecentTransactionDTO].self, forKey: .recentCreditPurchases)
        dailySpend = try container.decodeIfPresent([DashboardDailySpendDTO].self, forKey: .dailySpend)
        budgetCategories = try container.decode([DashboardBudgetCategoryDTO].self, forKey: .budgetCategories)
        calculationVersion = try container.decodeIfPresent(String.self, forKey: .calculationVersion)
        lastSyncedAt = try container.decodeIfPresent(String.self, forKey: .lastSyncedAt)
            ?? container.decodeIfPresent(String.self, forKey: .lastSyncedAtSnake)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(displayName, forKey: .displayName)
        try container.encode(selectedMonth, forKey: .selectedMonth)
        try container.encode(summary, forKey: .summary)
        try container.encode(cashflow, forKey: .cashflow)
        try container.encode(monthOverMonth, forKey: .monthOverMonth)
        try container.encode(netWorthSeries, forKey: .netWorthSeries)
        try container.encode(incomeExpenseSeries, forKey: .incomeExpenseSeries)
        try container.encode(categoryExpenses, forKey: .categoryExpenses)
        try container.encode(insights, forKey: .insights)
        try container.encode(weeklyRecap, forKey: .weeklyRecap)
        try container.encode(recentTransactions, forKey: .recentTransactions)
        try container.encodeIfPresent(recentCreditPurchases, forKey: .recentCreditPurchases)
        try container.encodeIfPresent(dailySpend, forKey: .dailySpend)
        try container.encode(budgetCategories, forKey: .budgetCategories)
        try container.encodeIfPresent(calculationVersion, forKey: .calculationVersion)
        try container.encodeIfPresent(lastSyncedAt, forKey: .lastSyncedAt)
    }
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
    public let value: Decimal
}

public struct DashboardCashflowPointDTO: Codable, Sendable {
    public let ym: String
    public let month: String
    public let receita: Decimal
    public let despesa: Decimal
    public let net: Decimal
}

public struct DashboardCategoryExpenseDTO: Codable, Sendable {
    public let name: String
    public let value: Decimal
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
    public let accountId: String?
    public let accountName: String?
}

public struct DashboardDailySpendDTO: Codable, Sendable {
    public let date: String
    public let amount: Double
    public let maxPurchase: Double?
    public let topPurchaseDescription: String?
    public let topPurchaseCategory: String?
    public let topPurchaseAmount: Double?
    public let topPurchaseId: String?
    public let topPurchaseAccountName: String?
}

public struct DashboardBudgetCategoryDTO: Codable, Sendable {
    public let category: String
    public let spent: Double
    public let limit: Double
    public let percent: Int
    public let color: String?
}

