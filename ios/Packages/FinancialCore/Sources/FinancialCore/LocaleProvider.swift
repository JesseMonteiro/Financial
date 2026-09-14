import Foundation

public protocol LocaleProviding: Sendable {
    var locale: Locale { get }
    var timeZone: TimeZone { get }
    var currencyCode: String { get }
}

public struct LocaleProvider: LocaleProviding {
    public let locale: Locale
    public let timeZone: TimeZone
    public let currencyCode: String

    public init(
        locale: Locale = Locale(identifier: "pt_BR"),
        timeZone: TimeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current,
        currencyCode: String = "BRL"
    ) {
        self.locale = locale
        self.timeZone = timeZone
        self.currencyCode = currencyCode
    }

    public static let brazil = LocaleProvider()
}
