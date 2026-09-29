import Foundation
import MeuFluxCore
import MeuFluxDomain

public struct SyncStatusItem: Codable, Sendable, Identifiable {
    public var id: String { pluggyItemId }
    public let pluggyItemId: String
    public let connectorName: String?
    public let status: String?
    public let executionStatus: String?
    public let errorMessage: String?
    public let lastSyncedAt: String?
    public let ageMs: Int?

    public var parsedLastSyncedAt: Date? {
        guard let lastSyncedAt else { return nil }
        return ISO8601DateFormatter().date(from: lastSyncedAt)
    }

    public var freshness: SyncFreshness {
        SyncFreshness.classify(parsedLastSyncedAt)
    }
}

public struct SyncStatusResponse: Codable, Sendable {
    public let items: [SyncStatusItem]
    public let globalLastSyncedAt: String?
    public let itemCount: Int?

    public init(items: [SyncStatusItem] = [], globalLastSyncedAt: String? = nil, itemCount: Int? = 0) {
        self.items = items
        self.globalLastSyncedAt = globalLastSyncedAt
        self.itemCount = itemCount
    }

    public var parsedGlobalLastSyncedAt: Date? {
        guard let globalLastSyncedAt else { return nil }
        return ISO8601DateFormatter().date(from: globalLastSyncedAt)
    }

    public var freshness: SyncFreshness {
        SyncFreshness.classify(parsedGlobalLastSyncedAt)
    }
}
