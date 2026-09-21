import Foundation

public enum FeatureLoadState<Value: Sendable>: Sendable {
    case idle
    case loading
    case loaded(Value)
    case empty
    case failed(String)

    public var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }

    /// True when the screen already has content to keep on screen (web silent refresh).
    public var hasContent: Bool {
        if case .loaded = self { return true }
        return false
    }

    /// Discrete stage used for animating state changes without requiring Equatable on Value.
    public var stage: FeatureLoadStage {
        switch self {
        case .idle: return .idle
        case .loading: return .loading
        case .loaded: return .loaded
        case .empty: return .empty
        case .failed: return .failed
        }
    }

    /// Enter loading only when there is nothing to show yet.
    public mutating func beginLoad(silentIfPossible: Bool = true) {
        if silentIfPossible && hasContent { return }
        self = .loading
    }
}

public enum FeatureLoadStage: Equatable, Hashable, Sendable {
    case idle
    case loading
    case loaded
    case empty
    case failed
}

/// Mirrors web `CACHE_TTL_MS` / `isFreshTimestamp` in `clientCache.js`.
public enum ScreenCachePolicy {
    public static let ttl: TimeInterval = 60 * 60

    public static func isFresh(_ timestamp: Date?, ttl: TimeInterval = ttl) -> Bool {
        guard let timestamp else { return false }
        return Date().timeIntervalSince(timestamp) < ttl
    }

    /// Skip network when the same cache key was loaded recently.
    public static func shouldSkipReload(
        force: Bool,
        lastLoadedAt: Date?,
        lastCacheKey: String?,
        cacheKey: String,
        ttl: TimeInterval = ttl
    ) -> Bool {
        guard !force else { return false }
        guard lastCacheKey == cacheKey else { return false }
        return isFresh(lastLoadedAt, ttl: ttl)
    }
}
