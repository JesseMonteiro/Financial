import Foundation

public struct FeatureFlags: Sendable, Equatable {
    public var jointFinanceEnabled: Bool
    public var widgetsEnabled: Bool
    public var offlineQueueEnabled: Bool
    public var biometricLockEnabled: Bool
    public var debugLogging: Bool

    public init(
        jointFinanceEnabled: Bool = true,
        widgetsEnabled: Bool = true,
        offlineQueueEnabled: Bool = true,
        biometricLockEnabled: Bool = true,
        debugLogging: Bool = false
    ) {
        self.jointFinanceEnabled = jointFinanceEnabled
        self.widgetsEnabled = widgetsEnabled
        self.offlineQueueEnabled = offlineQueueEnabled
        self.biometricLockEnabled = biometricLockEnabled
        self.debugLogging = debugLogging
    }

    public static let `default` = FeatureFlags()
    public static let debug = FeatureFlags(debugLogging: true)
}

public protocol FeatureFlagProviding: Sendable {
    var flags: FeatureFlags { get }
}
