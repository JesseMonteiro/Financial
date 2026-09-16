import Foundation

/// Home-screen snapshot of the joint financial moment.
/// Amounts are pre-formatted (pt-BR) so the widget never touches `Money`.
public struct JointFinanceWidgetSnapshot: Codable, Sendable, Equatable, Hashable {
    public var hasActiveLink: Bool
    public var membersLabel: String
    public var monthKey: String
    public var monthLabel: String
    public var incomeLabel: String
    public var expenseLabel: String
    public var payableLabel: String
    public var netLabel: String
    public var utilizationPercent: Int
    public var isNetPositive: Bool
    public var isOverBudget: Bool
    public var payableIsClear: Bool
    public var unpaidBillsCount: Int
    public var unpaidDebitsCount: Int
    public var memberCount: Int
    public var updatedAt: Date

    public init(
        hasActiveLink: Bool,
        membersLabel: String,
        monthKey: String,
        monthLabel: String,
        incomeLabel: String,
        expenseLabel: String,
        payableLabel: String,
        netLabel: String,
        utilizationPercent: Int,
        isNetPositive: Bool,
        isOverBudget: Bool,
        payableIsClear: Bool,
        unpaidBillsCount: Int,
        unpaidDebitsCount: Int,
        memberCount: Int,
        updatedAt: Date
    ) {
        self.hasActiveLink = hasActiveLink
        self.membersLabel = membersLabel
        self.monthKey = monthKey
        self.monthLabel = monthLabel
        self.incomeLabel = incomeLabel
        self.expenseLabel = expenseLabel
        self.payableLabel = payableLabel
        self.netLabel = netLabel
        self.utilizationPercent = utilizationPercent
        self.isNetPositive = isNetPositive
        self.isOverBudget = isOverBudget
        self.payableIsClear = payableIsClear
        self.unpaidBillsCount = unpaidBillsCount
        self.unpaidDebitsCount = unpaidDebitsCount
        self.memberCount = memberCount
        self.updatedAt = updatedAt
    }

    public var payableSubtitle: String {
        if payableIsClear { return "Nada pendente" }
        return "\(unpaidBillsCount) fat. · \(unpaidDebitsCount) déb."
    }

    public var netSubtitle: String {
        isNetPositive ? "Superávit" : "Déficit"
    }

    public static let placeholder = JointFinanceWidgetSnapshot(
        hasActiveLink: true,
        membersLabel: "Você · Parceiro",
        monthKey: "2026-09",
        monthLabel: "Setembro 2026",
        incomeLabel: "R$ —",
        expenseLabel: "R$ —",
        payableLabel: "R$ —",
        netLabel: "R$ —",
        utilizationPercent: 0,
        isNetPositive: true,
        isOverBudget: false,
        payableIsClear: true,
        unpaidBillsCount: 0,
        unpaidDebitsCount: 0,
        memberCount: 2,
        updatedAt: Date(timeIntervalSince1970: 0)
    )

    public static let preview = JointFinanceWidgetSnapshot(
        hasActiveLink: true,
        membersLabel: "Você · Parceiro",
        monthKey: "2026-09",
        monthLabel: "Setembro 2026",
        incomeLabel: "R$ 18.000,00",
        expenseLabel: "R$ 12.400,00",
        payableLabel: "R$ 2.100,00",
        netLabel: "+R$ 5.600,00",
        utilizationPercent: 69,
        isNetPositive: true,
        isOverBudget: false,
        payableIsClear: false,
        unpaidBillsCount: 1,
        unpaidDebitsCount: 2,
        memberCount: 2,
        updatedAt: Date()
    )

    public static func inactive(now: Date = Date()) -> JointFinanceWidgetSnapshot {
        JointFinanceWidgetSnapshot(
            hasActiveLink: false,
            membersLabel: "",
            monthKey: "",
            monthLabel: "",
            incomeLabel: "R$ —",
            expenseLabel: "R$ —",
            payableLabel: "R$ —",
            netLabel: "R$ —",
            utilizationPercent: 0,
            isNetPositive: true,
            isOverBudget: false,
            payableIsClear: true,
            unpaidBillsCount: 0,
            unpaidDebitsCount: 0,
            memberCount: 0,
            updatedAt: now
        )
    }
}

public struct JointFinanceWidgetStore: @unchecked Sendable {
    public static let snapshotKey = "jointFinance.widget.snapshot"
    public static let authenticatedKey = "jointFinance.widget.authenticated"

    private let defaults: UserDefaults?

    public init(defaults: UserDefaults? = UserDefaults(suiteName: AppGroup.identifier)) {
        self.defaults = defaults
    }

    public func save(_ snapshot: JointFinanceWidgetSnapshot) {
        guard let defaults else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: Self.snapshotKey)
        defaults.set(true, forKey: Self.authenticatedKey)
        defaults.synchronize()
    }

    public func load() -> JointFinanceWidgetSnapshot? {
        guard let defaults, let data = defaults.data(forKey: Self.snapshotKey) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(JointFinanceWidgetSnapshot.self, from: data)
    }

    public func setAuthenticated(_ isAuthenticated: Bool) {
        defaults?.set(isAuthenticated, forKey: Self.authenticatedKey)
        if !isAuthenticated {
            defaults?.removeObject(forKey: Self.snapshotKey)
        }
        defaults?.synchronize()
    }

    public func isAuthenticated() -> Bool {
        defaults?.bool(forKey: Self.authenticatedKey) ?? false
    }

    public func clear() {
        defaults?.removeObject(forKey: Self.snapshotKey)
        defaults?.removeObject(forKey: Self.authenticatedKey)
        defaults?.synchronize()
    }
}
