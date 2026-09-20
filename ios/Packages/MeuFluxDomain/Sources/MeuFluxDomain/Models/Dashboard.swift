import Foundation

/// Full dashboard payload matching the web Dashboard page.
public struct DashboardSnapshot: Sendable, Hashable {
    public var displayName: String
    public var selectedMonth: YearMonth
    public var summary: DashboardSummary
    public var cashflow: DashboardCashflow
    public var monthOverMonth: DashboardMonthOverMonth
    public var netWorthSeries: [DashboardSeriesPoint]
    public var incomeExpenseSeries: [DashboardCashflowPoint]
    public var categoryExpenses: [DashboardCategoryExpense]
    public var insights: [DashboardInsight]
    public var weeklyRecap: DashboardWeeklyRecap
    public var recentTransactions: [DashboardRecentTransaction]
    /// Latest credit-card purchases (new charges only), for the compact home carousel.
    public var recentCreditPurchases: [DashboardRecentTransaction]
    public var dailySpend: [DashboardDailySpendPoint]
    public var budgetCategories: [DashboardBudgetCategory]
    public var calculationVersion: String?

    public init(
        displayName: String,
        selectedMonth: YearMonth,
        summary: DashboardSummary,
        cashflow: DashboardCashflow,
        monthOverMonth: DashboardMonthOverMonth,
        netWorthSeries: [DashboardSeriesPoint],
        incomeExpenseSeries: [DashboardCashflowPoint],
        categoryExpenses: [DashboardCategoryExpense],
        insights: [DashboardInsight],
        weeklyRecap: DashboardWeeklyRecap,
        recentTransactions: [DashboardRecentTransaction],
        recentCreditPurchases: [DashboardRecentTransaction] = [],
        dailySpend: [DashboardDailySpendPoint] = [],
        budgetCategories: [DashboardBudgetCategory],
        calculationVersion: String? = nil
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
    }

    /// Backward-compatible aliases used by older UI stubs.
    public var netWorth: Money { summary.netWorth }
    public var monthIncome: Money { cashflow.income }
    public var monthExpense: Money { cashflow.expense }
    public var openBillsTotal: Money { summary.openBillsTotal }
}

public struct DashboardSummary: Sendable, Hashable {
    public var netWorth: Money
    public var bankBalance: Money
    public var reservedBalance: Money
    public var investmentTotal: Money
    public var creditDebt: Money
    /// Sum of open-cycle bills (`openBillTotal`), never outstanding.
    public var openBillsTotal: Money
    public var loansTotal: Money
    public var totalAssets: Money
    public var bankCount: Int
    public var creditCount: Int

    public init(
        netWorth: Money,
        bankBalance: Money,
        reservedBalance: Money,
        investmentTotal: Money,
        creditDebt: Money,
        openBillsTotal: Money = .zero,
        loansTotal: Money,
        totalAssets: Money,
        bankCount: Int,
        creditCount: Int
    ) {
        self.netWorth = netWorth
        self.bankBalance = bankBalance
        self.reservedBalance = reservedBalance
        self.investmentTotal = investmentTotal
        self.creditDebt = creditDebt
        self.openBillsTotal = openBillsTotal
        self.loansTotal = loansTotal
        self.totalAssets = totalAssets
        self.bankCount = bankCount
        self.creditCount = creditCount
    }
}

public struct DashboardCashflow: Sendable, Hashable {
    public var income: Money
    public var expense: Money
    public var net: Money
    public var savingsRate: Double?

    public init(income: Money, expense: Money, net: Money, savingsRate: Double?) {
        self.income = income
        self.expense = expense
        self.net = net
        self.savingsRate = savingsRate
    }
}

public struct DashboardMonthOverMonth: Sendable, Hashable {
    public var expenseDeltaPct: Double
    public var currentExpense: Money
    public var previousExpense: Money

    public init(expenseDeltaPct: Double, currentExpense: Money, previousExpense: Money) {
        self.expenseDeltaPct = expenseDeltaPct
        self.currentExpense = currentExpense
        self.previousExpense = previousExpense
    }
}

public struct DashboardSeriesPoint: Sendable, Hashable, Identifiable {
    public var id: String { ym }
    public var ym: String
    public var month: String
    public var value: Double

