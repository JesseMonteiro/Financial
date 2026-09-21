import Foundation

public struct CreditCardsScreen: Sendable, Hashable {
    public var cards: [CreditCardSummary]
    public var outstandingTotal: Money
    public var creditLimitTotal: Money
    public var availableLimitTotal: Money
    public var periods: [String: CreditBillPeriod]

    public init(
        cards: [CreditCardSummary],
        outstandingTotal: Money,
        creditLimitTotal: Money,
        availableLimitTotal: Money,
        periods: [String: CreditBillPeriod]
    ) {
        self.cards = cards
        self.outstandingTotal = outstandingTotal
        self.creditLimitTotal = creditLimitTotal
        self.availableLimitTotal = availableLimitTotal
        self.periods = periods
    }

    public static let allCardsId = "all"

    public func period(for cardId: String) -> CreditBillPeriod {
        periods[cardId] ?? periods[Self.allCardsId] ?? CreditBillPeriod(openDueKey: nil, bills: [])
    }

    public func displayName(forAccountId id: String) -> String? {
        cards.first(where: { $0.id == id })?.name
    }

    public func resolvedCreditLimit(cardId: String) -> Money {
        if cardId != Self.allCardsId, let card = cards.first(where: { $0.id == cardId }) {
            return card.creditLimit ?? .zero
        }
        return creditLimitTotal
    }

    public func resolvedAvailableLimit(cardId: String) -> Money {
        CreditLimitUsage.available(
            creditLimit: resolvedCreditLimit(cardId: cardId).amount,
            reportedAvailable: reportedAvailable(cardId: cardId),
            outstanding: resolvedOutstanding(cardId: cardId).amount,
            utilizedBills: period(for: cardId).utilizedTotal
        )
    }

    public func limitFreePercent(cardId: String) -> Int {
        CreditLimitUsage.freePercent(
            creditLimit: resolvedCreditLimit(cardId: cardId).amount,
            reportedAvailable: reportedAvailable(cardId: cardId),
            outstanding: resolvedOutstanding(cardId: cardId).amount,
            utilizedBills: period(for: cardId).utilizedTotal
        )
    }

    private func resolvedOutstanding(cardId: String) -> Money {
        if cardId != Self.allCardsId, let card = cards.first(where: { $0.id == cardId }) {
            return card.outstanding
        }
        return outstandingTotal
    }

    private func reportedAvailable(cardId: String) -> Decimal? {
        if cardId != Self.allCardsId, let card = cards.first(where: { $0.id == cardId }) {
            return card.availableLimit?.amount
        }
        return availableLimitTotal.amount
    }
}

/// Derives used/available credit when the bank reports a stale full limit or zero outstanding.
public enum CreditLimitUsage: Sendable {
    public static func used(
        creditLimit: Decimal,
        reportedAvailable: Decimal?,
        outstanding: Decimal,
        utilizedBills: Decimal
    ) -> Decimal {
        let fromAvailable: Decimal = {
            guard creditLimit > 0, let available = reportedAvailable else { return 0 }
            return max(0, creditLimit - available)
        }()
        return [fromAvailable, max(0, outstanding), max(0, utilizedBills)].max() ?? 0
    }

    public static func available(
        creditLimit: Decimal,
        reportedAvailable: Decimal?,
        outstanding: Decimal,
        utilizedBills: Decimal
    ) -> Money {
        guard creditLimit > 0 else {
            return Money(amount: max(0, reportedAvailable ?? 0))
        }
        let usedAmount = min(
            creditLimit,
            used(
                creditLimit: creditLimit,
                reportedAvailable: reportedAvailable,
                outstanding: outstanding,
                utilizedBills: utilizedBills
            )
        )
        return Money(amount: max(0, creditLimit - usedAmount))
    }

    public static func freePercent(
        creditLimit: Decimal,
        reportedAvailable: Decimal?,
        outstanding: Decimal,
        utilizedBills: Decimal
    ) -> Int {
        guard creditLimit > 0 else { return 0 }
        let usedAmount = min(
            creditLimit,
            used(
                creditLimit: creditLimit,
                reportedAvailable: reportedAvailable,
                outstanding: outstanding,
                utilizedBills: utilizedBills
            )
        )
        var percent = (usedAmount / creditLimit) * 100
        var rounded = Decimal()
        NSDecimalRound(&rounded, &percent, 0, .plain)
        let usedPct = NSDecimalNumber(decimal: rounded).intValue
        return max(0, min(100, 100 - usedPct))
    }
}

