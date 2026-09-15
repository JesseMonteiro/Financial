import Foundation

/// Calendar month key (year + month), timezone-agnostic for bill/period logic.
public struct YearMonth: Sendable, Hashable, Codable, Comparable, CustomStringConvertible {
    public let year: Int
    public let month: Int

    public init(year: Int, month: Int) {
        precondition((1...12).contains(month), "month must be 1...12")
        self.year = year
        self.month = month
    }

    public init(from date: Date, calendar: Calendar = Calendar(identifier: .gregorian)) {
        var cal = calendar
        cal.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        let comps = cal.dateComponents([.year, .month], from: date)
        self.year = comps.year ?? 1970
        self.month = comps.month ?? 1
    }

    /// Parses `YYYY-MM`.
    public init?(key: String) {
        let parts = key.split(separator: "-")
        guard parts.count == 2,
              let y = Int(parts[0]),
              let m = Int(parts[1]),
              (1...12).contains(m) else { return nil }
        self.year = y
        self.month = m
    }

    public var key: String {
        String(format: "%04d-%02d", year, month)
    }

    public var description: String { key }

    public static func < (lhs: YearMonth, rhs: YearMonth) -> Bool {
        if lhs.year != rhs.year { return lhs.year < rhs.year }
        return lhs.month < rhs.month
    }

    public func adding(months: Int) -> YearMonth {
        let total = year * 12 + (month - 1) + months
        let y = total / 12
        let m = (total % 12) + 1
        return YearMonth(year: y, month: m)
    }

    public var previous: YearMonth { adding(months: -1) }
    public var next: YearMonth { adding(months: 1) }

    public func displayName(locale: Locale = Locale(identifier: "pt_BR")) -> String {
        guard let date = date() else { return key }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.setLocalizedDateFormatFromTemplate("MMMM yyyy")
        return formatter.string(from: date).capitalized(with: locale)
    }

    /// First day of the month in America/Sao_Paulo, for chart axes.
    public func date(calendar: Calendar = Calendar(identifier: .gregorian)) -> Date? {
        var cal = calendar
        cal.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = 1
        return cal.date(from: comps)
    }

    /// Compact Portuguese axis tick, e.g. `set/26`.
    public var shortAxisLabel: String {
        let months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
        let token = months[month - 1]
        return "\(token)/\(String(year).suffix(2))"
    }
}

/// Credit-card due/reference month (alias semantics for bill period).
public typealias DueMonth = YearMonth

/// Date-only value without time-of-day ambiguity for transaction dates.
public struct InstantDate: Sendable, Hashable, Codable, Comparable, CustomStringConvertible {
    public let year: Int
    public let month: Int
    public let day: Int

    public init(year: Int, month: Int, day: Int) {
        self.year = year
        self.month = month
        self.day = day
    }

    public init(from date: Date, calendar: Calendar = Calendar(identifier: .gregorian)) {
        var cal = calendar
        cal.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        let c = cal.dateComponents([.year, .month, .day], from: date)
        self.year = c.year ?? 1970
        self.month = c.month ?? 1
        self.day = c.day ?? 1
    }

    /// Parses `YYYY-MM-DD` or an ISO-8601 datetime such as `2026-09-15T00:00:00.000Z`.
    public init?(isoString: String) {
        let datePart = String(isoString.prefix(10))
        let parts = datePart.split(separator: "-")
        guard datePart.count == 10,
              parts.count == 3,
              let y = Int(parts[0]),
              let m = Int(parts[1]),
              let d = Int(parts[2]),
              (1...12).contains(m),
              (1...31).contains(d) else { return nil }
        self.year = y
        self.month = m
        self.day = d
    }

    public var isoString: String {
        String(format: "%04d-%02d-%02d", year, month, day)
    }

    public var description: String { isoString }

    public var yearMonth: YearMonth { YearMonth(year: year, month: month) }

    public static func < (lhs: InstantDate, rhs: InstantDate) -> Bool {
        if lhs.year != rhs.year { return lhs.year < rhs.year }
        if lhs.month != rhs.month { return lhs.month < rhs.month }
        return lhs.day < rhs.day
    }

    public func date(calendar: Calendar = Calendar(identifier: .gregorian)) -> Date? {
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = day
        return calendar.date(from: comps)
    }

    public func formatted(locale: Locale = Locale(identifier: "pt_BR"), template: String = "d MMM yyyy") -> String {
        guard let value = date() else { return isoString }
        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter.string(from: value)
    }
}
