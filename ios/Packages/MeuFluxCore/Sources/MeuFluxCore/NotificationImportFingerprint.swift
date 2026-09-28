import Foundation
import CryptoKit
import MeuFluxDomain

public enum NotificationImportFingerprint {
    public static let duplicateWindow: TimeInterval = 48 * 60 * 60

    public static func make(
        source: NotificationImportSource,
        amount: Decimal,
        merchant: String?,
        day: InstantDate,
        body: String
    ) -> String {
        let merchantKey = (merchant ?? "").notificationImportNormalizedMerchant
        let bodyKey = String(body.notificationImportFolded.prefix(80))
        let amountKey = NSDecimalNumber(decimal: amount).stringValue
        let canonical = "\(source.rawValue)|\(amountKey)|\(merchantKey)|\(day.isoString)|\(bodyKey)"
        let digest = SHA256.hash(data: Data(canonical.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
