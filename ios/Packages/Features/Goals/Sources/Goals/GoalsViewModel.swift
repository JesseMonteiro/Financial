import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class GoalsViewModel {
    public private(set) var state: FeatureLoadState<[Goal]> = .idle
    public private(set) var goals: [Goal] = []
    public var errorMessage: String?
    public var draftName = ""
    public var draftTarget = ""
    public var draftCurrent = ""
    public var draftDeadline = Date().addingTimeInterval(86_400 * 180)

    private let repository: (any GoalsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any GoalsRepository)? = nil) {
        self.repository = repository
    }

    public func load(force: Bool = false) async {
        let cacheKey = "goals"
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
            goals = try await repository.fetchGoals(force: force)
            state = goals.isEmpty ? .empty : .loaded(goals)
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

    public func saveDraft() async {
        guard let repository else { return }
        let name = draftName.trimmingCharacters(in: .whitespacesAndNewlines)
        let target = Decimal(string: draftTarget.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard !name.isEmpty, target > 0 else {
            errorMessage = "Informe nome e valor da meta."
            return
        }
        let current = Decimal(string: draftCurrent.replacingOccurrences(of: ",", with: ".")) ?? 0
        let goal = Goal(
            id: UUID().uuidString,
            name: name,
            target: Money(amount: target),
            current: Money(amount: current),
            deadline: InstantDate(from: draftDeadline)
        )
        do {
            try await repository.saveGoal(goal)
            draftName = ""
            draftTarget = ""
            draftCurrent = ""
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ goal: Goal) async {
        guard let repository else { return }
        do {
            try await repository.deleteGoal(id: goal.id)
        await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
