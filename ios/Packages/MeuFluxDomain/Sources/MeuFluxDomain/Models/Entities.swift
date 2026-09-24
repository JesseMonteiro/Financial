import Foundation

public enum AccountType: String, Sendable, Codable, Hashable {
    case checking
    case savings
    case credit
    case investment
    case loan
    case manual
    case other
}

public struct Account: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var name: String
    public var type: AccountType
    public var balance: Money
    public var institutionName: String?
    public var connectorId: String?
    public var isHidden: Bool
    public var currencyCode: String
    /// Open Finance account / card last digits.
    public var number: String?
    public var marketingName: String?
    public var isManual: Bool
    public var updatedAt: Date?
    public var ownerLabel: String?
    public var iconKey: String?
    /// Credit card current bill (absolute). Nil for bank accounts.
    public var billAmount: Money?
    public var creditLimit: Money?
    public var availableCreditLimit: Money?
    /// Sum of Open Finance “caixinhas” / reserved balances.
    public var reservedBalance: Money

    public init(
        id: String,
        name: String,
        type: AccountType,
        balance: Money,
        institutionName: String? = nil,
        connectorId: String? = nil,
        isHidden: Bool = false,
        currencyCode: String = "BRL",
        number: String? = nil,
        marketingName: String? = nil,
        isManual: Bool = false,
        updatedAt: Date? = nil,
        ownerLabel: String? = nil,
        iconKey: String? = nil,
        billAmount: Money? = nil,
        creditLimit: Money? = nil,
        availableCreditLimit: Money? = nil,
        reservedBalance: Money = .zero
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.balance = balance
        self.institutionName = institutionName
        self.connectorId = connectorId
        self.isHidden = isHidden
        self.currencyCode = currencyCode
        self.number = number
        self.marketingName = marketingName
        self.isManual = isManual
        self.updatedAt = updatedAt
        self.ownerLabel = ownerLabel
        self.iconKey = iconKey
        self.billAmount = billAmount
        self.creditLimit = creditLimit
        self.availableCreditLimit = availableCreditLimit
        self.reservedBalance = reservedBalance
    }

    public var isCreditCard: Bool { type == .credit }

    public var isBankAccount: Bool { !isCreditCard }

    /// Display amount: available balance for banks, current bill for cards.
    public var displayAmount: Money {
        if isCreditCard {
            let raw = billAmount ?? balance
            return Money(amount: abs(raw.amount), currencyCode: raw.currencyCode)
        }
        return balance
    }
}

public enum TransactionKind: String, Sendable, Codable {
    case debit
    case credit
    case transfer
}

/// Leaf category from Pluggy `GET /categories`, used to recategorize Open Finance transactions.
public struct TransactionCategory: Sendable, Hashable, Identifiable, Codable {
    public var id: String
    public var label: String
    public var parentId: String?

    public init(id: String, label: String, parentId: String? = nil) {
        self.id = id
        self.label = label
        self.parentId = parentId
    }
}

public struct CreditCardMetadata: Sendable, Hashable, Codable {
    public let billId: String?
    public let billForecastDate: String?
    
    public init(billId: String? = nil, billForecastDate: String? = nil) {
        self.billId = billId
        self.billForecastDate = billForecastDate
    }
}

public struct Transaction: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var accountId: String
    public var description: String
    public var amount: Money
    public var date: InstantDate
    public var category: String?
    public var categoryId: String?
    public var kind: TransactionKind
    public var isPending: Bool
    public var creditCardMetadata: CreditCardMetadata?
    public var billId: String?
    public var billForecastDate: String?

    public init(
        id: String,
        accountId: String,
        description: String,
        amount: Money,
        date: InstantDate,
        category: String? = nil,
        categoryId: String? = nil,
        kind: TransactionKind,
        isPending: Bool = false,
        creditCardMetadata: CreditCardMetadata? = nil,
        billId: String? = nil,
        billForecastDate: String? = nil
    ) {
        self.id = id
        self.accountId = accountId
        self.description = description
        self.amount = amount
        self.date = date
        self.category = category
        self.categoryId = categoryId
        self.kind = kind
        self.isPending = isPending
        self.creditCardMetadata = creditCardMetadata
        self.billId = billId
        self.billForecastDate = billForecastDate
    }
}

