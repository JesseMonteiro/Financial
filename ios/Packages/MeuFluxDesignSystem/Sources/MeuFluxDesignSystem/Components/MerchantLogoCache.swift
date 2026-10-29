import SwiftUI

public struct StoredMerchantLogo: Sendable, Equatable {
    public let name: String
    public let url: URL

    public init(name: String, url: URL) {
        self.name = name
        self.url = url
    }
}

public struct MerchantLogoResolution: Sendable {
    public enum Status: Sendable {
        case found
        case miss
        case pending
    }

    public var status: Status
    public var name: String?
    public var url: URL?

    public init(status: Status, name: String? = nil, url: URL? = nil) {
        self.status = status
        self.name = name
        self.url = url
    }
}

/// Batches logo.dev cache lookups. The app installs `resolver` once at launch.
@MainActor
@Observable
public final class MerchantLogoCache {
    public static let shared = MerchantLogoCache()

    public var resolver: (@Sendable ([String]) async throws -> [String: MerchantLogoResolution])?
    public private(set) var logos: [String: StoredMerchantLogo] = [:]

    private var misses: Set<String> = []
    private var queued: Set<String> = []
    private var pending: [String] = []
    private var flushTask: Task<Void, Never>?

    public func logo(for text: String?) -> StoredMerchantLogo? {
        guard let key = MerchantLogoCatalog.lookupKey(text: text) else { return nil }
        return logos[key]
    }

    public func note(text: String?) {
        guard let key = MerchantLogoCatalog.lookupKey(text: text) else { return }
        if logos[key] != nil || misses.contains(key) || queued.contains(key) { return }
        queued.insert(key)
        pending.append(key)
        flushTask?.cancel()
        flushTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 80_000_000)
            guard !Task.isCancelled else { return }
            await self?.flush()
        }
    }

    private func flush() async {
        guard let resolver else { return }
        let batch = Array(pending.prefix(40))
        guard !batch.isEmpty else { return }
        pending.removeFirst(batch.count)
        let resolved: [String: MerchantLogoResolution]
        do {
            resolved = try await resolver(batch)
        } catch {
            for key in batch { queued.remove(key) }
            return
        }
        for key in batch {
            queued.remove(key)
            switch resolved[key]?.status {
            case .found:
                if let url = resolved[key]?.url {
                    logos[key] = StoredMerchantLogo(name: resolved[key]?.name ?? key, url: url)
                }
            case .miss:
                misses.insert(key)
            case .pending, .none:
                break
            }
        }
        if !pending.isEmpty {
            await flush()
        }
    }
}

public struct PurchaseMerchantMark<Fallback: View>: View {
    private let text: String?
    private let size: CGFloat
    private let fallback: Fallback

    public init(text: String?, size: CGFloat = 36, @ViewBuilder fallback: () -> Fallback) {
        self.text = text
        self.size = size
        self.fallback = fallback()
    }

    public var body: some View {
        let match = MerchantLogoCatalog.match(text: text)
        Group {
            if let match {
                MerchantLogoView(entry: match, size: size)
            } else if let logo = MerchantLogoCache.shared.logo(for: text) {
                RemoteMerchantLogoMark(logo: logo, size: size, fallback: fallback)
            } else {
                fallback
            }
        }
        .onAppear { MerchantLogoCache.shared.note(text: text) }
    }
}

private struct RemoteMerchantLogoMark<Fallback: View>: View {
    let logo: StoredMerchantLogo
    let size: CGFloat
    let fallback: Fallback

    var body: some View {
        AsyncImage(url: logo.url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFit()
                    .frame(width: size * 0.72, height: size * 0.72)
                    .clipShape(Circle())
                    .frame(width: size, height: size)
                    .background(MeuFluxColors.bgTertiary, in: Circle())
            case .failure:
                fallback
            default:
                fallback.opacity(0.45)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
