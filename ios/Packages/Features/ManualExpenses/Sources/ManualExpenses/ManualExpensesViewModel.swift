import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

public enum ManualExpenseCategory: String, CaseIterable, Identifiable, Sendable {
    case food = "Food"
    case groceries = "Groceries"
    case rent = "Rent"
    case utilities = "Utilities"
    case transport = "Transport"
    case entertainment = "Entertainment"
    case health = "Health"
    case education = "Education"
    case other = "Other"

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .food: return "Alimentação"
        case .groceries: return "Supermercado"
        case .rent: return "Aluguel / Habitação"
        case .utilities: return "Contas de Consumo (Água, Luz)"
        case .transport: return "Transporte"
        case .entertainment: return "Lazer / Entretenimento"
        case .health: return "Saúde"
        case .education: return "Educação"
        case .other: return "Outros"
        }
    }

    public var tint: ColorToken {
        switch self {
        case .food, .groceries: return .orange
        case .rent, .utilities: return .purple
        case .transport: return .sky
        case .entertainment: return .pink
        case .health: return .green
        case .education: return .yellow
        case .other: return .slate
        }
    }

    public static func label(for raw: String?) -> String {
        guard let raw, let match = ManualExpenseCategory(rawValue: raw) else {
            return raw?.isEmpty == false ? raw! : "Outros"
        }
        return match.label
    }
}

/// Lightweight color keys resolved in the view layer.
public enum ColorToken: Sendable {
    case orange, purple, sky, pink, green, yellow, slate, primary
}

public enum ManualFrequency: String, CaseIterable, Identifiable, Sendable {
    case weekly
    case monthly
    case yearly

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .weekly: return "Semanal"
        case .monthly: return "Mensal"
        case .yearly: return "Anual"
        }
    }
}

public struct ManualExpenseGroup: Identifiable, Hashable, Sendable {
    public let id: String
    public var description: String
    public var category: String?
    public var startDate: InstantDate
    public var isRecurring: Bool
    public var isContinuous: Bool
    public var installments: [ManualExpense]

    public var installmentsCount: Int { installments.count }
    public var paidCount: Int { installments.filter(\.isPaid).count }
    public var isSeries: Bool { installmentsCount > 1 || isRecurring }

    public var displayAmount: Money {
        installments.first?.amount ?? .zero
    }

    public var hasVariedAmounts: Bool {
        guard let first = installments.first?.amount.amount else { return false }
        return installments.contains { abs($0.amount.amount - first) > Decimal(string: "0.001")! }
    }

    public var sample: ManualExpense? { installments.first }

    public var totalForEdit: Money {
        if isRecurring && !isContinuous && installmentsCount > 1 {
            return installments.reduce(Money.zero) { $0.adding($1.amount) }
        }
        return displayAmount
    }
}

@Observable
@MainActor
public final class ManualExpensesViewModel {
    public private(set) var state: FeatureLoadState<[ManualExpense]> = .idle
    public private(set) var expenses: [ManualExpense] = []
    public private(set) var groups: [ManualExpenseGroup] = []
    public private(set) var accounts: [Account] = []
    public private(set) var isSaving = false
    public var errorMessage: String?
    public var expandedGroupIDs: Set<String> = []
    public var pendingDelete: ManualExpenseGroup?
    public var editingAmountID: String?
    public var editingAmountDraft = ""

    // Draft form
    public var draftDescription = ""
    public var draftAmount = ""
    public var draftCategory: ManualExpenseCategory = .food
    public var draftDate = Date()
    public var draftAccountId: String? = nil
    public var draftRecurring = false
    public var draftContinuous = false
    public var draftFrequency: ManualFrequency = .monthly
    public var draftOccurrences = "12"
    public var editingGroupID: String?

    private let repository: (any ManualExpensesRepository)?
    private let accountsRepository: (any AccountsRepository)?
    private let togglePaid: (any ToggleManualExpensePaidUseCase)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public var unpaidTotal: Money {
        expenses.filter { !$0.isPaid }.reduce(Money.zero) { $0.adding($1.amount) }
    }

    public var manualAccounts: [Account] {
        accounts.filter(\.isManual)
    }

