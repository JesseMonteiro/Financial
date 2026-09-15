import Foundation

/// Detailed financial moment data for a specific month, mirroring web logic.
public struct FinancialMomentDetail: Sendable, Hashable {
    public var selectedMonth: YearMonth
    public var salary: Money
    public var receivables: ReceivablesSummary
    public var creditCards: CreditCardsSummary
    public var automaticDebits: AutomaticDebitsSummary
    public var manualExpenses: ManualExpensesSummary
    public var totals: FinancialTotals
    public var status: MonthStatus
    /// Net status per month key (`YYYY-MM`) for the timeline chips.
    public var monthsStatus: [String: MonthStatus]
    public var mealBenefits: MealBenefitsSummary

    public init(
        selectedMonth: YearMonth,
        salary: Money,
        receivables: ReceivablesSummary,
        creditCards: CreditCardsSummary,
        automaticDebits: AutomaticDebitsSummary,
        manualExpenses: ManualExpensesSummary,
        totals: FinancialTotals,
        status: MonthStatus,
        monthsStatus: [String: MonthStatus] = [:],
        mealBenefits: MealBenefitsSummary = .empty
    ) {
        self.selectedMonth = selectedMonth
        self.salary = salary
        self.receivables = receivables
        self.creditCards = creditCards
        self.automaticDebits = automaticDebits
        self.manualExpenses = manualExpenses
        self.totals = totals
        self.status = status
        self.monthsStatus = monthsStatus
        self.mealBenefits = mealBenefits
    }
}

/// Summary of receivables (reimbursements) for the month.
public struct ReceivablesSummary: Sendable, Hashable {
    public var items: [ReceivableItem]
    public var total: Money

    public init(items: [ReceivableItem], total: Money) {
        self.items = items
        self.total = total
    }

    public var isEmpty: Bool { items.isEmpty }
}

/// Individual receivable item (installment).
public struct ReceivableItem: Sendable, Hashable, Identifiable {
    public var id: String { "\(personName)-\(installmentNumber)" }
    public var personName: String
    public var personColor: String
    public var description: String
    public var amount: Money
    public var installmentNumber: Int
    public var totalInstallments: Int
    public var isPaid: Bool
    public var ownerLabel: String?
    public var receivableId: String?

    public init(
        personName: String,
        personColor: String,
        description: String,
        amount: Money,
        installmentNumber: Int,
        totalInstallments: Int,
        isPaid: Bool,
        ownerLabel: String? = nil,
        receivableId: String? = nil
    ) {
        self.personName = personName
        self.personColor = personColor
        self.description = description
        self.amount = amount
        self.installmentNumber = installmentNumber
        self.totalInstallments = totalInstallments
        self.isPaid = isPaid
        self.ownerLabel = ownerLabel
        self.receivableId = receivableId
    }
}

/// Summary of credit card bills for the month.
public struct CreditCardsSummary: Sendable, Hashable {
    public var bills: [CreditCardBillItem]
    public var total: Money

    public init(bills: [CreditCardBillItem], total: Money) {
        self.bills = bills
        self.total = total
    }

    public var isEmpty: Bool { bills.isEmpty }
    public var unpaidBills: [CreditCardBillItem] { bills.filter { !$0.isPaid } }
    public var unpaidTotal: Money {
        Money(amount: unpaidBills.reduce(0) { $0 + $1.amount.amount })
    }
}

/// Individual credit card bill for the month.
public struct CreditCardBillItem: Sendable, Hashable, Identifiable {
    public var id: String { cardId }
    public var cardId: String
    public var cardName: String
    public var amount: Money
    public var dueDate: String
    public var isPaid: Bool
    public var isFallback: Bool
    public var ownerLabel: String?
    public var lastFour: String
    public var institutionName: String
    public var marketingName: String
    public var connectorName: String
    public var iconKey: String?
    public var cardFaceURL: URL?

    public init(
        cardId: String,
        cardName: String,
        amount: Money,
        dueDate: String,
        isPaid: Bool,
        isFallback: Bool,
        ownerLabel: String? = nil,
        lastFour: String = "****",
        institutionName: String = "",
        marketingName: String = "",
        connectorName: String = "",
        iconKey: String? = nil,
        cardFaceURL: URL? = nil
    ) {
        self.cardId = cardId
        self.cardName = cardName
        self.amount = amount
        self.dueDate = dueDate
        self.isPaid = isPaid
        self.isFallback = isFallback
        self.ownerLabel = ownerLabel
        self.lastFour = lastFour
        self.institutionName = institutionName
        self.marketingName = marketingName
        self.connectorName = connectorName
        self.iconKey = iconKey
        self.cardFaceURL = cardFaceURL
    }
}

