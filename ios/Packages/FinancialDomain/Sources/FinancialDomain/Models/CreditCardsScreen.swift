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
