import Foundation
#if canImport(ActivityKit) && os(iOS)
import ActivityKit

public struct PurchaseImportAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable, Sendable {
        public var merchant: String
        public var amount: String
        public var category: String
        public var status: ActivityStatus

        public enum ActivityStatus: String, Codable, Hashable, Sendable {
            case pending
            case saved
            case dismissed
        }

        public init(merchant: String, amount: String, category: String, status: ActivityStatus = .pending) {
            self.merchant = merchant
            self.amount = amount
            self.category = category
            self.status = status
        }
    }

    public var recordId: String
    public var source: String
    public var timestamp: Date

    public init(recordId: String, source: String, timestamp: Date = Date()) {
        self.recordId = recordId
        self.source = source
        self.timestamp = timestamp
    }
}
#endif
