import Foundation

public protocol Clock: Sendable {
    func now() -> Date
}

public struct SystemClock: Clock {
    public init() {}
    public func now() -> Date { Date() }
}

public struct FixedClock: Clock {
    private let date: Date
    public init(_ date: Date) { self.date = date }
    public func now() -> Date { date }
}