public enum BillStatus: String, Sendable, Codable {
    case open
    case closed
    case paid
    case overdue
}

public struct Bill: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var accountId: String
    public var dueMonth: DueMonth
    public var dueDate: InstantDate?
    public var totalAmount: Money
    public var minimumPayment: Money?
    public var status: BillStatus
    public var isPaid: Bool

    public init(
        id: String,
        accountId: String,
        dueMonth: DueMonth,
        dueDate: InstantDate? = nil,
        totalAmount: Money,
        minimumPayment: Money? = nil,
        status: BillStatus,
        isPaid: Bool = false
    ) {
        self.id = id
        self.accountId = accountId
        self.dueMonth = dueMonth
        self.dueDate = dueDate
        self.totalAmount = totalAmount
        self.minimumPayment = minimumPayment
        self.status = status
        self.isPaid = isPaid
    }
}

public struct Investment: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var name: String
    public var type: String
    public var balance: Money
    public var accountId: String?
    public var rate: Decimal?
    public var issuer: String?
    public var ownerLabel: String?

    public init(
        id: String,
        name: String,
        type: String,
        balance: Money,
        accountId: String? = nil,
        rate: Decimal? = nil,
        issuer: String? = nil,
        ownerLabel: String? = nil
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.balance = balance
        self.accountId = accountId
        self.rate = rate
        self.issuer = issuer
        self.ownerLabel = ownerLabel
    }
}

public struct Loan: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var name: String
    public var principal: Money
    public var outstandingBalance: Money
    public var interestRate: Decimal?
    public var nextDueDate: InstantDate?
    public var installmentAmount: Money?

    public init(
        id: String,
        name: String,
        principal: Money,
        outstandingBalance: Money,
        interestRate: Decimal? = nil,
        nextDueDate: InstantDate? = nil,
        installmentAmount: Money? = nil
    ) {
        self.id = id
        self.name = name
        self.principal = principal
        self.outstandingBalance = outstandingBalance
        self.interestRate = interestRate
        self.nextDueDate = nextDueDate
        self.installmentAmount = installmentAmount
    }
}

public struct BudgetTransactionItem: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public let description: String
    public let date: InstantDate
    public let amount: Money
    public let isMeal: Bool
    public let accountName: String
    public let subCategoryLabel: String?

    public init(
        id: String,
        description: String,
        date: InstantDate,
        amount: Money,
        isMeal: Bool,
        accountName: String,
        subCategoryLabel: String? = nil
    ) {
        self.id = id
        self.description = description
        self.date = date
        self.amount = amount
        self.isMeal = isMeal
        self.accountName = accountName
        self.subCategoryLabel = subCategoryLabel
    }
}

public struct BudgetLimit: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var category: String
    public var categoryLabel: String?
    public var subcategories: [BudgetSubcategorySpend]
    public var transactions: [BudgetTransactionItem]
    public var limit: Money
    public var spent: Money
    public var month: YearMonth
    public var period: BudgetPeriod
    public var periodAmount: Money
    public var monthCap: Money
    public var periodIndex: Int
    public var periodCount: Int
    public var spentBank: Money
    public var spentMeal: Money
    public var hasLimit: Bool
    public var isSubcategory: Bool
    public var parentCategoryLabel: String?

    public init(
        id: String,
        category: String,
        limit: Money,
        spent: Money,
        month: YearMonth,
        period: BudgetPeriod = .monthly,
        periodAmount: Money? = nil,
        monthCap: Money? = nil,
        periodIndex: Int = 1,
        periodCount: Int = 1,
        spentBank: Money? = nil,
        spentMeal: Money = .zero,
        hasLimit: Bool? = nil,
        categoryLabel: String? = nil,
        subcategories: [BudgetSubcategorySpend] = [],
        transactions: [BudgetTransactionItem] = [],
        isSubcategory: Bool = false,
        parentCategoryLabel: String? = nil
    ) {
        self.id = id
        self.category = category
        self.categoryLabel = categoryLabel
        self.subcategories = subcategories
        self.transactions = transactions
        self.limit = limit
        self.spent = spent
        self.month = month
        self.period = period
        self.periodAmount = periodAmount ?? limit
        self.monthCap = monthCap ?? limit
        self.periodIndex = periodIndex
        self.periodCount = periodCount
        self.spentBank = spentBank ?? spent
        self.spentMeal = spentMeal
        self.hasLimit = hasLimit ?? ((periodAmount ?? limit).amount > 0)
        self.isSubcategory = isSubcategory
        self.parentCategoryLabel = parentCategoryLabel
    }

    public var remaining: Money { limit.subtracting(spent) }
    public var utilization: Decimal {
        guard limit.amount != 0 else { return 0 }
        return spent.amount / limit.amount
    }

    public var displayLabel: String {
        if let categoryLabel, !categoryLabel.isEmpty { return categoryLabel }
        return BudgetCategoryCatalog.label(forCategory: category)
    }
}

