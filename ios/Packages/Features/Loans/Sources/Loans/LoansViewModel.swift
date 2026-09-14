import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class LoansViewModel {
    public private(set) var state: FeatureLoadState<[Loan]> = .idle
    public private(set) var loans: [Loan] = []
    public var errorMessage: String?

    private let repository: (any LoansRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any LoansRepository)? = nil) {
        self.repository = repository
    }

    public var outstandingTotal: Money {
        loans.reduce(Money.zero) { $0.adding($1.outstandingBalance) }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "loans"
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
            loans = try await repository.fetchLoans(force: force)
            state = loans.isEmpty ? .empty : .loaded(loans)
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

    public func progress(for loan: Loan) -> Double {
        guard loan.principal.amount > 0 else { return 0 }
        let paid = loan.principal.amount - loan.outstandingBalance.amount
        return min(1, max(0, NSDecimalNumber(decimal: paid / loan.principal.amount).doubleValue))
    }
}
