import Foundation

/// Monetary amount stored as Decimal (never Double). Default currency BRL.
public struct Money: Sendable, Hashable, Codable, Comparable {
    public let amount: Decimal
    public let currencyCode: String

    public init(amount: Decimal, currencyCode: String = "BRL") {
        self.amount = amount
        self.currencyCode = currencyCode
    }

    public init(string: String, currencyCode: String = "BRL") {
        self.amount = Decimal(string: string) ?? .zero
        self.currencyCode = currencyCode
    }

    public static let zero = Money(amount: .zero)

    public static func < (lhs: Money, rhs: Money) -> Bool {
        lhs.amount < rhs.amount
    }

    public func adding(_ other: Money) -> Money {
        Money(amount: amount + other.amount, currencyCode: currencyCode)
    }

    public func subtracting(_ other: Money) -> Money {
        Money(amount: amount - other.amount, currencyCode: currencyCode)
    }

    public var isNegative: Bool { amount < 0 }
    public var isZero: Bool { amount == 0 }

    public func formatted(locale: Locale = Locale(identifier: "pt_BR")) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        formatter.locale = locale
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }
}

public extension Decimal {
    /// Convenience for BRL money literals from string to avoid Double.
    var asBRL: Money { Money(amount: self, currencyCode: "BRL") }
}