    public var splitPreview: (count: Int, per: Money, last: Money, lastDiffers: Bool)? {
        guard draftRecurring, !draftContinuous else { return nil }
        let total = parseMoney(draftAmount)
        let count = max(1, Int(draftOccurrences) ?? 12)
        guard count > 1, total > 0 else { return nil }
        let parts = splitTotal(total, count: count)
        let per = Money(amount: parts[0])
        let last = Money(amount: parts[parts.count - 1])
        return (count, per, last, abs(parts[0] - parts[parts.count - 1]) > Decimal(string: "0.001")!)
    }

    public init(
        repository: (any ManualExpensesRepository)? = nil,
        accounts: (any AccountsRepository)? = nil,
        togglePaid: (any ToggleManualExpensePaidUseCase)? = nil
    ) {
        self.repository = repository
        self.accountsRepository = accounts
        self.togglePaid = togglePaid
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
            expenses = try await expensesTask
            rebuildGroups()
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

    public func toggleExpanded(_ groupID: String) {
        if expandedGroupIDs.contains(groupID) {
            expandedGroupIDs.remove(groupID)
        } else {
            expandedGroupIDs.insert(groupID)
        }
    }

    public func resetDraft() {
        editingGroupID = nil
        draftDescription = ""
        draftAmount = ""
        draftCategory = .food
        draftDate = Date()
        draftAccountId = nil
        draftRecurring = false
        draftContinuous = false
        draftFrequency = .monthly
        draftOccurrences = "12"
    }

    public func beginEdit(_ group: ManualExpenseGroup) {
        guard let sample = group.sample else { return }
        editingGroupID = group.id
        draftDescription = group.description
        draftAmount = NSDecimalNumber(decimal: group.totalForEdit.amount).stringValue
        draftCategory = ManualExpenseCategory(rawValue: group.category ?? "") ?? .other
        if let date = group.startDate.date() {
            draftDate = date
        }
        draftAccountId = sample.accountId
        draftRecurring = group.isRecurring || group.installmentsCount > 1
        draftContinuous = group.isContinuous
        draftFrequency = ManualFrequency(rawValue: sample.frequency ?? "monthly") ?? .monthly
        draftOccurrences = String(group.isContinuous ? 24 : max(group.installmentsCount, 1))
    }

    public func saveDraft() async -> Bool {
        guard let repository else { return false }
        let description = draftDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let total = parseMoney(draftAmount)
        guard !description.isEmpty, total > 0 else {
            errorMessage = "Informe descrição e valor."
            return false
        }

        isSaving = true
        defer { isSaving = false }

        do {
            if let editingGroupID,
               let group = groups.first(where: { $0.id == editingGroupID }) {
                try await repository.deleteExpenses(ids: group.installments.map(\.id))
            }

            let rows = buildSeries(
                description: description,
                total: total,
                category: draftCategory.rawValue,
                start: InstantDate(from: draftDate),
                accountId: draftAccountId,
                isRecurring: draftRecurring,
                isContinuous: draftRecurring && draftContinuous,
                frequency: draftFrequency.rawValue,
                occurrences: max(1, Int(draftOccurrences) ?? 12),
                preservePaid: editingGroupID.flatMap { id in groups.first(where: { $0.id == id })?.installments }
            )
            try await repository.createExpenses(rows)
            resetDraft()
            await load(force: true)
            return true
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            return false
        }
    }

    public func setPaid(_ expense: ManualExpense, isPaid: Bool) async {
        do {
            if let togglePaid {
                try await togglePaid.execute(expenseId: expense.id, isPaid: isPaid)
            } else if let repository {
                var updated = expense
                updated.isPaid = isPaid
                updated.paidAt = isPaid ? InstantDate(from: Date()) : nil
                try await repository.updateExpense(updated)
            }
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func beginAmountEdit(_ expense: ManualExpense) {
        editingAmountID = expense.id
        editingAmountDraft = NSDecimalNumber(decimal: expense.amount.amount).stringValue
    }

    public func cancelAmountEdit() {
        editingAmountID = nil
        editingAmountDraft = ""
    }

    public func saveAmountEdit() async {
        guard let repository,
              let id = editingAmountID,
              var expense = expenses.first(where: { $0.id == id }) else { return }
        let amount = parseMoney(editingAmountDraft)
        guard amount >= 0 else { return }
        expense.amount = Money(amount: amount)
        do {
            try await repository.updateExpense(expense)
            cancelAmountEdit()
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func deleteGroup(_ group: ManualExpenseGroup) async {
        guard let repository else { return }
        do {
            try await repository.deleteExpenses(ids: group.installments.map(\.id))
            pendingDelete = nil
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    // MARK: - Private

    private func rebuildGroups() {
        var map: [String: ManualExpenseGroup] = [:]
        for expense in expenses {
            let key = expense.groupKey
            if var existing = map[key] {
                existing.installments.append(expense)
                if expense.date < existing.startDate {
                    existing.startDate = expense.date
                }
                existing.isRecurring = existing.isRecurring || expense.isRecurring
                existing.isContinuous = existing.isContinuous || expense.isContinuous
                map[key] = existing
            } else {
                map[key] = ManualExpenseGroup(
                    id: key,
                    description: expense.baseDescription,
                    category: expense.category,
                    startDate: expense.date,
                    isRecurring: expense.isRecurring,
                    isContinuous: expense.isContinuous,
                    installments: [expense]
                )
            }
        }
        groups = map.values
            .map { group in
                var copy = group
                copy.installments.sort { $0.date < $1.date }
                return copy
            }
            .sorted { $0.startDate > $1.startDate }
    }

    private func buildSeries(
        description: String,
        total: Decimal,
        category: String,
        start: InstantDate,
        accountId: String?,
        isRecurring: Bool,
        isContinuous: Bool,
        frequency: String,
        occurrences: Int,
        preservePaid: [ManualExpense]?
    ) -> [ManualExpense] {
        let count = isRecurring ? (isContinuous ? 24 : max(1, occurrences)) : 1
        let amounts = isRecurring && !isContinuous && count > 1
            ? splitTotal(total, count: count)
            : Array(repeating: total, count: count)
        let parentId = isRecurring ? UUID().uuidString : nil
        let paidByDay = (preservePaid ?? []).reduce(into: [String: ManualExpense]()) { dict, item in
            guard item.isPaid else { return }
            dict[item.date.isoString] = item
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        let baseDate = start.date(calendar: calendar) ?? Date()

        return (0..<count).map { index in
            var date = baseDate
            if isRecurring {
                switch frequency {
                case "weekly":
                    date = calendar.date(byAdding: .day, value: index * 7, to: baseDate) ?? baseDate
                case "yearly":
                    date = calendar.date(byAdding: .year, value: index, to: baseDate) ?? baseDate
                default:
                    date = calendar.date(byAdding: .month, value: index, to: baseDate) ?? baseDate
                }
            }
            let instant = InstantDate(from: date, calendar: calendar)
            let paid = paidByDay[instant.isoString]
            let suffix: String
            if isRecurring {
                suffix = isContinuous ? " (Recorrente)" : " (\(index + 1)/\(count))"
            } else {
                suffix = ""
            }
            return ManualExpense(
                id: UUID().uuidString,
                description: "\(description)\(suffix)",
                amount: Money(amount: amounts[index]),
                date: instant,
                category: category,
                accountId: accountId,
                isPaid: paid?.isPaid ?? false,
                isRecurring: isRecurring,
                isContinuous: isContinuous,
                parentId: parentId,
                originalDescription: description,
                frequency: isRecurring ? frequency : nil,
                paidAt: paid?.paidAt
            )
        }
    }

    private func splitTotal(_ total: Decimal, count: Int) -> [Decimal] {
        let per = roundMoney(total / Decimal(count))
        var parts = Array(repeating: per, count: count)
        parts[count - 1] = roundMoney(total - per * Decimal(count - 1))
        return parts
    }

    private func roundMoney(_ value: Decimal) -> Decimal {
        var value = value
        var result = Decimal()
        NSDecimalRound(&result, &value, 2, .plain)
        return result
    }

    private func parseMoney(_ raw: String) -> Decimal {
        Decimal(string: raw.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")) ?? 0
    }
}
