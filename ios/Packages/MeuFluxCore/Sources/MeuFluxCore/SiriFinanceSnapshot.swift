import Foundation

/// Compact, pre-formatted financial summary for Siri, Spotlight, and the on-device assistant.
/// Amounts are strings so intents never reformat `Money` in the background.
public struct SiriFinanceSnapshot: Codable, Sendable, Equatable, Hashable {
    public var displayName: String
    public var monthKey: String
    public var bankBalanceLabel: String
    public var netWorthLabel: String
    public var weeklySpendLabel: String
    public var weeklyDeltaPct: Double
    public var weeklyTopCategory: String?
    public var openBillsLabel: String
    public var creditCount: Int
    public var insights: [SiriInsight]
    public var budgets: [SiriBudget]
    public var recentTransactions: [SiriTransaction]
    public var incomeLabel: String?
    public var expenseLabel: String?
    public var netLabel: String?
    public var categories: [SiriCategory]
    public var cards: [SiriCard]
    public var accounts: [SiriAccount]
    public var creditPurchases: [SiriCreditBillPurchase]
    public var updatedAt: Date

    public init(
        displayName: String,
        monthKey: String,
        bankBalanceLabel: String,
        netWorthLabel: String,
        weeklySpendLabel: String,
        weeklyDeltaPct: Double,
        weeklyTopCategory: String?,
        openBillsLabel: String,
        creditCount: Int,
        insights: [SiriInsight],
        budgets: [SiriBudget],
        recentTransactions: [SiriTransaction],
        incomeLabel: String? = nil,
        expenseLabel: String? = nil,
        netLabel: String? = nil,
        categories: [SiriCategory] = [],
        cards: [SiriCard] = [],
        accounts: [SiriAccount] = [],
        creditPurchases: [SiriCreditBillPurchase] = [],
        updatedAt: Date
    ) {
        self.displayName = displayName
        self.monthKey = monthKey
        self.bankBalanceLabel = bankBalanceLabel
        self.netWorthLabel = netWorthLabel
        self.weeklySpendLabel = weeklySpendLabel
        self.weeklyDeltaPct = weeklyDeltaPct
        self.weeklyTopCategory = weeklyTopCategory
        self.openBillsLabel = openBillsLabel
        self.creditCount = creditCount
        self.insights = insights
        self.budgets = budgets
        self.recentTransactions = recentTransactions
        self.incomeLabel = incomeLabel
        self.expenseLabel = expenseLabel
        self.netLabel = netLabel
        self.categories = categories
        self.cards = cards
        self.accounts = accounts
        self.creditPurchases = creditPurchases
        self.updatedAt = updatedAt
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        displayName = try c.decode(String.self, forKey: .displayName)
        monthKey = try c.decode(String.self, forKey: .monthKey)
        bankBalanceLabel = try c.decode(String.self, forKey: .bankBalanceLabel)
        netWorthLabel = try c.decode(String.self, forKey: .netWorthLabel)
        weeklySpendLabel = try c.decode(String.self, forKey: .weeklySpendLabel)
        weeklyDeltaPct = try c.decode(Double.self, forKey: .weeklyDeltaPct)
        weeklyTopCategory = try c.decodeIfPresent(String.self, forKey: .weeklyTopCategory)
        openBillsLabel = try c.decode(String.self, forKey: .openBillsLabel)
        creditCount = try c.decode(Int.self, forKey: .creditCount)
        insights = try c.decode([SiriInsight].self, forKey: .insights)
        budgets = try c.decode([SiriBudget].self, forKey: .budgets)
        recentTransactions = try c.decode([SiriTransaction].self, forKey: .recentTransactions)
        incomeLabel = try c.decodeIfPresent(String.self, forKey: .incomeLabel)
        expenseLabel = try c.decodeIfPresent(String.self, forKey: .expenseLabel)
        netLabel = try c.decodeIfPresent(String.self, forKey: .netLabel)
        categories = try c.decodeIfPresent([SiriCategory].self, forKey: .categories) ?? []
        cards = try c.decodeIfPresent([SiriCard].self, forKey: .cards) ?? []
        accounts = try c.decodeIfPresent([SiriAccount].self, forKey: .accounts) ?? []
        creditPurchases = try c.decodeIfPresent([SiriCreditBillPurchase].self, forKey: .creditPurchases) ?? []
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
    }

    public struct SiriInsight: Codable, Sendable, Equatable, Hashable, Identifiable {
        public var id: String
        public var type: String
        public var text: String
        public var generatedOnDevice: Bool

        public init(id: String, type: String, text: String, generatedOnDevice: Bool) {
            self.id = id
            self.type = type
            self.text = text
            self.generatedOnDevice = generatedOnDevice
        }
    }

    public struct SiriBudget: Codable, Sendable, Equatable, Hashable, Identifiable {
        public var id: String { category }
        public var category: String
        public var spentLabel: String
        public var limitLabel: String
        public var percent: Int