public struct CreditCardSummary: Sendable, Hashable, Identifiable {
    public let id: String
    public var name: String
    public var institutionName: String
    public var marketingName: String
    public var connectorName: String
    public var iconKey: String?
    public var cardFaceURL: URL?
    public var lastFour: String
    public var outstanding: Money
    public var openTotal: Money
    public var openDueKey: String?
    public var openDueDate: InstantDate?
    public var openTitle: String?
    public var lastPaidTotal: Money?
    public var lastPaidKey: String?
    public var lastPaidTitle: String?
    public var creditLimit: Money?
    public var availableLimit: Money?

    public init(
        id: String,
        name: String,
        institutionName: String,
        lastFour: String,
        outstanding: Money,
        openTotal: Money,
        openDueKey: String? = nil,
        openDueDate: InstantDate? = nil,
        openTitle: String? = nil,
        lastPaidTotal: Money? = nil,
        lastPaidKey: String? = nil,
        lastPaidTitle: String? = nil,
        creditLimit: Money? = nil,
        availableLimit: Money? = nil,
        marketingName: String = "",
        connectorName: String = "",
        iconKey: String? = nil,
        cardFaceURL: URL? = nil
    ) {
        self.id = id
        self.name = name
        self.institutionName = institutionName
        self.marketingName = marketingName
        self.connectorName = connectorName
        self.iconKey = iconKey
        self.cardFaceURL = cardFaceURL
        self.lastFour = lastFour
        self.outstanding = outstanding
        self.openTotal = openTotal
        self.openDueKey = openDueKey
        self.openDueDate = openDueDate
        self.openTitle = openTitle
        self.lastPaidTotal = lastPaidTotal
        self.lastPaidKey = lastPaidKey
        self.lastPaidTitle = lastPaidTitle
        self.creditLimit = creditLimit
        self.availableLimit = availableLimit
    }
}

public struct CreditBillPeriod: Sendable, Hashable {
    public var openDueKey: String?
    public var bills: [CreditBillBucket]

    public init(openDueKey: String?, bills: [CreditBillBucket]) {
        self.openDueKey = openDueKey
        self.bills = bills
    }

    public func bill(for key: String?) -> CreditBillBucket? {
        guard let key else { return bills.first(where: { $0.dueMonth == openDueKey }) ?? bills.last }
        return bills.first(where: { $0.dueMonth == key })
    }

    public var openBill: CreditBillBucket? { bill(for: openDueKey) }

    public var lastPaidBill: CreditBillBucket? {
        bills.reversed().first { bucket in
            bucket.isPaid && bucket.type == .past && (bucket.hasOfficial || bucket.total.amount > (Decimal(string: "0.05") ?? 0))
        }
    }

    /// Amount still consuming limit: unpaid closed bills, the open cycle, and projected installments.
    public var utilizedTotal: Decimal {
        bills.reduce(0) { sum, bill in
            if bill.type == .past && bill.isPaid { return sum }
            return sum + max(0, bill.total.amount)
        }
    }

    /// Resolved key for the current bill ("fatura atual").
    /// Aligns with the web project logic: prioritizes the next open or closed unpaid bill.
    /// When the current calendar month is already paid, focus advances to the next open bill.
    public func resolvedCurrentDueKey(referenceDate: Date = Date()) -> String? {
        let calendarKey = YearMonth(from: referenceDate).key

        // 1. If openDueKey matches a bill that is not paid, or is open:
        if let openDueKey, let bill = bills.first(where: { $0.dueMonth == openDueKey }) {
            if !bill.isPaid || bill.type == .currentOpen {
                return openDueKey
            }
            // If the bill at openDueKey is already paid, advance to the next unpaid bill
            if let nextUnpaid = bills.first(where: { $0.dueMonth >= openDueKey && !$0.isPaid }) {
                return nextUnpaid.dueMonth
            }
        }

        // 2. Next unpaid or open bill
        if let open = bills.first(where: { $0.type == .currentOpen && !$0.isPaid }) ?? bills.first(where: { $0.type == .currentOpen }) {
            return open.dueMonth
        }

        // 3. Upcoming unpaid bill starting from calendar month or future
        if let upcomingUnpaid = bills.first(where: { $0.dueMonth >= calendarKey && !$0.isPaid }) {
            return upcomingUnpaid.dueMonth
        }

        // 4. Any unpaid bill in the list (e.g. overdue closed bill)
        if let anyUnpaid = bills.first(where: { !$0.isPaid }) {
            return anyUnpaid.dueMonth
        }

        // 5. Fallback to openDueKey if present in bills
        if let openDueKey, bills.contains(where: { $0.dueMonth == openDueKey }) {
            return openDueKey
        }

        // 6. Fallback: calendar month if present, or closest month to calendar month, or last bill
        if bills.contains(where: { $0.dueMonth == calendarKey }) {
            return calendarKey
        }
        guard let refYm = YearMonth(key: calendarKey) else { return bills.last?.dueMonth }
        return bills.min(by: { a, b in
            let distA = (YearMonth(key: a.dueMonth).map { abs(($0.year * 12 + $0.month) - (refYm.year * 12 + refYm.month)) }) ?? Int.max
            let distB = (YearMonth(key: b.dueMonth).map { abs(($0.year * 12 + $0.month) - (refYm.year * 12 + refYm.month)) }) ?? Int.max
            return distA < distB
        })?.dueMonth ?? bills.last?.dueMonth
    }
}

