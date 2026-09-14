import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class SubscriptionsViewModel {
    public private(set) var state: FeatureLoadState<[Subscription]> = .idle
    public private(set) var subscriptions: [Subscription] = []
    public var errorMessage: String?

    private let repository: (any SubscriptionsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any SubscriptionsRepository)? = nil) {
        self.repository = repository
    }

    public var monthlyTotal: Money {
        subscriptions.reduce(Money.zero) { $0.adding($1.amount) }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "subscriptions"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) { return }
        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        guard let repository else {
        state = .empty
            return
        }
        do {
            subscriptions = try await repository.fetchSubscriptions(force: force)
            state = subscriptions.isEmpty ? .empty : .loaded(subscriptions)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar.")
            }
        }
    }

    public func retry() async { await load(force: true) }
}
