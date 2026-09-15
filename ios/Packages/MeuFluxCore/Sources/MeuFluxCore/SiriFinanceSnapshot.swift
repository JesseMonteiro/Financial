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
        self.updatedAt = updatedAt
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
