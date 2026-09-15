import Foundation
import MeuFluxDomain

public struct LiveAccountsRepository: AccountsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchAccounts(force: Bool) async throws -> [Account] {
        async let pluggy = bff.getAccounts(force: force)
        async let manuals = bff.getManualAccounts(force: force)
        async let profileTask = bff.getProfile(force: force)
        let names = (try? await profileTask)?.customAccountNames ?? [:]
        var accounts = try await pluggy.map(DomainMapper.account)
        accounts.append(contentsOf: try await manuals.map {
            DomainMapper.account(fromManual: DomainMapper.manualAccount($0))
        })
        if !names.isEmpty {
            accounts = accounts.map { account in
                guard let custom = names[account.id], !custom.isEmpty else { return account }
                var copy = account
                copy.name = custom
                return copy
            }
        }
        return accounts
    }

    public func fetchAccount(id: String) async throws -> Account {
        guard let account = try await fetchAccounts().first(where: { $0.id == id }) else {
            throw FinancialError.notFound(entity: "Account", id: id)
        }
        return account
    }

    public func renameAccount(id: String, name: String) async throws {
        let profile = try await bff.getProfile(force: true)
        var names = profile.customAccountNames ?? [:]
        names[id] = name
        _ = try await bff.patchProfile(["custom_account_names": names])
    }

    public func fetchManualAccounts(force: Bool) async throws -> [ManualAccount] {
        try await bff.getManualAccounts(force: force).map(DomainMapper.manualAccount)
    }

    public func saveManualAccount(_ account: ManualAccount) async throws {
        try await bff.saveManualAccount(account)
    }

    public func deleteManualAccount(id: String) async throws {
        try await bff.deleteManualAccount(id: id)
    }
}

public struct LiveTransactionsRepository: TransactionsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }
    public func fetchTransactions(accountId: String?, month: YearMonth?, force: Bool) async throws -> [Transaction] {
        var from: String?
        var to: String?
        if let month {
            from = "\(month.key)-01T00:00:00.000-03:00"
            let next = month.adding(months: 1)
            to = "\(next.key)-01T00:00:00.000-03:00"
        }
        return try await bff.getTransactions(accountId: accountId, from: from, to: to, force: force).map(DomainMapper.transaction)
    }

    public func fetchCategories(force: Bool) async throws -> [TransactionCategory] {
        try await bff.getCategories(force: force).map {
            TransactionCategory(
                id: $0.id,
                label: $0.descriptionTranslated?.isEmpty == false
                    ? $0.descriptionTranslated!
                    : LineItemDetail.translatedCategory($0.description),
                parentId: $0.parentId
            )
        }
    }

    public func updateCategory(id: String, categoryId: String) async throws {
        try await bff.patchTransactionCategory(id: id, categoryId: categoryId)
    }
}

public struct LiveBillsRepository: BillsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }
    public func fetchBills(accountId: String?, dueMonth: DueMonth?) async throws -> [Bill] {
        try await bff.getBills(accountId: accountId, dueMonth: dueMonth?.key).map(DomainMapper.bill)
    }
    public func markBillPaid(id: String, paid: Bool) async throws -> Bill {
        let bills = try await fetchBills(accountId: nil, dueMonth: nil)
        guard var bill = bills.first(where: { $0.id == id }) else {
            throw FinancialError.notFound(entity: "Bill", id: id)
        }
        bill.isPaid = paid
        bill.status = paid ? .paid : .open
        return bill
    }
}

public struct LiveInvestmentsRepository: InvestmentsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchInvestments(force: Bool) async throws -> [Investment] {
        try await bff.getInvestments(force: force).map(DomainMapper.investment)
    }

    public func fetchJointInvestments(force: Bool) async throws -> [Investment] {
        try await bff.getJointInvestments(force: force).map(DomainMapper.investment)
    }
}

public struct LiveLoansRepository: LoansRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }
    public func fetchLoans(force: Bool) async throws -> [Loan] {
        try await bff.getLoans(force: force).map(DomainMapper.loan)
    }
}

public struct LiveBudgetRepository: BudgetRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchLimits(month: YearMonth, force: Bool) async throws -> [BudgetLimit] {
        let screen = try await bff.getBudgetScreen(month: month, force: force)
        return screen.categories.map { DomainMapper.budgetLimit($0, month: month) }
    }

    public func saveLimit(_ limit: BudgetLimit) async throws {
        try await bff.saveBudget(
            category: limit.category,
            limit: limit.periodAmount.amount,
            period: limit.period
        )
    }

    public func deleteLimit(id: String, category: String) async throws {
        _ = category
        try await bff.deleteBudget(id: id)
    }
}

