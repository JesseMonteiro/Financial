import Foundation

public struct ReportCategory: Sendable, Hashable, Identifiable {
    public var id: String { name }
    public var name: String
    public var amount: Money

    public init(name: String, amount: Money) {
        self.name = name
        self.amount = amount
    }
}

public struct ReportAccountRef: Sendable, Hashable, Identifiable {
    public var id: String
    public var name: String
    public var type: String

    public init(id: String, name: String, type: String = "BANK") {
        self.id = id
        self.name = name
        self.type = type
    }
}

public struct ReportsSnapshot: Sendable, Hashable {
    public var months: Int
    public var selectedMonth: YearMonth
    public var income: Money
    public var expense: Money
    public var categories: [ReportCategory]
    public var accounts: [ReportAccountRef]
    public var calculationVersion: String?

    public init(
        months: Int,
        selectedMonth: YearMonth,
        income: Money,
        expense: Money,
        categories: [ReportCategory],
        accounts: [ReportAccountRef],
        calculationVersion: String? = nil
    ) {
        self.months = months
        self.selectedMonth = selectedMonth
        self.income = income
        self.expense = expense
        self.categories = categories
        self.accounts = accounts
        self.calculationVersion = calculationVersion
    }
}