        public init(category: String, spentLabel: String, limitLabel: String, percent: Int) {
            self.category = category
            self.spentLabel = spentLabel
            self.limitLabel = limitLabel
            self.percent = percent
        }
    }

    public struct SiriTransaction: Codable, Sendable, Equatable, Hashable, Identifiable {
        public var id: String
        public var description: String
        public var category: String
        public var amountLabel: String
        public var dateRelative: String
        public var isCredit: Bool

        public init(
            id: String,
            description: String,
            category: String,
            amountLabel: String,
            dateRelative: String,
            isCredit: Bool
        ) {
            self.id = id
            self.description = description
            self.category = category
            self.amountLabel = amountLabel
            self.dateRelative = dateRelative
            self.isCredit = isCredit
        }
    }

    public struct SiriCategory: Codable, Sendable, Equatable, Hashable, Identifiable {
        public var id: String { name }
        public var name: String
        public var amountLabel: String
        public var amount: Double

        public init(name: String, amountLabel: String, amount: Double) {
            self.name = name
            self.amountLabel = amountLabel
            self.amount = amount
        }
    }

    public struct SiriCard: Codable, Sendable, Equatable, Hashable, Identifiable {
        public var id: String
        public var name: String
        public var institutionName: String
        public var lastFour: String
        public var openTotalLabel: String
        public var openTotalAmount: Double
        public var outstandingLabel: String

        public init(
            id: String,
            name: String,
            institutionName: String,
            lastFour: String,
            openTotalLabel: String,
            openTotalAmount: Double,
            outstandingLabel: String
        ) {
            self.id = id
            self.name = name
            self.institutionName = institutionName
            self.lastFour = lastFour
            self.openTotalLabel = openTotalLabel
            self.openTotalAmount = openTotalAmount
            self.outstandingLabel = outstandingLabel
        }
    }

    public struct SiriAccount: Codable, Sendable, Equatable, Hashable, Identifiable {
        public var id: String
        public var name: String
        public var kind: String
        public var amountLabel: String
        public var institutionName: String?

        public init(
            id: String,
            name: String,
            kind: String,
            amountLabel: String,
            institutionName: String?
        ) {
            self.id = id
            self.name = name
            self.kind = kind
            self.amountLabel = amountLabel
            self.institutionName = institutionName
        }
    }

    public struct SiriCreditBillPurchase: Codable, Sendable, Equatable, Hashable, Identifiable {
        public var id: String
        public var cardId: String
        public var cardName: String
        public var description: String
        public var amountLabel: String
        public var amount: Double
        public var purchaseDate: String?
        public var dueMonth: String
        public var isInstallment: Bool
        public var installmentNumber: Int?
        public var installmentTotal: Int?
        public var installmentLabel: String?
        public var category: String?
        public var merchantName: String?
        public var isPayment: Bool

        public init(
            id: String,
            cardId: String,
            cardName: String,
            description: String,
            amountLabel: String,
            amount: Double,
            purchaseDate: String? = nil,
            dueMonth: String,
            isInstallment: Bool = false,
            installmentNumber: Int? = nil,
            installmentTotal: Int? = nil,
            installmentLabel: String? = nil,
            category: String? = nil,
            merchantName: String? = nil,
            isPayment: Bool = false
        ) {
            self.id = id
            self.cardId = cardId
            self.cardName = cardName
            self.description = description
            self.amountLabel = amountLabel
            self.amount = amount
            self.purchaseDate = purchaseDate
            self.dueMonth = dueMonth
            self.isInstallment = isInstallment
            self.installmentNumber = installmentNumber
            self.installmentTotal = installmentTotal
            self.installmentLabel = installmentLabel
            self.category = category
            self.merchantName = merchantName
            self.isPayment = isPayment
        }
    }

    public var rankedCards: [SiriCard] {
        cards.sorted { $0.openTotalAmount > $1.openTotalAmount }
    }

    public var topCardByOpenSpend: SiriCard? {
        rankedCards.first
    }

    public var rankedCategories: [SiriCategory] {
        categories.sorted { $0.amount > $1.amount }
    }

    public func preservingLists(from previous: SiriFinanceSnapshot?) -> SiriFinanceSnapshot {
        guard let previous else { return self }
        var copy = self
        if copy.cards.isEmpty { copy.cards = previous.cards }
        if copy.accounts.isEmpty { copy.accounts = previous.accounts }
        if copy.creditPurchases.isEmpty { copy.creditPurchases = previous.creditPurchases }
        return copy
    }

    public var balanceDialog: String {
        "Seu saldo em contas no MeuFlux é \(bankBalanceLabel). Patrimônio líquido: \(netWorthLabel)."
    }

    public var weeklySpendDialog: String {
        var text = "Nos últimos 7 dias você gastou \(weeklySpendLabel)."
        let sign = weeklyDeltaPct > 0 ? "+" : ""
        text += " Isso é \(sign)\(Int(weeklyDeltaPct.rounded()))% vs a semana anterior."
        if let top = weeklyTopCategory {
            text += " Maior categoria: \(top)."
        }
        return text
    }

