import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class BankConnectionsViewModel {
    public private(set) var state: FeatureLoadState<[BankConnectionItem]> = .idle
    public private(set) var items: [BankConnectionItem] = []
    public var errorMessage: String?
    public var connectToken: String?
    public var isConnecting = false
    public var syncingIDs: Set<String> = []

    private let repository: (any BankConnectionsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any BankConnectionsRepository)? = nil) {
        self.repository = repository
    }

    public func load(force: Bool = false) async {
        let cacheKey = "bank-items"
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
            items = try await repository.fetchItems(force: force)
            state = items.isEmpty ? .empty : .loaded(items)
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

    public func startConnect() async {
        guard let repository else { return }
        isConnecting = true
        errorMessage = nil
        do {
            connectToken = try await repository.createConnectToken(itemId: nil)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            isConnecting = false
        }
    }

    public func finishConnect(itemId: String?) async {
        defer {
            connectToken = nil
            isConnecting = false
        }
        guard let itemId, let repository else { return }
        do {
            try await repository.registerItem(id: itemId)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func sync(_ item: BankConnectionItem) async {
        guard let repository else { return }
        syncingIDs.insert(item.id)
        defer { syncingIDs.remove(item.id) }
        do {
            try await repository.syncItem(id: item.id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ item: BankConnectionItem) async {
        guard let repository else { return }
        do {
            try await repository.deleteItem(id: item.id)
        await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
