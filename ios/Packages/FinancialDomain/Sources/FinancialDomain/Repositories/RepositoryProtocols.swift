import Foundation

public protocol AccountsRepository: Sendable {
    func fetchAccounts(force: Bool) async throws -> [Account]
    func fetchAccount(id: String) async throws -> Account
    func renameAccount(id: String, name: String) async throws
    func fetchManualAccounts(force: Bool) async throws -> [ManualAccount]
    func saveManualAccount(_ account: ManualAccount) async throws
    func deleteManualAccount(id: String) async throws
}

public extension AccountsRepository {
    func fetchAccounts() async throws -> [Account] {
        try await fetchAccounts(force: false)
    }

    func renameAccount(id: String, name: String) async throws {}

    func fetchManualAccounts(force: Bool) async throws -> [ManualAccount] {
        _ = force
        return []
    }

    func saveManualAccount(_ account: ManualAccount) async throws {}

    func deleteManualAccount(id: String) async throws {}
}

public protocol TransactionsRepository: Sendable {
    func fetchTransactions(accountId: String?, month: YearMonth?, force: Bool) async throws -> [Transaction]
}

public extension TransactionsRepository {
    func fetchTransactions(accountId: String?, month: YearMonth?) async throws -> [Transaction] {
        try await fetchTransactions(accountId: accountId, month: month, force: false)
    }
}

public protocol BillsRepository: Sendable {
    func fetchBills(accountId: String?, dueMonth: DueMonth?) async throws -> [Bill]
    func markBillPaid(id: String, paid: Bool) async throws -> Bill
}

public protocol InvestmentsRepository: Sendable {
    func fetchInvestments(force: Bool) async throws -> [Investment]
    func fetchJointInvestments(force: Bool) async throws -> [Investment]
}

public extension InvestmentsRepository {
    func fetchInvestments() async throws -> [Investment] {
        try await fetchInvestments(force: false)
    }

    func fetchJointInvestments() async throws -> [Investment] {
        try await fetchJointInvestments(force: false)
    }
}

public protocol LoansRepository: Sendable {
    func fetchLoans(force: Bool) async throws -> [Loan]
}

public extension LoansRepository {
    func fetchLoans() async throws -> [Loan] {
        try await fetchLoans(force: false)
    }
}

public protocol BudgetRepository: Sendable {
    func fetchLimits(month: YearMonth, force: Bool) async throws -> [BudgetLimit]
    func saveLimit(_ limit: BudgetLimit) async throws
    func deleteLimit(id: String, category: String) async throws
}

public extension BudgetRepository {
    func fetchLimits(month: YearMonth) async throws -> [BudgetLimit] {
        try await fetchLimits(month: month, force: false)
    }
}

public protocol GoalsRepository: Sendable {
    func fetchGoals(force: Bool) async throws -> [Goal]
    func saveGoal(_ goal: Goal) async throws
    func deleteGoal(id: String) async throws
}

public extension GoalsRepository {
    func fetchGoals() async throws -> [Goal] {
        try await fetchGoals(force: false)
    }
}

public protocol ReceivablesRepository: Sendable {
    func fetchReceivables(force: Bool) async throws -> [Receivable]
    func saveReceivable(_ receivable: Receivable) async throws
    func deleteReceivable(id: String) async throws
}

public extension ReceivablesRepository {
    func fetchReceivables() async throws -> [Receivable] {
        try await fetchReceivables(force: false)
    }
}

public protocol ManualExpensesRepository: Sendable {
    func fetchExpenses(month: YearMonth?, force: Bool) async throws -> [ManualExpense]
    func createExpense(_ expense: ManualExpense) async throws -> ManualExpense
    func createExpenses(_ expenses: [ManualExpense]) async throws
    func updateExpense(_ expense: ManualExpense) async throws
    func deleteExpense(id: String) async throws
    func deleteExpenses(ids: [String]) async throws
}

public extension ManualExpensesRepository {
    func fetchExpenses(month: YearMonth?) async throws -> [ManualExpense] {
        try await fetchExpenses(month: month, force: false)
    }

    func createExpenses(_ expenses: [ManualExpense]) async throws {
        for expense in expenses {
            _ = try await createExpense(expense)
        }
    }

    func deleteExpenses(ids: [String]) async throws {
        for id in ids {
            try await deleteExpense(id: id)
        }
    }
}

public protocol JointFinanceRepository: Sendable {
    func fetchLink(force: Bool) async throws -> JointLink?
    func fetchMoment(month: YearMonth, force: Bool) async throws -> JointMomentSnapshot
    func saveMemberSalary(userId: String, month: YearMonth, amount: Money) async throws
    func createInvite() async throws -> String
    func acceptInvite(token: String) async throws
    func unlink() async throws
}

public extension JointFinanceRepository {
    func fetchLink() async throws -> JointLink? {
        try await fetchLink(force: false)
    }

    func fetchMoment(month: YearMonth) async throws -> JointMomentSnapshot {
        try await fetchMoment(month: month, force: false)
    }
}

public protocol SubscriptionsRepository: Sendable {
    func fetchSubscriptions(force: Bool) async throws -> [Subscription]
}

public extension SubscriptionsRepository {
    func fetchSubscriptions() async throws -> [Subscription] {
        try await fetchSubscriptions(force: false)
    }
}

public protocol AgendaRepository: Sendable {
    func fetchItems(month: YearMonth, force: Bool) async throws -> [AgendaItem]
}

public extension AgendaRepository {
    func fetchItems(month: YearMonth) async throws -> [AgendaItem] {
        try await fetchItems(month: month, force: false)
    }
}

public protocol ProfileRepository: Sendable {
    func fetchProfile() async throws -> UserProfile
    func updateDisplayName(_ name: String) async throws
    func updateProfile(_ patch: ProfilePatch) async throws
}

public extension ProfileRepository {
    func updateDisplayName(_ name: String) async throws {
        try await updateProfile(ProfilePatch(displayName: name))
    }

    func updateProfile(_ patch: ProfilePatch) async throws {}
}

public protocol SettingsRepository: Sendable {
    func fetchSettings() async throws -> AppSettings
    func saveSettings(_ settings: AppSettings) async throws
    func createTelegramLinkToken() async throws -> String
    func disconnectTelegram() async throws
}

public extension SettingsRepository {
    func createTelegramLinkToken() async throws -> String { "" }
    func disconnectTelegram() async throws {}
}

public protocol BankConnectionsRepository: Sendable {
    func fetchItems(force: Bool) async throws -> [BankConnectionItem]
    func syncItem(id: String) async throws
    func createConnectToken(itemId: String?) async throws -> String
    func registerItem(id: String) async throws
    func deleteItem(id: String) async throws
}

public extension BankConnectionsRepository {
    func fetchItems() async throws -> [BankConnectionItem] {
        try await fetchItems(force: false)
    }

    func createConnectToken(itemId: String?) async throws -> String { "" }
    func registerItem(id: String) async throws {}
    func deleteItem(id: String) async throws {}
}

public struct BankConnectionItem: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var institutionName: String
    public var status: String
    public var executionStatus: String?
    public var lastSyncAt: Date?

    public init(
        id: String,
        institutionName: String,
        status: String,
        executionStatus: String? = nil,
        lastSyncAt: Date? = nil
    ) {
        self.id = id
        self.institutionName = institutionName
        self.status = status
        self.executionStatus = executionStatus
        self.lastSyncAt = lastSyncAt
    }
}
