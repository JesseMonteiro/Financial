import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class InvestmentsViewModel {
    public enum Scope: String, CaseIterable, Identifiable {
        case personal = "Pessoal"
        case joint = "Conjunto"
        public var id: String { rawValue }
    }

    public private(set) var state: FeatureLoadState<[Investment]> = .idle
    public private(set) var investments: [Investment] = []
    public var scope: Scope = .personal
    public var errorMessage: String?

    private let repository: (any InvestmentsRepository)?
    private let jointRepository: (any JointFinanceRepository)?
    public let hasJointLink: Bool
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        repository: (any InvestmentsRepository)? = nil,
        jointRepository: (any JointFinanceRepository)? = nil,
        hasJointLink: Bool = false
    ) {
        self.repository = repository
        self.jointRepository = jointRepository
        self.hasJointLink = hasJointLink
    }

    public var total: Money {
        investments.reduce(Money.zero) { $0.adding($1.balance) }
    }

    public var allocation: [(type: String, amount: Money)] {
        var map: [String: Decimal] = [:]
        for inv in investments {
            map[inv.type, default: 0] += inv.balance.amount
        }
        return map
            .map { (type: $0.key, amount: Money(amount: $0.value)) }
            .sorted { $0.amount.amount > $1.amount.amount }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "investments:\(scope.rawValue)"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) {
            return
        }
        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        guard let repository else {
        state = .empty
            return
        }
        do {
            let loaded: [Investment]
            if scope == .joint, hasJointLink {
                loaded = try await repository.fetchJointInvestments(force: force)
            } else {
                loaded = try await repository.fetchInvestments(force: force)
            }
            investments = loaded.sorted { $0.balance.amount > $1.balance.amount }
            state = investments.isEmpty ? .empty : .loaded(investments)
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
