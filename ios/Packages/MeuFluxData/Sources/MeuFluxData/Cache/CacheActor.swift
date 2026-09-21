import Foundation

/// In-memory & disk-backed response cache (web parity: `clientCache.js` TTL = 1 hour).
public actor CacheActor {
    public static let defaultTTL: TimeInterval = 60 * 60

    private var storage: [String: CachedEntry] = [:]
    private let defaultTTL: TimeInterval
    private let diskDirectoryURL: URL?

    public struct CachedEntry: Codable, Sendable {
        public let data: Data
        public let storedAt: Date
        public let ttl: TimeInterval

        public var isExpired: Bool {
            Date().timeIntervalSince(storedAt) > ttl
        }

        public var age: TimeInterval {
            Date().timeIntervalSince(storedAt)
        }

        public init(data: Data, storedAt: Date = Date(), ttl: TimeInterval) {
            self.data = data
            self.storedAt = storedAt
            self.ttl = ttl
        }
    }

    public init(
        defaultTTL: TimeInterval = CacheActor.defaultTTL,
        diskDirectoryURL: URL? = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.appendingPathComponent("MeuFluxBFFCache")
    ) {
        self.defaultTTL = defaultTTL
        self.diskDirectoryURL = diskDirectoryURL
        if let diskDirectoryURL {
            try? FileManager.default.createDirectory(at: diskDirectoryURL, withIntermediateDirectories: true)
        }
    }

    private func sanitize(key: String) -> String {
        key.replacingOccurrences(of: ":", with: "_")
           .replacingOccurrences(of: "/", with: "_")
           .replacingOccurrences(of: "?", with: "_")
           .replacingOccurrences(of: "&", with: "_")
           .replacingOccurrences(of: "=", with: "_")
    }

    private func fileURL(for key: String) -> URL? {
        diskDirectoryURL?.appendingPathComponent("\(sanitize(key: key)).cache")
    }

    public func set(_ data: Data, forKey key: String, ttl: TimeInterval? = nil) {
        let entry = CachedEntry(data: data, storedAt: Date(), ttl: ttl ?? defaultTTL)
        storage[key] = entry

        if let url = fileURL(for: key) {
            let encoder = PropertyListEncoder()
            if let encoded = try? encoder.encode(entry) {
                try? encoded.write(to: url, options: .atomic)
            }
        }
    }

    public func get(_ key: String) -> Data? {
        if let entry = storage[key] {
            if !entry.isExpired {
                return entry.data
            } else {
                storage[key] = nil
                if let url = fileURL(for: key) {
                    try? FileManager.default.removeItem(at: url)
                }
                return nil
            }
        }

        // Try reading from disk
        if let url = fileURL(for: key),
           let raw = try? Data(contentsOf: url),
           let entry = try? PropertyListDecoder().decode(CachedEntry.self, from: raw) {
            if !entry.isExpired {
                storage[key] = entry
                return entry.data
            } else {
                try? FileManager.default.removeItem(at: url)
                return nil
            }
        }

        return nil
    }

    /// Returns cached bytes even if expired (for stale-while-revalidate).
    public func getStale(_ key: String) -> (data: Data, isFresh: Bool)? {
        if let entry = storage[key] {
            return (entry.data, !entry.isExpired)
        }
        if let url = fileURL(for: key),
           let raw = try? Data(contentsOf: url),
           let entry = try? PropertyListDecoder().decode(CachedEntry.self, from: raw) {
            storage[key] = entry
            return (entry.data, !entry.isExpired)
        }
        return nil
    }

    public func remove(_ key: String) {
        storage[key] = nil
        if let url = fileURL(for: key) {
            try? FileManager.default.removeItem(at: url)
        }
    }

    public func removeKeys(matching prefix: String) {
        for key in storage.keys where key.hasPrefix(prefix) {
            storage[key] = nil
            if let url = fileURL(for: key) {
                try? FileManager.default.removeItem(at: url)
            }
        }

        // Also clean files matching prefix on disk
        if let diskDirectoryURL,
           let files = try? FileManager.default.contentsOfDirectory(atPath: diskDirectoryURL.path) {
            let sanitizedPrefix = sanitize(key: prefix)
            for file in files where file.hasPrefix(sanitizedPrefix) && file.hasSuffix(".cache") {
                let fileURL = diskDirectoryURL.appendingPathComponent(file)
                try? FileManager.default.removeItem(at: fileURL)
            }
        }
    }

    public func clear() {
        storage.removeAll()
        if let diskDirectoryURL,
           let files = try? FileManager.default.contentsOfDirectory(atPath: diskDirectoryURL.path) {
            for file in files where file.hasSuffix(".cache") {
                let fileURL = diskDirectoryURL.appendingPathComponent(file)
                try? FileManager.default.removeItem(at: fileURL)
            }
        }
    }
}