    public init(ym: String, month: String, value: Double) {
        self.ym = ym
        self.month = month
        self.value = value
    }
}

public struct DashboardCashflowPoint: Sendable, Hashable, Identifiable {
    public var id: String { ym }
    public var ym: String
    public var month: String
    public var receita: Double
    public var despesa: Double
    public var net: Double

    public init(ym: String, month: String, receita: Double, despesa: Double, net: Double) {
        self.ym = ym
        self.month = month
        self.receita = receita
        self.despesa = despesa
        self.net = net
    }
}

public struct DashboardCategoryExpense: Sendable, Hashable, Identifiable {
    public var id: String { name }
    public var name: String
    public var value: Double
    public var colorHex: String

    public init(name: String, value: Double, colorHex: String) {
        self.name = name
        self.value = value
        self.colorHex = colorHex
    }
}

public struct DashboardInsight: Sendable, Hashable, Identifiable {
    public var id: String
    public var type: String
    public var text: String
    public var generatedOnDevice: Bool

    public init(id: String, type: String, text: String, generatedOnDevice: Bool = false) {
        self.id = id
        self.type = type
        self.text = text
        self.generatedOnDevice = generatedOnDevice
    }
}

public struct DashboardWeeklyRecap: Sendable, Hashable {
    public var total: Money
    public var deltaPct: Double
    public var topCategoryName: String?
    public var topCategoryValue: Money?

    public init(total: Money, deltaPct: Double, topCategoryName: String?, topCategoryValue: Money?) {
        self.total = total
        self.deltaPct = deltaPct
        self.topCategoryName = topCategoryName
        self.topCategoryValue = topCategoryValue
    }
}

public struct DashboardRecentTransaction: Sendable, Hashable, Identifiable {
    public var id: String
    public var description: String
    public var category: String
    public var categoryId: String?
    public var date: String
    public var dateRelative: String
    public var amount: Money
    public var isCredit: Bool
    public var isPending: Bool
    public var accountId: String?
    public var accountName: String?

    public init(
        id: String,
        description: String,
        category: String,
        categoryId: String? = nil,
        date: String,
        dateRelative: String,
        amount: Money,
        isCredit: Bool,
        isPending: Bool,
        accountId: String? = nil,
        accountName: String? = nil
    ) {
        self.id = id
        self.description = description
        self.category = category
        self.categoryId = categoryId
        self.date = date
        self.dateRelative = dateRelative
        self.amount = amount
        self.isCredit = isCredit
        self.isPending = isPending
        self.accountId = accountId
        self.accountName = accountName
    }
}

public struct DashboardDailySpendPoint: Sendable, Hashable, Identifiable {
    public var id: String { date }
    public var date: String
    public var amount: Decimal
    public var maxPurchase: Decimal
    public var topPurchaseDescription: String?
    public var topPurchaseCategory: String?
    public var topPurchaseAmount: Decimal?
    public var topPurchaseId: String?
    public var topPurchaseAccountName: String?

    public init(
        date: String,
        amount: Decimal,
        maxPurchase: Decimal = 0,
        topPurchaseDescription: String? = nil,
        topPurchaseCategory: String? = nil,
        topPurchaseAmount: Decimal? = nil,
        topPurchaseId: String? = nil,
        topPurchaseAccountName: String? = nil
    ) {
        self.date = date
        self.amount = amount
        self.maxPurchase = maxPurchase
        self.topPurchaseDescription = topPurchaseDescription
        self.topPurchaseCategory = topPurchaseCategory
        self.topPurchaseAmount = topPurchaseAmount
        self.topPurchaseId = topPurchaseId
        self.topPurchaseAccountName = topPurchaseAccountName
    }
}

public struct DashboardBudgetCategory: Sendable, Hashable, Identifiable {
    public var id: String { category }
    public var category: String
    public var spent: Money
    public var limit: Money
    public var percent: Int
    public var colorHex: String

    public init(category: String, spent: Money, limit: Money, percent: Int, colorHex: String) {
        self.category = category
        self.spent = spent
        self.limit = limit
        self.percent = percent
        self.colorHex = colorHex
    }
}

