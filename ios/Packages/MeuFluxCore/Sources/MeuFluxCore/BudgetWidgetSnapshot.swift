import Foundation

public struct BudgetWidgetCategory: Codable, Sendable, Equatable, Hashable {
    public var name: String
    public var spentLabel: String
    public var limitLabel: String
    public var percent: Int
    public var isOver: Bool

    public init(name: String, spentLabel: String, limitLabel: String, percent: Int, isOver: Bool) {
        self.name = name
        self.spentLabel = spentLabel
        self.limitLabel = limitLabel
        self.percent = percent
        self.isOver = isOver
    }
}

/// Home-screen snapshot of the monthly budget.
/// Amounts are pre-formatted (pt-BR) so the widget never touches `Money`.
public struct BudgetWidgetSnapshot: Codable, Sendable, Equatable, Hashable {
    public var monthKey: String
    public var monthLabel: String
    public var spentLabel: String
    public var limitLabel: String
    public var remainingLabel: String
    public var remainingSubtitle: String
    public var utilizationPercent: Int
    public var isOverBudget: Bool
    public var hasLimits: Bool
    public var categoriesWithBudget: Int
    public var overBudgetCount: Int
    public var topCategories: [BudgetWidgetCategory]
    public var updatedAt: Date

    public init(
        monthKey: String,
        monthLabel: String,
        spentLabel: String,
        limitLabel: String,
        remainingLabel: String,
        remainingSubtitle: String,
        utilizationPercent: Int,
        isOverBudget: Bool,
        hasLimits: Bool,
        categoriesWithBudget: Int,
        overBudgetCount: Int,
        topCategories: [BudgetWidgetCategory],
        updatedAt: Date
    ) {
        self.monthKey = monthKey
        self.monthLabel = monthLabel
        self.spentLabel = spentLabel
        self.limitLabel = limitLabel
        self.remainingLabel = remainingLabel
        self.remainingSubtitle = remainingSubtitle
        self.utilizationPercent = utilizationPercent
        self.isOverBudget = isOverBudget
        self.hasLimits = hasLimits
        self.categoriesWithBudget = categoriesWithBudget
        self.overBudgetCount = overBudgetCount
        self.topCategories = topCategories
        self.updatedAt = updatedAt
    }

    public var overBudgetSubtitle: String {
        "de \(categoriesWithBudget) com limite"
    }

    public static let placeholder = BudgetWidgetSnapshot(
        monthKey: "2026-09",
        monthLabel: "Setembro 2026",
        spentLabel: "R$ —",
        limitLabel: "R$ —",
        remainingLabel: "R$ —",
        remainingSubtitle: "Defina metas nas categorias",
        utilizationPercent: 0,
        isOverBudget: false,
        hasLimits: false,
        categoriesWithBudget: 0,
        overBudgetCount: 0,
        topCategories: [],
        updatedAt: Date(timeIntervalSince1970: 0)
    )

    public static let preview = BudgetWidgetSnapshot(
        monthKey: "2026-09",
        monthLabel: "Setembro 2026",
        spentLabel: "R$ 3.200,00",
        limitLabel: "R$ 4.500,00",
        remainingLabel: "R$ 1.300,00",
        remainingSubtitle: "Dentro da verba",
        utilizationPercent: 71,
        isOverBudget: false,
        hasLimits: true,
        categoriesWithBudget: 4,
        overBudgetCount: 1,
        topCategories: [
            BudgetWidgetCategory(
                name: "Supermercado",
                spentLabel: "R$ 1.200,00",
                limitLabel: "R$ 1.000,00",
                percent: 120,
                isOver: true
            ),
            BudgetWidgetCategory(
                name: "Restaurantes",
                spentLabel: "R$ 680,00",
                limitLabel: "R$ 800,00",
                percent: 85,
                isOver: false
            ),
        ],
        updatedAt: Date()
    )
}

public struct BudgetWidgetStore: @unchecked Sendable {
    public static let snapshotKey = "budget.widget.snapshot"
    public static let authenticatedKey = "budget.widget.authenticated"

    private let defaults: UserDefaults?

    public init(defaults: UserDefaults? = UserDefaults(suiteName: AppGroup.identifier)) {
        self.defaults = defaults
    }

    public func save(_ snapshot: BudgetWidgetSnapshot) {
        guard let defaults else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: Self.snapshotKey)
        defaults.set(true, forKey: Self.authenticatedKey)
        defaults.synchronize()
    }

    public func load() -> BudgetWidgetSnapshot? {
        guard let defaults, let data = defaults.data(forKey: Self.snapshotKey) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(BudgetWidgetSnapshot.self, from: data)
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