public struct LiveGoalsRepository: GoalsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }
    public func fetchGoals(force: Bool) async throws -> [Goal] {
        try await bff.getGoals(force: force).map(DomainMapper.goal)
    }
    public func saveGoal(_ goal: Goal) async throws {
        try await bff.saveGoal(goal)
    }
    public func deleteGoal(id: String) async throws {
        try await bff.deleteGoal(id: id)
    }
}

public struct LivePurchaseCategoriesRepository: PurchaseCategoriesRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchCategories(force: Bool) async throws -> [PurchaseCategory] {
        let rows = try await bff.getPurchaseCategories(force: force).map(DomainMapper.purchaseCategory)
        return PurchaseCategoryCatalog.sorted(rows)
    }

    public func saveCategory(_ category: PurchaseCategory) async throws {
        try await bff.savePurchaseCategory(category)
    }

    public func deleteCategory(id: String) async throws {
        try await bff.deletePurchaseCategory(id: id)
    }
}

public struct LiveMealBenefitsRepository: MealBenefitsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchBenefits(force: Bool) async throws -> [MealBenefit] {
        async let benefitRows = bff.getMealBenefits(force: force)
        async let purchaseRows = bff.getMealBenefitPurchases(force: force)
        let purchases = try await purchaseRows.map(DomainMapper.mealPurchase)
        let grouped = Dictionary(grouping: purchases, by: \.benefitId)
        return try await benefitRows.map { dto in
            DomainMapper.mealBenefit(dto, purchases: grouped[dto.id] ?? [])
        }
    }

    public func saveBenefit(_ benefit: MealBenefit) async throws {
        try await bff.saveMealBenefit(benefit)
    }

    public func deleteBenefit(id: String) async throws {
        try await bff.deleteMealBenefit(id: id)
    }

    public func savePurchase(_ purchase: MealBenefitPurchase) async throws {
        try await bff.saveMealBenefitPurchase(purchase)
    }

    public func deletePurchase(id: String) async throws {
        try await bff.deleteMealBenefitPurchase(id: id)
    }
}

public struct LiveReceivablesRepository: ReceivablesRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }
    public func fetchReceivables(force: Bool) async throws -> [Receivable] {
        try await bff.getReceivables(force: force).map(DomainMapper.receivable)
    }
    public func saveReceivable(_ receivable: Receivable) async throws {
        try await bff.saveReceivable(receivable)
    }
    public func deleteReceivable(id: String) async throws {
        try await bff.deleteReceivable(id: id)
    }
}

public struct LiveManualExpensesRepository: ManualExpensesRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchExpenses(month: YearMonth?, force: Bool) async throws -> [ManualExpense] {
        let all = try await bff.getManualExpenses(month: month?.key, force: force).map(DomainMapper.manualExpense)
        guard let month else { return all }
        return all.filter { $0.date.yearMonth == month }
    }

    public func createExpense(_ expense: ManualExpense) async throws -> ManualExpense {
        var payload = expense
        if payload.id.isEmpty { payload = withNewID(payload) }
        let saved = try await bff.saveManualExpense(payload)
        return DomainMapper.manualExpense(saved)
    }

    public func createExpenses(_ expenses: [ManualExpense]) async throws {
        for expense in expenses {
            _ = try await createExpense(expense)
        }
    }

    public func updateExpense(_ expense: ManualExpense) async throws {
        _ = try await bff.saveManualExpense(expense)
    }

    public func deleteExpense(id: String) async throws {
        try await bff.deleteManualExpense(id: id)
    }

    public func deleteExpenses(ids: [String]) async throws {
        for id in ids {
            try await bff.deleteManualExpense(id: id)
        }
    }

    private func withNewID(_ expense: ManualExpense) -> ManualExpense {
        ManualExpense(
            id: UUID().uuidString,
            description: expense.description,
            amount: expense.amount,
            date: expense.date,
            category: expense.category,
            accountId: expense.accountId,
            isPaid: expense.isPaid,
            isRecurring: expense.isRecurring,
            isContinuous: expense.isContinuous,
            parentId: expense.parentId,
            originalDescription: expense.originalDescription,
            frequency: expense.frequency,
            paidAt: expense.paidAt
        )
    }
}

public struct LiveJointFinanceRepository: JointFinanceRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchLink(force: Bool) async throws -> JointLink? {
        try await bff.getJointLink(force: force).map(DomainMapper.jointLink)
    }

    public func fetchMoment(month: YearMonth, force: Bool) async throws -> JointMomentSnapshot {
        let dto = try await bff.getJointMoment(month: month, force: force)
        return DomainMapper.jointMoment(dto)
    }

    public func saveMemberSalary(userId: String, month: YearMonth, amount: Money) async throws {
        try await bff.saveJointMemberSalary(userId: userId, month: month, amount: amount)
    }

    public func createInvite() async throws -> String {
        try await bff.createJointInvite()
    }

    public func acceptInvite(token: String) async throws {
        try await bff.acceptJointInvite(token: token)
    }

    public func unlink() async throws {
        try await bff.unlinkJoint()
    }
}

