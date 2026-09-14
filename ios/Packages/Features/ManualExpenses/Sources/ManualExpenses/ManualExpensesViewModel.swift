import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class ManualExpensesViewModel {
    public private(set) var state: FeatureLoadState<[ManualExpense]> = .idle
    public private(set) var expenses: [ManualExpense] = []
    public private(set) var accounts: [Account] = []
    public var errorMessage: String?
    public var draftDescription = ""
    public var draftAmount = ""
    public var draftCategory = "Other"
    public var draftDate = Date()
    public var draftAccountId: String?
    public var draftRecurring = false

    private let repository: (any ManualExpensesRepository)?
    private let accountsRepository: (any AccountsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        repository: (any ManualExpensesRepository)? = nil,
        accounts: (any AccountsRepository)? = nil
    ) {
        self.repository = repository
        self.accountsRepository = accounts
    }

    public var unpaidTotal: Money {
        expenses.filter { !$0.isPaid }.reduce(Money.zero) { $0.adding($1.amount) }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "manuals"
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
            async let accountsTask = accountsRepository?.fetchAccounts(force: force) ?? []
            async let expensesTask = repository.fetchExpenses(month: nil, force: force)
            accounts = try await accountsTask
            expenses = try await expensesTask.sorted { $0.date > $1.date }
            state = expenses.isEmpty ? .empty : .loaded(expenses)
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
        let amount = Decimal(string: draftAmount.replacingOccurrences(of: ",", with: ".")) ?? 0
        let description = draftDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        guard amount > 0, !description.isEmpty else {
            errorMessage = "Informe descrição e valor."
            return
        }
        let expense = ManualExpense(
            id: UUID().uuidString,
            description: description,
            amount: Money(amount: amount),
            date: InstantDate(from: draftDate),
            category: draftCategory,
            accountId: draftAccountId,
            isRecurring: draftRecurring
        )
        do {
            _ = try await repository.createExpense(expense)
            draftDescription = ""
            draftAmount = ""
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func togglePaid(_ expense: ManualExpense) async {
        guard let repository else { return }
        var updated = expense
        updated.isPaid.toggle()
        do {
            try await repository.updateExpense(updated)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ expense: ManualExpense) async {
        guard let repository else { return }
        do {
            try await repository.deleteExpense(id: expense.id)
        await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