public struct BudgetSubcategorySpend: Sendable, Identifiable, Hashable, Codable {
    public var id: String { label }
    public var label: String
    public var spent: Money

    public init(label: String, spent: Money) {
        self.label = label
        self.spent = spent
    }
}

public struct Goal: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var name: String
    public var target: Money
    public var current: Money
    public var deadline: InstantDate?

    public init(id: String, name: String, target: Money, current: Money, deadline: InstantDate? = nil) {
        self.id = id
        self.name = name
        self.target = target
        self.current = current
        self.deadline = deadline
    }

    public var progress: Decimal {
        guard target.amount != 0 else { return 0 }
        return current.amount / target.amount
    }
}

public struct ReceivableInstallment: Sendable, Identifiable, Hashable, Codable {
    public var installmentNumber: Int
    public var amount: Money
    public var dueDate: InstantDate
    public var paidAt: InstantDate?

    public var id: Int { installmentNumber }
    public var isPaid: Bool { paidAt != nil }

    public init(
        installmentNumber: Int,
        amount: Money,
        dueDate: InstantDate,
        paidAt: InstantDate? = nil
    ) {
        self.installmentNumber = installmentNumber
        self.amount = amount
        self.dueDate = dueDate
        self.paidAt = paidAt
    }
}

public struct Receivable: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var description: String
    public var amount: Money
    public var dueDate: InstantDate?
    public var isReceived: Bool
    public var counterparty: String?
    public var installments: Int
    public var paidInstallments: Int
    public var isContinuous: Bool
    public var personColor: String?
    public var originalTotalAmount: Money?
    public var linkedTransactionId: String?
    public var linkedBillForecastDate: String?
    public var notes: String?
    public var installmentHistory: [ReceivableInstallment]

    public init(
        id: String,
        description: String,
        amount: Money,
        dueDate: InstantDate? = nil,
        isReceived: Bool = false,
        counterparty: String? = nil,
        installments: Int = 1,
        paidInstallments: Int = 0,
        isContinuous: Bool = false,
        personColor: String? = nil,
        originalTotalAmount: Money? = nil,
        linkedTransactionId: String? = nil,
        linkedBillForecastDate: String? = nil,
        notes: String? = nil,
        installmentHistory: [ReceivableInstallment] = []
    ) {
        self.id = id
        self.description = description
        self.amount = amount
        self.dueDate = dueDate
        self.isReceived = isReceived
        self.counterparty = counterparty
        self.installments = max(1, installments)
        self.paidInstallments = paidInstallments
        self.isContinuous = isContinuous
        self.personColor = personColor
        self.originalTotalAmount = originalTotalAmount
        self.linkedTransactionId = linkedTransactionId
        self.linkedBillForecastDate = linkedBillForecastDate
        self.notes = notes
        self.installmentHistory = installmentHistory
    }

    public var personName: String {
        let name = counterparty?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Sem pessoa" : name
    }

    public var pendingAmount: Money {
        installmentHistory
            .filter { !$0.isPaid }
            .reduce(Money.zero) { $0.adding($1.amount) }
    }

    public var receivedAmount: Money {
        installmentHistory
            .filter(\.isPaid)
            .reduce(Money.zero) { $0.adding($1.amount) }
    }

    public var nextPendingDue: InstantDate? {
        installmentHistory
            .filter { !$0.isPaid }
            .sorted { $0.dueDate < $1.dueDate }
            .first?
            .dueDate
    }

    public var progressPercent: Int {
        let total = isContinuous
            ? (installmentHistory.first?.amount.amount ?? 0) * 24
            : amount.amount
        guard total > 0 else { return 100 }
        let paid = receivedAmount.amount
        let ratio = NSDecimalNumber(decimal: (paid / total) * 100).doubleValue
        return min(100, max(0, Int(ratio.rounded())))
    }
}

