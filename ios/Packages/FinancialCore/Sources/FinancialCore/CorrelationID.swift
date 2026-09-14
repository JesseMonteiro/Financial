import Foundation

public struct CorrelationID: Sendable, Hashable, CustomStringConvertible {
    public let value: String

    public init(_ value: String = UUID().uuidString.lowercased()) {
        self.value = value
    }

    public var description: String { value }

    public static func make() -> CorrelationID { CorrelationID() }
}
