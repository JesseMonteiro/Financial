import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class AgendaViewModel {
    public enum Filter: String, CaseIterable, Identifiable {
        case all = "Todos"
        case unpaid = "Em aberto"
        case overdue = "Atrasados"
        case paid = "Pagos"
        public var id: String { rawValue }
    }

    public private(set) var state: FeatureLoadState<[AgendaItem]> = .idle
    public private(set) var items: [AgendaItem] = []
    public var selectedMonth: YearMonth = YearMonth(from: Date())
    public var filter: Filter = .all
    public var errorMessage: String?

    private let repository: (any AgendaRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any AgendaRepository)? = nil) {
        self.repository = repository
    }

    public var filtered: [AgendaItem] {
        let today = InstantDate(from: Date())
        switch filter {
        case .all: return items
        case .unpaid: return items.filter { !$0.isCompleted }
        case .overdue: return items.filter { !$0.isCompleted && $0.date < today }
        case .paid: return items.filter(\.isCompleted)
        }
    }

    public var openTotal: Money {
        items.filter { !$0.isCompleted }.compactMap(\.amount).reduce(Money.zero) { $0.adding($1) }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "agenda:\(selectedMonth.key)"
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
            items = try await repository.fetchItems(month: selectedMonth, force: force)
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
}