    public var openBillsDialog: String {
        if !cards.isEmpty {
            let lines = rankedCards.prefix(5).map { "\($0.name): \($0.openTotalLabel)" }
            return "Faturas abertas no MeuFlux: \(openBillsLabel). \(lines.joined(separator: "; "))."
        }
        return "Há \(creditCount) cartão(ões) com fatura aberta de \(openBillsLabel)."
    }

    public var cardSpendDialog: String {
        guard !cards.isEmpty, let top = topCardByOpenSpend else {
            return "Ainda não tenho o detalhe por cartão neste iPhone. Abra Cartões uma vez."
        }
        if cards.count == 1 {
            return "O \(top.name) tem fatura aberta de \(top.openTotalLabel)."
        }
        let rest = rankedCards.dropFirst().prefix(4).map { "\($0.name) \($0.openTotalLabel)" }
        return "O cartão com mais gastos na fatura aberta é \(top.name), com \(top.openTotalLabel). Em seguida: \(rest.joined(separator: ", "))."
    }

    public var categorySpendDialog: String {
        guard !categories.isEmpty, let top = rankedCategories.first else {
            return "Ainda não há gastos por categoria no resumo deste mês."
        }
        let rest = rankedCategories.dropFirst().prefix(4).map { "\($0.name) \($0.amountLabel)" }
        if rest.isEmpty {
            return "A maior categoria deste mês é \(top.name), com \(top.amountLabel)."
        }
        return "A maior categoria deste mês é \(top.name), com \(top.amountLabel). Em seguida: \(rest.joined(separator: ", "))."
    }

    public var budgetDialog: String {
        if budgets.isEmpty {
            return "Não há categorias de orçamento no resumo deste mês."
        }
        let lines = budgets.prefix(5).map {
            "\($0.category): \($0.spentLabel) de \($0.limitLabel) (\($0.percent)%)."
        }
        return lines.joined(separator: " ")
    }

    public var insightsDialog: String {
        if insights.isEmpty {
            return "Ainda não há insights no resumo local."
        }
        return insights.prefix(3).map(\.text).joined(separator: " ")
    }
}

public struct SiriSnapshotStore: @unchecked Sendable {
    public static let snapshotKey = "siri.finance.snapshot"

    private let defaults: UserDefaults?
    private let fallback: UserDefaults?

    public init(
        defaults: UserDefaults? = UserDefaults(suiteName: AppGroup.identifier),
        fallback: UserDefaults? = .standard
    ) {
        self.defaults = defaults
        self.fallback = fallback
    }

    public func save(_ snapshot: SiriFinanceSnapshot) {
        guard let data = encode(snapshot) else { return }
        defaults?.set(data, forKey: Self.snapshotKey)
        if fallback !== defaults {
            fallback?.set(data, forKey: Self.snapshotKey)
        }
    }

    public func load() -> SiriFinanceSnapshot? {
        if let data = defaults?.data(forKey: Self.snapshotKey), let snapshot = decode(data) {
            return snapshot
        }
        if fallback !== defaults, let data = fallback?.data(forKey: Self.snapshotKey) {
            return decode(data)
        }
        return nil
    }

    public func mergeCards(_ cards: [SiriFinanceSnapshot.SiriCard], now: Date = Date()) -> SiriFinanceSnapshot? {
        guard var snapshot = load() else { return nil }
        snapshot.cards = cards
        snapshot.updatedAt = now
        save(snapshot)
        return snapshot
    }

    public func mergeCreditPurchases(_ purchases: [SiriFinanceSnapshot.SiriCreditBillPurchase], now: Date = Date()) -> SiriFinanceSnapshot? {
        guard var snapshot = load() else { return nil }
        snapshot.creditPurchases = purchases
        snapshot.updatedAt = now
        save(snapshot)
        return snapshot
    }

    public func mergeCreditCardsAndPurchases(
        cards: [SiriFinanceSnapshot.SiriCard],
        purchases: [SiriFinanceSnapshot.SiriCreditBillPurchase],
        now: Date = Date()
    ) -> SiriFinanceSnapshot? {
        guard var snapshot = load() else { return nil }
        snapshot.cards = cards
        snapshot.creditPurchases = purchases
        snapshot.updatedAt = now
        save(snapshot)
        return snapshot
    }

    public func mergeAccounts(_ accounts: [SiriFinanceSnapshot.SiriAccount], now: Date = Date()) -> SiriFinanceSnapshot? {
        guard var snapshot = load() else { return nil }
        snapshot.accounts = accounts
        snapshot.updatedAt = now
        save(snapshot)
        return snapshot
    }

    public func clear() {
        defaults?.removeObject(forKey: Self.snapshotKey)
        if fallback !== defaults {
            fallback?.removeObject(forKey: Self.snapshotKey)
        }
    }

    private func encode(_ snapshot: SiriFinanceSnapshot) -> Data? {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(snapshot)
    }

    private func decode(_ data: Data) -> SiriFinanceSnapshot? {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(SiriFinanceSnapshot.self, from: data)
    }
}
