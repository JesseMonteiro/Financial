import Foundation

public enum MealBenefitKind: String, Sendable, Codable, Hashable, CaseIterable {
    case va = "VA"
    case vr = "VR"

    public var title: String {
        switch self {
        case .va: return "Vale Alimentação"
        case .vr: return "Vale Refeição"
        }
    }

    public var defaultBudgetCategory: String {
        switch self {
        case .va: return "Supermercado & Alimentação"
        case .vr: return "Restaurantes & Bares"
        }
    }

    public static let budgetCategoryOptions = [
        "Supermercado & Alimentação",
        "Restaurantes & Bares",
        "Delivery de Comida",
    ]
}

public struct MealBenefitPurchase: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var benefitId: String
    public var amount: Money
    public var purchasedAt: InstantDate
    public var description: String
    public var category: String

    public init(
        id: String,
        benefitId: String,
        amount: Money,
        purchasedAt: InstantDate,
        description: String,
        category: String = ""
    ) {
        self.id = id
        self.benefitId = benefitId
        self.amount = amount
        self.purchasedAt = purchasedAt
        self.description = description
        self.category = category
    }
}

public struct MealBenefit: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var kind: MealBenefitKind
    public var label: String
    public var monthlyAmount: Money
    public var creditDay: Int
    public var startsOn: InstantDate
    public var openingBalance: Money
    public var showInMoment: Bool
    public var purchases: [MealBenefitPurchase]

    public init(
        id: String,
        kind: MealBenefitKind,
        label: String,
        monthlyAmount: Money,
        creditDay: Int,
        startsOn: InstantDate,
        openingBalance: Money = .zero,
        showInMoment: Bool = false,
        purchases: [MealBenefitPurchase] = []
    ) {
        self.id = id
        self.kind = kind
        self.label = label
        self.monthlyAmount = monthlyAmount
        self.creditDay = min(31, max(1, creditDay))
        self.startsOn = startsOn
        self.openingBalance = openingBalance
        self.showInMoment = showInMoment
        self.purchases = purchases
    }

    public var displayLabel: String {
        let trimmed = label.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? kind.title : trimmed
    }
}

public struct MealBenefitMonthSnapshot: Sendable, Hashable {
    public var remaining: Money
    public var monthCredit: Money
    public var monthSpent: Money
    public var creditDay: Int
    public var nextCredit: InstantDate?

    public init(
        remaining: Money,
        monthCredit: Money,
        monthSpent: Money,
        creditDay: Int,
        nextCredit: InstantDate? = nil
    ) {
        self.remaining = remaining
        self.monthCredit = monthCredit
        self.monthSpent = monthSpent
        self.creditDay = creditDay
        self.nextCredit = nextCredit
    }
}

public enum MealBenefitBalance {
    public static func remaining(benefit: MealBenefit, asOf: InstantDate) -> Money {
        let credits = creditDates(startsOn: benefit.startsOn, creditDay: benefit.creditDay, asOf: asOf).count
        let spent = benefit.purchases
            .filter { $0.purchasedAt <= asOf }
            .reduce(Decimal.zero) { $0 + $1.amount.amount }
        let total = benefit.openingBalance.amount
            + benefit.monthlyAmount.amount * Decimal(credits)
            - spent
        return Money(amount: total)
    }

    public static func monthSnapshot(benefit: MealBenefit, yearMonth: YearMonth, today: InstantDate = InstantDate(from: Date())) -> MealBenefitMonthSnapshot {
        let asOf = asOfForMonth(yearMonth, today: today)
        let creditDate = creditDateIn(year: yearMonth.year, month: yearMonth.month, creditDay: benefit.creditDay)
        let monthCredit: Decimal
        if creditDate >= benefit.startsOn && creditDate <= asOf {
            monthCredit = benefit.monthlyAmount.amount
        } else {
            monthCredit = 0
        }
        let prefix = yearMonth.key
        let spent = benefit.purchases
            .filter { $0.purchasedAt.isoString.hasPrefix(prefix) }
            .reduce(Decimal.zero) { $0 + $1.amount.amount }
        return MealBenefitMonthSnapshot(
            remaining: remaining(benefit: benefit, asOf: asOf),
            monthCredit: Money(amount: monthCredit),
            monthSpent: Money(amount: spent),
            creditDay: benefit.creditDay,
            nextCredit: nextCreditDate(benefit: benefit, from: today)
        )
    }

    public static func nextCreditDate(benefit: MealBenefit, from: InstantDate) -> InstantDate? {
        var ym = YearMonth(year: from.year, month: from.month)
        for _ in 0..<24 {
            let iso = creditDateIn(year: ym.year, month: ym.month, creditDay: benefit.creditDay)
            if iso >= benefit.startsOn && iso > from { return iso }
            ym = ym.next
        }
        return nil
    }

    private static func asOfForMonth(_ ym: YearMonth, today: InstantDate) -> InstantDate {
        let todayYm = YearMonth(year: today.year, month: today.month)
        if ym < todayYm {
            return lastDay(of: ym)
        }
        return today
    }

    private static func lastDay(of ym: YearMonth) -> InstantDate {
        InstantDate(year: ym.year, month: ym.month, day: daysInMonth(year: ym.year, month: ym.month))
    }

    private static func daysInMonth(year: Int, month: Int) -> Int {
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = 1
        let cal = Calendar(identifier: .gregorian)
        guard let date = cal.date(from: comps),
              let range = cal.range(of: .day, in: .month, for: date) else { return 28 }
        return range.count
    }

    private static func creditDateIn(year: Int, month: Int, creditDay: Int) -> InstantDate {
        let last = daysInMonth(year: year, month: month)
        let day = min(max(1, creditDay), last)
        return InstantDate(year: year, month: month, day: day)
    }

    private static func creditDates(startsOn: InstantDate, creditDay: Int, asOf: InstantDate) -> [InstantDate] {
        var dates: [InstantDate] = []
        var ym = YearMonth(year: startsOn.year, month: startsOn.month)
        let end = YearMonth(year: asOf.year, month: asOf.month)
        while ym <= end {
            let iso = creditDateIn(year: ym.year, month: ym.month, creditDay: creditDay)
            if iso >= startsOn && iso <= asOf { dates.append(iso) }
            ym = ym.next
        }
        return dates
    }
}

public struct MealBenefitMomentItem: Sendable, Hashable, Identifiable {
    public var id: String
    public var kind: MealBenefitKind
    public var label: String
    public var remaining: Money
    public var monthCredit: Money
    public var monthSpent: Money
    public var creditDay: Int
    public var ownerLabel: String?

    public init(
        id: String,
        kind: MealBenefitKind,
        label: String,
        remaining: Money,
        monthCredit: Money,
        monthSpent: Money,
        creditDay: Int,
        ownerLabel: String? = nil
    ) {
        self.id = id
        self.kind = kind
        self.label = label
        self.remaining = remaining
        self.monthCredit = monthCredit
        self.monthSpent = monthSpent
        self.creditDay = creditDay
        self.ownerLabel = ownerLabel
    }
}

public struct MealBenefitsSummary: Sendable, Hashable {
    public var items: [MealBenefitMomentItem]

    public init(items: [MealBenefitMomentItem] = []) {
        self.items = items
    }

    public var isEmpty: Bool { items.isEmpty }

    public static let empty = MealBenefitsSummary()
}
