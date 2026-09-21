import Foundation
import UserNotifications
import MeuFluxCore

/// Registers for remote push notifications (APNs). Wiring to token upload is stubbed.
@MainActor
public final class PushRegistration: NSObject {
    private let logger: AppLogger

    public init(logger: AppLogger = AppLogger()) {
        self.logger = logger
        super.init()
    }

    public func requestAuthorization() async -> Bool {
        do {
            let center = UNUserNotificationCenter.current()
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            logger.info("Push authorization: \(granted)", category: .general)
            return granted
        } catch {
            logger.error("Push auth failed: \(error.localizedDescription)", category: .general)
            return false
        }
    }

    public func handleDeviceToken(_ token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        logger.info("APNs device token received (\(hex.prefix(8))…)", category: .general)
        // TODO: POST /v1/devices with token
    }
}