public enum CreditBillKind: String, Sendable, Hashable, Codable {
    case currentOpen = "CURRENT_OPEN"
    case past = "PAST"
    case future = "FUTURE"
}

public struct CreditBillBucket: Sendable, Hashable, Identifiable {
    public var id: String { dueMonth }
    public var dueMonth: String
    public var title: String
    public var type: CreditBillKind
    public var total: Money
    public var dueDate: InstantDate?
    public var dueDateShort: String
    public var isPaid: Bool
    public var hasOfficial: Bool
    public var items: [CreditBillLine]

    public init(
        dueMonth: String,
        title: String,
        type: CreditBillKind,
        total: Money,
        dueDate: InstantDate? = nil,
        dueDateShort: String,
        isPaid: Bool,
        hasOfficial: Bool,
        items: [CreditBillLine]
    ) {
        self.dueMonth = dueMonth
        self.title = title
        self.type = type
        self.total = total
        self.dueDate = dueDate
        self.dueDateShort = dueDateShort
        self.isPaid = isPaid
        self.hasOfficial = hasOfficial
        self.items = items
    }

    public var badgeText: String {
        switch type {
        case .future: return "Projetada"
        case .currentOpen: return "Em Aberto"
        case .past: return isPaid ? "Paga" : "Fechada"
        }
    }
}

public struct CreditBillLine: Sendable, Hashable, Identifiable {
    public let id: String
    public var accountId: String
    public var accountName: String
    public var description: String
    public var amount: Money
    public var isCredit: Bool
    public var isPayment: Bool
    public var isProjected: Bool
    public var isPending: Bool
    public var category: String?
    public var categoryId: String?
    public var purchaseDate: InstantDate?
    public var installmentNumber: Int?
    public var installmentTotal: Int?
    public var merchantName: String?

    public init(
        id: String,
        accountId: String,
        accountName: String,
        description: String,
        amount: Money,
        isCredit: Bool,
        isPayment: Bool,
        isProjected: Bool,
        isPending: Bool,
        category: String? = nil,
        categoryId: String? = nil,
        purchaseDate: InstantDate? = nil,
        installmentNumber: Int? = nil,
        installmentTotal: Int? = nil,
        merchantName: String? = nil
    ) {
        self.id = id
        self.accountId = accountId
        self.accountName = accountName
        self.description = description
        self.amount = amount
        self.isCredit = isCredit
        self.isPayment = isPayment
        self.isProjected = isProjected
        self.isPending = isPending
        self.category = category
        self.categoryId = categoryId
        self.purchaseDate = purchaseDate
        self.installmentNumber = installmentNumber
        self.installmentTotal = installmentTotal
        self.merchantName = merchantName
    }

    public var installmentLabel: String? {
        guard let installmentNumber, let installmentTotal, installmentTotal > 1 else { return nil }
        return "Parcela \(installmentNumber)/\(installmentTotal)"
    }

    public var statusLabel: String {
        if isProjected { return "Parcela projetada" }
        if isPending { return "Pendente" }
        return "Confirmado"
    }
}

public protocol CreditCardsRepository: Sendable {
    func fetchScreen(force: Bool) async throws -> CreditCardsScreen
}

public extension CreditCardsRepository {
    func fetchScreen() async throws -> CreditCardsScreen {
        try await fetchScreen(force: false)
    }
}

public struct StubCreditCardsRepository: CreditCardsRepository {
    public init() {}
    public func fetchScreen(force: Bool) async throws -> CreditCardsScreen {
        _ = force
        return CreditCardsScreen(
            cards: [],
            outstandingTotal: .zero,
            creditLimitTotal: .zero,
            availableLimitTotal: .zero,
            periods: [CreditCardsScreen.allCardsId: CreditBillPeriod(openDueKey: nil, bills: [])]
        )
    }
}