public struct ManualExpense: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var description: String
    public var amount: Money
    public var date: InstantDate
    public var category: String?
    public var accountId: String?
    public var isPaid: Bool
    public var isRecurring: Bool
    public var isContinuous: Bool
    /// Shared id for installment / recurrence series.
    public var parentId: String?
    public var originalDescription: String?
    public var frequency: String?
    public var paidAt: InstantDate?

    public init(
        id: String,
        description: String,
        amount: Money,
        date: InstantDate,
        category: String? = nil,
        accountId: String? = nil,
        isPaid: Bool = false,
        isRecurring: Bool = false,
        isContinuous: Bool = false,
        parentId: String? = nil,
        originalDescription: String? = nil,
        frequency: String? = nil,
        paidAt: InstantDate? = nil
    ) {
        self.id = id
        self.description = description
        self.amount = amount
        self.date = date
        self.category = category
        self.accountId = accountId
        self.isPaid = isPaid
        self.isRecurring = isRecurring
        self.isContinuous = isContinuous
        self.parentId = parentId
        self.originalDescription = originalDescription
        self.frequency = frequency
        self.paidAt = paidAt
    }

    public var groupKey: String { parentId ?? id }

    public var baseDescription: String {
        if let originalDescription, !originalDescription.isEmpty { return originalDescription }
        var text = description
        if let range = text.range(of: #" \(\d+/\d+\)$"#, options: .regularExpression) {
            text.removeSubrange(range)
        }
        if let range = text.range(of: #" \(Recorrente\)$"#, options: .regularExpression) {
            text.removeSubrange(range)
        }
        return text
    }
}

public struct Subscription: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var name: String
    public var amount: Money
    public var billingDay: Int?
    public var category: String?
    public var isActive: Bool

    public init(
        id: String,
        name: String,
        amount: Money,
        billingDay: Int? = nil,
        category: String? = nil,
        isActive: Bool = true
    ) {
        self.id = id
        self.name = name
        self.amount = amount
        self.billingDay = billingDay
        self.category = category
        self.isActive = isActive
    }
}

public enum AgendaItemKind: String, Sendable, Codable {
    case bill
    case receivable
    case subscription
    case loan
    case custom
}

public struct AgendaItem: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var title: String
    public var date: InstantDate
    public var amount: Money?
    public var kind: AgendaItemKind
    public var isCompleted: Bool

    public init(
        id: String,
        title: String,
        date: InstantDate,
        amount: Money? = nil,
        kind: AgendaItemKind,
        isCompleted: Bool = false
    ) {
        self.id = id
        self.title = title
        self.date = date
        self.amount = amount
        self.kind = kind
        self.isCompleted = isCompleted
    }
}

public struct UserProfile: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var email: String
    public var displayName: String
    public var avatarURL: URL?
    public var theme: String
    public var density: String
    public var animationsEnabled: Bool
    public var telegramChatId: String?
    public var customAccountNames: [String: String]

    public init(
        id: String,
        email: String = "",
        displayName: String,
        avatarURL: URL? = nil,
        theme: String = "system",
        density: String = "comfortable",
        animationsEnabled: Bool = true,
        telegramChatId: String? = nil,
        customAccountNames: [String: String] = [:]
    ) {
        self.id = id
        self.email = email
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.theme = theme
        self.density = density
        self.animationsEnabled = animationsEnabled
        self.telegramChatId = telegramChatId
        self.customAccountNames = customAccountNames
    }

    public var isTelegramLinked: Bool {
        !(telegramChatId ?? "").isEmpty
    }
}

