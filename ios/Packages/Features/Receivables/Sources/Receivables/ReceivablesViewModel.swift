import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class ReceivablesViewModel {
    public private(set) var state: FeatureLoadState<[Receivable]> = .idle
    public private(set) var receivables: [Receivable] = []
    public var errorMessage: String?
    public var draftPerson = ""
    public var draftDescription = ""
    public var draftAmount = ""
    public var draftInstallments = "1"

    private let repository: (any ReceivablesRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any ReceivablesRepository)? = nil) {
        self.repository = repository
    }

    public var totalOpen: Money {
        receivables.filter { !$0.isReceived }.reduce(Money.zero) { $0.adding($1.amount) }
    }

    public var grouped: [(person: String, items: [Receivable])] {
        let groups = Dictionary(grouping: receivables) { $0.counterparty?.isEmpty == false ? $0.counterparty! : "Sem pessoa" }
        return groups
            .map { (person: $0.key, items: $0.value) }
            .sorted { $0.person.localizedCaseInsensitiveCompare($1.person) == .orderedAscending }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "receivables"
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
            receivables = try await repository.fetchReceivables(force: force)
            state = receivables.isEmpty ? .empty : .loaded(receivables)
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

    public func markReceived(_ receivable: Receivable) async {
        guard let repository else { return }
        var updated = receivable
        if updated.isContinuous {
            updated.paidInstallments += 1
        } else {
            updated.paidInstallments = min(updated.installments, updated.paidInstallments + 1)
            updated.isReceived = updated.paidInstallments >= updated.installments
        }
        do {
            try await repository.saveReceivable(updated)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func saveDraft() async {
        guard let repository else { return }
        let amount = Decimal(string: draftAmount.replacingOccurrences(of: ",", with: ".")) ?? 0
        let person = draftPerson.trimmingCharacters(in: .whitespacesAndNewlines)
        guard amount > 0, !person.isEmpty else {
            errorMessage = "Informe pessoa e valor."
            return
        }
        let item = Receivable(
            id: UUID().uuidString,
            description: draftDescription.isEmpty ? person : draftDescription,
            amount: Money(amount: amount),
            counterparty: person,
            installments: Int(draftInstallments) ?? 1
        )
        do {
            try await repository.saveReceivable(item)
            draftPerson = ""
            draftDescription = ""
            draftAmount = ""
            draftInstallments = "1"
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ receivable: Receivable) async {
        guard let repository else { return }
        do {
            try await repository.deleteReceivable(id: receivable.id)
        await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