public struct LiveSubscriptionsRepository: SubscriptionsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchSubscriptions(force: Bool) async throws -> [Subscription] {
        let screen = try await bff.getSubscriptionsScreen(force: force)
        return screen.items.map(DomainMapper.subscription)
    }
}

public struct LiveAgendaRepository: AgendaRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchItems(month: YearMonth, force: Bool) async throws -> [AgendaItem] {
        let screen = try await bff.getAgenda(month: month, force: force)
        return screen.items.map(DomainMapper.agendaItem)
    }
}

public struct LiveProfileRepository: ProfileRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchProfile() async throws -> UserProfile {
        DomainMapper.profile(try await bff.getProfile())
    }

    public func updateProfile(_ patch: ProfilePatch) async throws {
        var fields: [String: Any] = [:]
        if let displayName = patch.displayName { fields["display_name"] = displayName }
        if let theme = patch.theme { fields["theme"] = theme }
        if let density = patch.density { fields["density"] = density }
        if let animations = patch.animationsEnabled { fields["animations_enabled"] = animations }
        if let names = patch.customAccountNames { fields["custom_account_names"] = names }
        if patch.clearTelegramChatId { fields["telegram_chat_id"] = NSNull() }
        guard !fields.isEmpty else { return }
        _ = try await bff.patchProfile(fields)
    }
}

public struct LiveSettingsRepository: SettingsRepository {
    private let bff: BFFClient

    public init(bff: BFFClient) {
        self.bff = bff
    }

    public func fetchSettings() async throws -> AppSettings {
        let profile = try? await bff.getProfile()
        let defaults = UserDefaults.standard
        return AppSettings(
            preferredLocale: "pt_BR",
            biometricLockEnabled: defaults.bool(forKey: "settings.biometricLock"),
            notificationsEnabled: defaults.object(forKey: "settings.notifications") as? Bool ?? true,
            theme: profile?.theme ?? "system",
            density: profile?.density ?? "comfortable",
            animationsEnabled: profile?.animationsEnabled ?? true,
            telegramLinked: !(profile?.telegramChatId ?? "").isEmpty
        )
    }

    public func saveSettings(_ settings: AppSettings) async throws {
        let defaults = UserDefaults.standard
        defaults.set(settings.biometricLockEnabled, forKey: "settings.biometricLock")
        defaults.set(settings.notificationsEnabled, forKey: "settings.notifications")
        _ = try await bff.patchProfile([
            "theme": settings.theme,
            "density": settings.density,
            "animations_enabled": settings.animationsEnabled,
        ])
    }

    public func createTelegramLinkToken() async throws -> String {
        try await bff.createTelegramLinkToken()
    }

    public func disconnectTelegram() async throws {
        _ = try await bff.patchProfile(["telegram_chat_id": NSNull()])
    }
}

public struct LiveBankConnectionsRepository: BankConnectionsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchItems(force: Bool) async throws -> [BankConnectionItem] {
        try await bff.getBankItems(force: force).map(DomainMapper.bankItem)
    }

    public func syncItem(id: String) async throws {
        try await bff.syncBankItem(id: id)
    }

    public func createConnectToken(itemId: String?) async throws -> String {
        try await bff.createConnectToken(itemId: itemId)
    }

    public func registerItem(id: String) async throws {
        try await bff.registerBankItem(id: id)
    }

    public func deleteItem(id: String) async throws {
        try await bff.deleteBankItem(id: id)
    }
}

public struct LiveSyncBankItem: SyncBankItemUseCase {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }
    public func execute(itemId: String) async throws {
        try await bff.syncBankItem(id: itemId)
    }
}

public struct LiveParseBill: ParseBillUseCase {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }
    public func execute(base64: String, mimeType: String) async throws -> ParsedBill {
        DomainMapper.parsedBill(try await bff.parseBill(base64: base64, mimeType: mimeType))
    }
}

public struct LiveReportsRepository: ReportsRepository {
    private let bff: BFFClient
    public init(bff: BFFClient) { self.bff = bff }

    public func fetchReport(months: Int, accountId: String?, force: Bool) async throws -> ReportsSnapshot {
        DomainMapper.reports(try await bff.getReports(months: months, accountId: accountId, force: force))
    }
}
