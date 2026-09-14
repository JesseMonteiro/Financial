import Foundation
import Observation
import FinancialCore
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class JointFinanceViewModel {
    public enum ScreenState: Equatable {
        case idle
        case loading
        case inactive
        case loaded(JointMomentSnapshot)
        case failed(String)

        var hasContent: Bool {
            if case .loaded = self { return true }
            return false
        }

        mutating func beginLoad(silentIfPossible: Bool = true) {
            if silentIfPossible && hasContent { return }
            self = .loading
        }
    }

    public private(set) var state: ScreenState = .idle
    public private(set) var selectedMonth: YearMonth
    public let monthOptions: [YearMonth]
    public var salaryInputs: [String: String] = [:]
    public var savingMemberIds: Set<String> = []
    public var pendingManualIds: Set<String> = []
    public var errorMessage: String?

    private let repository: any JointFinanceRepository
    private let investmentsRepository: (any InvestmentsRepository)?
    private let toggleManualExpensePaid: any ToggleManualExpensePaidUseCase
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public var showJointInvestments = false
    public private(set) var jointInvestments: [Investment] = []

    public init(
        repository: any JointFinanceRepository,
        investments: (any InvestmentsRepository)? = nil,
        toggleManualExpensePaid: any ToggleManualExpensePaidUseCase = StubToggleManualExpensePaid()
    ) {
        self.repository = repository
        self.investmentsRepository = investments
        self.toggleManualExpensePaid = toggleManualExpensePaid
        let current = YearMonth(from: Date())
        self.monthOptions = (-6...5).map { current.adding(months: $0) }
        self.selectedMonth = current
    }

    public var selectedMonthIndex: Int {
        monthOptions.firstIndex(of: selectedMonth) ?? 6
    }

    public func load(force: Bool = false) async {
        let cacheKey = "joint:\(selectedMonth.key)"
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
        do {
            let link = try await repository.fetchLink(force: force)
            guard let link, link.isActive else {
                state = .inactive
                lastLoadedAt = Date()
                lastCacheKey = cacheKey
                return
            }
            let snapshot = try await repository.fetchMoment(month: selectedMonth, force: force)
            syncSalaryInputs(from: snapshot)
            if showJointInvestments, let investmentsRepository {
                jointInvestments = (try? await investmentsRepository.fetchJointInvestments(force: force)) ?? []
            }
            state = .loaded(snapshot)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            if let appError = error as? AppError {
                errorMessage = appError.localizedDescriptionPT
            } else {
                errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            }
            if !state.hasContent {
                state = .failed(errorMessage ?? "Erro")
            }
        }
    }

    public func retry() async { await load(force: true) }

    public func selectMonth(at index: Int) {
        guard monthOptions.indices.contains(index) else { return }
        let month = monthOptions[index]
        guard month != selectedMonth else { return }
        selectedMonth = month
    }

    public func selectCurrentMonth() {
        let current = YearMonth(from: Date())
        guard let index = monthOptions.firstIndex(of: current) else { return }
        selectMonth(at: index)
    }

    public func saveSalary(for memberId: String) async {
        guard case .loaded(let snap) = state else { return }
        guard let member = snap.members.first(where: { $0.id == memberId }) else { return }
        let raw = salaryInputs[memberId] ?? ""
        let normalized = raw.replacingOccurrences(of: ",", with: ".")
        let amount = Money(amount: Decimal(string: normalized) ?? member.salary.amount)
        savingMemberIds.insert(memberId)
        defer { savingMemberIds.remove(memberId) }
        do {
            try await repository.saveMemberSalary(userId: memberId, month: selectedMonth, amount: amount)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func toggleManualPaid(expenseId: String, isPaid: Bool) async {
        guard case .loaded(var snap) = state else { return }
        pendingManualIds.insert(expenseId)
        defer { pendingManualIds.remove(expenseId) }

        var items = snap.detail.manualExpenses.items
        if let idx = items.firstIndex(where: { $0.id == expenseId }) {
            items[idx].isPaid = isPaid
            snap.detail.manualExpenses = ManualExpensesSummary(
                items: items,
                total: snap.detail.manualExpenses.total
            )
            state = .loaded(snap)
        }

        do {
            try await toggleManualExpensePaid.execute(expenseId: expenseId, isPaid: isPaid)
        } catch {
            await load()
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func loadJointInvestments() async {
        guard let investmentsRepository else { return }
        showJointInvestments = true
        jointInvestments = (try? await investmentsRepository.fetchJointInvestments(force: true)) ?? []
    }

    private func syncSalaryInputs(from snapshot: JointMomentSnapshot) {
        var next: [String: String] = [:]
        for member in snapshot.members {
            next[member.id] = NSDecimalNumber(decimal: member.salary.amount).stringValue
        }
        salaryInputs = next
    }
}