public struct ProfilePatch: Sendable, Hashable {
    public var displayName: String?
    public var theme: String?
    public var density: String?
    public var animationsEnabled: Bool?
    public var customAccountNames: [String: String]?
    public var clearTelegramChatId: Bool

    public init(
        displayName: String? = nil,
        theme: String? = nil,
        density: String? = nil,
        animationsEnabled: Bool? = nil,
        customAccountNames: [String: String]? = nil,
        clearTelegramChatId: Bool = false
    ) {
        self.displayName = displayName
        self.theme = theme
        self.density = density
        self.animationsEnabled = animationsEnabled
        self.customAccountNames = customAccountNames
        self.clearTelegramChatId = clearTelegramChatId
    }
}

public struct ManualAccount: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var name: String
    public var type: AccountType
    public var institutionName: String
    public var balance: Money
    public var billAmount: Money?
    public var billDueDay: Int?
    public var creditLimit: Money?

    public init(
        id: String,
        name: String,
        type: AccountType,
        institutionName: String = "",
        balance: Money = .zero,
        billAmount: Money? = nil,
        billDueDay: Int? = nil,
        creditLimit: Money? = nil
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.institutionName = institutionName
        self.balance = balance
        self.billAmount = billAmount
        self.billDueDay = billDueDay
        self.creditLimit = creditLimit
    }
}

public struct ParsedBillPurchase: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var date: InstantDate?
    public var description: String
    public var amount: Money
    public var installment: Int?
    public var totalInstallments: Int?
    public var category: String?

    public init(
        id: String = UUID().uuidString,
        date: InstantDate? = nil,
        description: String,
        amount: Money,
        installment: Int? = nil,
        totalInstallments: Int? = nil,
        category: String? = nil
    ) {
        self.id = id
        self.date = date
        self.description = description
        self.amount = amount
        self.installment = installment
        self.totalInstallments = totalInstallments
        self.category = category
    }
}

public struct ParsedBill: Sendable, Hashable, Codable {
    public var totalAmount: Money
    public var dueDate: InstantDate?
    public var closingDate: InstantDate?
    public var cardLastDigits: String?
    public var institutionName: String?
    public var purchases: [ParsedBillPurchase]

    public init(
        totalAmount: Money,
        dueDate: InstantDate? = nil,
        closingDate: InstantDate? = nil,
        cardLastDigits: String? = nil,
        institutionName: String? = nil,
        purchases: [ParsedBillPurchase] = []
    ) {
        self.totalAmount = totalAmount
        self.dueDate = dueDate
        self.closingDate = closingDate
        self.cardLastDigits = cardLastDigits
        self.institutionName = institutionName
        self.purchases = purchases
    }
}

public struct AppSettings: Sendable, Hashable, Codable {
    public var preferredLocale: String
    public var biometricLockEnabled: Bool
    public var notificationsEnabled: Bool
    public var defaultDueMonthOffset: Int
    public var theme: String
    public var density: String
    public var animationsEnabled: Bool
    public var telegramLinked: Bool
    public var hasJointLink: Bool
    public var partnerName: String?

    public init(
        preferredLocale: String = "pt_BR",
        biometricLockEnabled: Bool = false,
        notificationsEnabled: Bool = true,
        defaultDueMonthOffset: Int = 0,
        theme: String = "system",
        density: String = "comfortable",
        animationsEnabled: Bool = true,
        telegramLinked: Bool = false,
        hasJointLink: Bool = false,
        partnerName: String? = nil
    ) {
        self.preferredLocale = preferredLocale
        self.biometricLockEnabled = biometricLockEnabled
        self.notificationsEnabled = notificationsEnabled
        self.defaultDueMonthOffset = defaultDueMonthOffset
        self.theme = theme
        self.density = density
        self.animationsEnabled = animationsEnabled
        self.telegramLinked = telegramLinked
        self.hasJointLink = hasJointLink
        self.partnerName = partnerName
    }
}
