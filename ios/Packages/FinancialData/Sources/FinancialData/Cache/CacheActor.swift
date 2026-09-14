import Foundation

/// In-memory response cache (web parity: `clientCache.js` TTL = 1 hour).
public actor CacheActor {
    public static let defaultTTL: TimeInterval = 60 * 60

    private var storage: [String: CachedEntry] = [:]
    private let defaultTTL: TimeInterval

    public struct CachedEntry: Sendable {
        public let data: Data
        public let storedAt: Date
        public let ttl: TimeInterval

        public var isExpired: Bool {
            Date().timeIntervalSince(storedAt) > ttl
        }

        public var age: TimeInterval {
            Date().timeIntervalSince(storedAt)
        }
    }

    public init(defaultTTL: TimeInterval = CacheActor.defaultTTL) {
        self.defaultTTL = defaultTTL
    }

    public func set(_ data: Data, forKey key: String, ttl: TimeInterval? = nil) {
        storage[key] = CachedEntry(data: data, storedAt: Date(), ttl: ttl ?? defaultTTL)
    }

    public func get(_ key: String) -> Data? {
        guard let entry = storage[key], !entry.isExpired else {
            storage[key] = nil
            return nil
        }
        return entry.data
    }

    /// Returns cached bytes even if expired (for stale-while-revalidate).
    public func getStale(_ key: String) -> (data: Data, isFresh: Bool)? {
        guard let entry = storage[key] else { return nil }
        return (entry.data, !entry.isExpired)
    }

    public func remove(_ key: String) {
        storage[key] = nil
    }

    public func removeKeys(matching prefix: String) {
        for key in storage.keys where key.hasPrefix(prefix) {
            storage[key] = nil
        }
    }

    public func clear() {
        storage.removeAll()
    }
}
