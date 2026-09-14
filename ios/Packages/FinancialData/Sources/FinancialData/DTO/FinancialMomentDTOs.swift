import Foundation

/// Financial moment response from BFF
public struct FinancialMomentDTO: Codable, Sendable {
    public let selectedMonth: String  // YYYY-MM
    public let salary: Double
    public let receivables: ReceivablesSummaryDTO
    public let creditCards: CreditCardsSummaryDTO
    public let automaticDebits: AutomaticDebitsSummaryDTO
    public let manualExpenses: ManualExpensesSummaryDTO
    public let totals: FinancialTotalsDTO
    public let status: MonthStatusDTO
    public let monthsStatus: [String: MonthStatusDTO]?
    public let calculationVersion: String?

    public init(
        selectedMonth: String,
        salary: Double,
        receivables: ReceivablesSummaryDTO,
        creditCards: CreditCardsSummaryDTO,
        automaticDebits: AutomaticDebitsSummaryDTO,
        manualExpenses: ManualExpensesSummaryDTO,
        totals: FinancialTotalsDTO,
        status: MonthStatusDTO,
        monthsStatus: [String: MonthStatusDTO]? = nil,
        calculationVersion: String? = nil
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
        self.calculationVersion = calculationVersion
    }
}

public struct ReceivablesSummaryDTO: Codable, Sendable {
    public let items: [ReceivableItemDTO]
    public let total: Double

    public init(items: [ReceivableItemDTO], total: Double) {
        self.items = items
        self.total = total
    }
}

public struct ReceivableItemDTO: Codable, Sendable {
    public let personName: String
    public let personColor: String
    public let description: String
    public let amount: Double
    public let installmentNumber: Int
    public let totalInstallments: Int
    public let isPaid: Bool
    public let ownerLabel: String?

    public init(
        personName: String,
        personColor: String,
        description: String,
        amount: Double,
        installmentNumber: Int,
        totalInstallments: Int,
        isPaid: Bool,
        ownerLabel: String? = nil
    ) {
        self.personName = personName
        self.personColor = personColor
        self.description = description
        self.amount = amount
        self.installmentNumber = installmentNumber
        self.totalInstallments = totalInstallments
        self.isPaid = isPaid
        self.ownerLabel = ownerLabel
    }
}

public struct CreditCardsSummaryDTO: Codable, Sendable {
    public let bills: [CreditCardBillItemDTO]
    public let total: Double

    public init(bills: [CreditCardBillItemDTO], total: Double) {
        self.bills = bills
        self.total = total
    }
}

public struct CreditCardBillItemDTO: Codable, Sendable {
    public let cardId: String
    public let cardName: String
    public let amount: Double
    public let dueDate: String
    public let isPaid: Bool
    public let isFallback: Bool
    public let ownerLabel: String?
    public let lastFour: String?
    public let institutionName: String?
    public let marketingName: String?
    public let connectorName: String?
    public let iconKey: String?
    public let cardFaceUrl: String?

    public init(
        cardId: String,
        cardName: String,
        amount: Double,
        dueDate: String,
        isPaid: Bool,
        isFallback: Bool,
        ownerLabel: String? = nil,
        lastFour: String? = nil,
        institutionName: String? = nil,
        marketingName: String? = nil,
        connectorName: String? = nil,
        iconKey: String? = nil,
        cardFaceUrl: String? = nil
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
        self.cardFaceUrl = cardFaceUrl
    }
}

public struct AutomaticDebitsSummaryDTO: Codable, Sendable {
    public let items: [AutomaticDebitItemDTO]
    public let total: Double

    public init(items: [AutomaticDebitItemDTO], total: Double) {
        self.items = items
        self.total = total
    }
}

public struct AutomaticDebitItemDTO: Codable, Sendable {
    public let id: String
    public let description: String
    public let amount: Double
    public let date: String
    public let accountId: String
    public let accountName: String
    public let isPending: Bool

    public init(
        id: String,
        description: String,
        amount: Double,
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

public struct ManualExpensesSummaryDTO: Codable, Sendable {
    public let items: [ManualExpenseItemDTO]
    public let total: Double

    public init(items: [ManualExpenseItemDTO], total: Double) {
        self.items = items
        self.total = total
    }
}

public struct ManualExpenseItemDTO: Codable, Sendable {
    public let id: String
    public let description: String
    public let amount: Double
    public let date: String
    public let category: String
    public let isPaid: Bool
    public let ownerLabel: String?

    public init(
        id: String,
        description: String,
        amount: Double,
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

public struct FinancialTotalsDTO: Codable, Sendable {
    public let income: Double
    public let expenses: Double
    public let accountsPayable: Double
    public let netBalance: Double

    public init(income: Double, expenses: Double, accountsPayable: Double, netBalance: Double) {
        self.income = income
        self.expenses = expenses
        self.accountsPayable = accountsPayable
        self.netBalance = netBalance
    }
}

public struct MonthStatusDTO: Codable, Sendable {
    public let isPositive: Bool
    public let net: Double

    public init(isPositive: Bool, net: Double) {
        self.isPositive = isPositive
        self.net = net
    }
}

/// Salary management DTOs
public struct SalarySettingDTO: Codable, Sendable {
    public let currentAmount: Double
    public let isDefault: Bool

    public init(currentAmount: Double, isDefault: Bool) {
        self.currentAmount = currentAmount
        self.isDefault = isDefault
    }
}

public struct SaveSalaryRequestDTO: Codable, Sendable {
    public let amount: Double
    public let month: String  // YYYY-MM

    public init(amount: Double, month: String) {
        self.amount = amount
        self.month = month
    }
}

/// Toggle manual expense paid DTO
public struct ToggleManualExpensePaidRequestDTO: Codable, Sendable {
    public let expenseId: String
    public let isPaid: Bool

    public init(expenseId: String, isPaid: Bool) {
        self.expenseId = expenseId
        self.isPaid = isPaid
    }
}