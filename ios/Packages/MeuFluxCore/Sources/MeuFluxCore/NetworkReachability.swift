import Foundation

public enum NetworkStatus: Sendable, Equatable {
    case online
    case offline
    case unknown
}

public protocol NetworkReachability: Sendable {
    var status: NetworkStatus { get async }
    var isOnline: Bool { get async }
}

public struct AlwaysOnlineReachability: NetworkReachability {
    public init() {}
    public var status: NetworkStatus { get async { .online } }
    public var isOnline: Bool { get async { true } }
}