/// Summary of automatic debits for the month.
public struct AutomaticDebitsSummary: Sendable, Hashable {
    public var items: [AutomaticDebitItem]
    public var total: Money

    public init(items: [AutomaticDebitItem], total: Money) {
        self.items = items
        self.total = total
    }

    public var isEmpty: Bool { items.isEmpty }
    public var unpaidItems: [AutomaticDebitItem] { items.filter { $0.isPending } }
    public var unpaidTotal: Money {
        Money(amount: unpaidItems.reduce(0) { $0 + $1.amount.amount })
    }
}

/// Individual automatic debit item.
public struct AutomaticDebitItem: Sendable, Hashable, Identifiable {
    public var id: String
    public var description: String
    public var amount: Money
    public var date: String
    public var accountId: String
    public var accountName: String
    public var isPending: Bool

    public init(
        id: String,
        description: String,
        amount: Money,
        date: String,
        accountId: String,
        accountName: String,
        isPending: Bool
    ) {
        self.id = id
        self.description = description
        self.amount = amount
        self.date = date
        self.accountId = accountId
        self.accountName = accountName
        self.isPending = isPending
    }
}

/// Summary of manual expenses for the month.
public struct ManualExpensesSummary: Sendable, Hashable {
    public var items: [ManualExpenseItem]
    public var total: Money

    public init(items: [ManualExpenseItem], total: Money) {
        self.items = items
        self.total = total
    }

    public var isEmpty: Bool { items.isEmpty }
    public var unpaidItems: [ManualExpenseItem] { items.filter { !$0.isPaid } }
    public var unpaidTotal: Money {
        Money(amount: unpaidItems.reduce(0) { $0 + $1.amount.amount })
    }
}

/// Individual manual expense item.
public struct ManualExpenseItem: Sendable, Hashable, Identifiable {
    public var id: String
    public var description: String
    public var amount: Money
    public var date: String
    public var category: String
    public var isPaid: Bool
    public var ownerLabel: String?

    public init(
        id: String,
        description: String,
        amount: Money,
        date: String,
        category: String,
        isPaid: Bool,
        ownerLabel: String? = nil
    ) {
        self.id = id
        self.description = description
        self.amount = amount
        self.date = date
        self.category = category
        self.isPaid = isPaid
        self.ownerLabel = ownerLabel
    }
}

/// MeuFlux totals for the month calculation.
public struct FinancialTotals: Sendable, Hashable {
    public var income: Money           // salary + receivables
    public var expenses: Money         // credit cards + debits + manual
    public var accountsPayable: Money  // unpaid bills + unpaid debits + unpaid manual
    public var netBalance: Money       // income - expenses

    public init(income: Money, expenses: Money, accountsPayable: Money, netBalance: Money) {
        self.income = income
        self.expenses = expenses
        self.accountsPayable = accountsPayable
        self.netBalance = netBalance
    }

    public var utilizationPercent: Int {
        guard !income.isZero else { return 0 }
        let ratio = expenses.amount / income.amount
        let percentage = NSDecimalNumber(decimal: ratio * 100).doubleValue
        guard percentage.isFinite else { return 0 }
        return min(100, max(0, Int(percentage.rounded())))
    }

    public var isOverBudget: Bool { expenses.amount > income.amount }
}

/// Month status for timeline chip display.
public struct MonthStatus: Sendable, Hashable {
    public var isPositive: Bool
    public var net: Money

    public init(isPositive: Bool, net: Money) {
        self.isPositive = isPositive
        self.net = net
    }
}

/// Salary management for the monthly input.
public struct SalarySetting: Sendable, Hashable {
    public var currentAmount: Money
    public var isDefault: Bool

    public init(currentAmount: Money, isDefault: Bool) {
        self.currentAmount = currentAmount
        self.isDefault = isDefault
    }
}

/// Protocol for detailed financial moment use case.
public protocol BuildFinancialMomentDetailUseCase: Sendable {
    func execute(month: YearMonth, force: Bool) async throws -> FinancialMomentDetail
}

public extension BuildFinancialMomentDetailUseCase {
    func execute(month: YearMonth) async throws -> FinancialMomentDetail {
        try await execute(month: month, force: false)
    }
}

/// Protocol for salary management.
public protocol ManageMonthlySalaryUseCase: Sendable {
    func getCurrentSalary(for month: YearMonth) async throws -> SalarySetting
    func saveSalary(_ amount: Money, for month: YearMonth) async throws
}

/// Protocol for manual expense management.
public protocol ToggleManualExpensePaidUseCase: Sendable {
    func execute(expenseId: String, isPaid: Bool) async throws
}