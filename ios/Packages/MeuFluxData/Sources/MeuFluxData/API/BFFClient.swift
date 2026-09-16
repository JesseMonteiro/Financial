import Foundation
import MeuFluxCore
import MeuFluxDomain

/// Talks to the existing Edge Function using the same legacy paths as the web app.
/// Response caching mirrors web `cachedFetch` / `CACHE_TTL_MS` (1 hour).
public struct BFFClient: Sendable {
    private let api: APIClientProtocol
    private let cache: CacheActor?

    public init(api: APIClientProtocol, cache: CacheActor? = nil) {
        self.api = api
        self.cache = cache
    }

    // MARK: - Cache helpers

    private func cachedRaw(
        _ key: String,
        force: Bool = false,
        _ request: APIRequest
    ) async throws -> Data {
        if !force, let cache, let hit = await cache.get(key) {
            return hit
        }
        let data = try await api.sendRaw(request)
        if let cache {
            await cache.set(data, forKey: key)
        }
        return data
    }

    private func decode<T: Decodable & Sendable>(_ type: T.Type, from data: Data) async throws -> T {
        try await Task.detached(priority: .userInitiated) {
            let decoder = JSONDecoder()
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw AppError.decodingFailed(String(describing: error))
            }
        }.value
    }

    public func invalidateCaches(matching prefixes: [String]) async {
        guard let cache else { return }
        for prefix in prefixes {
            await cache.removeKeys(matching: prefix)
        }
    }

    // MARK: - Accounts / transactions / bills

    public func getAccounts(force: Bool = false) async throws -> [PluggyAccountDTO] {
        let key = "bff:accounts"
        let data = try await cachedRaw(key, force: force, APIRequest(path: "accounts"))
        let list = try await decode(PluggyListDTO<PluggyAccountDTO>.self, from: data)
        return list.results
    }

    public func getTransactions(
        accountId: String? = nil,
        from: String? = nil,
        to: String? = nil,
        force: Bool = false
    ) async throws -> [PluggyTransactionDTO] {
        var items: [URLQueryItem] = []
        if let accountId { items.append(URLQueryItem(name: "accountId", value: accountId)) }
        if let from { items.append(URLQueryItem(name: "from", value: from)) }
        if let to { items.append(URLQueryItem(name: "to", value: to)) }
        let key = "bff:transactions:\(accountId ?? "all"):\(from ?? ""):\(to ?? "")"
        let data = try await cachedRaw(
            key,
            force: force,
            APIRequest(path: "transactions", queryItems: items)
        )
        let list = try await decode(PluggyListDTO<PluggyTransactionDTO>.self, from: data)
        return list.results
    }

    public func getCategories(force: Bool = false) async throws -> [PluggyCategoryDTO] {
        let data = try await cachedRaw("bff:categories", force: force, APIRequest(path: "categories"))
        let list = try await decode(PluggyListDTO<PluggyCategoryDTO>.self, from: data)
        return list.results
    }

    public func patchTransactionCategory(id: String, categoryId: String) async throws {
        let payload = try JSONSerialization.data(withJSONObject: ["categoryId": categoryId])
        _ = try await api.sendRaw(APIRequest(path: "transactions/\(id)", method: .patch, body: payload))
        await invalidateCaches(matching: [
            "bff:transactions:",
            "bff:dashboard:",
            "bff:financial-moment:",
            "bff:joint:",
            "bff:credit-cards",
            "bff:agenda:",
            "bff:budget-screen:",
            "bff:reports:",
        ])
    }

    public func getBills(accountId: String? = nil, dueMonth: String? = nil, force: Bool = false) async throws -> [PluggyBillDTO] {
        var items: [URLQueryItem] = []
        if let accountId { items.append(URLQueryItem(name: "accountId", value: accountId)) }
        if let dueMonth { items.append(URLQueryItem(name: "dueMonth", value: dueMonth)) }
        let key = "bff:bills:\(accountId ?? "all"):\(dueMonth ?? "")"
        let data = try await cachedRaw(
            key,
            force: force,
            APIRequest(path: "bills", queryItems: items)
        )
        let list = try await decode(PluggyListDTO<PluggyBillDTO>.self, from: data)
        return list.results
    }

    func getInvestments(force: Bool = false) async throws -> [PluggyInvestmentDTO] {
        let data = try await cachedRaw("bff:investments", force: force, APIRequest(path: "investments"))
        let list = try await decode(PluggyListDTO<PluggyInvestmentDTO>.self, from: data)
        return list.results
    }

    func getJointInvestments(force: Bool = false) async throws -> [PluggyInvestmentDTO] {
        let data = try await cachedRaw("bff:joint:investments", force: force, APIRequest(path: "joint/investments"))
        let decoded = try await decode(JointInvestmentsDTO.self, from: data)
        return decoded.investments
    }

    func getLoans(force: Bool = false) async throws -> [PluggyLoanDTO] {
        let data = try await cachedRaw("bff:loans", force: force, APIRequest(path: "loans"))
        let list = try await decode(PluggyListDTO<PluggyLoanDTO>.self, from: data)
        return list.results
    }

    public func getJointLink(force: Bool = false) async throws -> JointLinkDTO? {
        let key = "bff:joint:status"
        let data = try await cachedRaw(key, force: force, APIRequest(path: "joint/status"))
        let response = try await decode(JointStatusResponseDTO.self, from: data)
        return response.link
    }

    public func getJointMoment(month: YearMonth, force: Bool = false) async throws -> JointMomentDTO {
        let request = APIRequest(
            path: "joint/financial-moment",
            queryItems: [URLQueryItem(name: "month", value: month.key)]
        )
        let data = try await cachedRaw("bff:joint:moment:\(month.key)", force: force, request)
        return try await decode(JointMomentDTO.self, from: data)
    }

    public func saveJointMemberSalary(userId: String, month: YearMonth, amount: Money) async throws {
        struct Body: Encodable {
            let userId: String
            let month: String
            let amount: Double
        }
        let encoder = JSONEncoder()
        let body = try encoder.encode(Body(
            userId: userId,
            month: month.key,
            amount: NSDecimalNumber(decimal: amount.amount).doubleValue
        ))
        _ = try await api.sendRaw(APIRequest(path: "joint/member-salary", method: .post, body: body))
        await invalidateCaches(matching: ["bff:joint:", "bff:dashboard:", "bff:financial-moment:"])
    }

    public func createJointInvite() async throws -> String {
        let response = try await api.send(
            APIRequest(path: "joint/invite", method: .post, body: Data("{}".utf8)),
            as: JointInviteResponseDTO.self
        )
        guard let token = response.token, !token.isEmpty else {
            throw AppError.unknown("Convite sem token")
        }
        await invalidateCaches(matching: ["bff:joint:"])
        return token
    }

    public func acceptJointInvite(token: String) async throws {
        struct Body: Encodable { let token: String }
        let body = try JSONEncoder().encode(Body(token: token))
        let response = try await api.send(
            APIRequest(path: "joint/accept", method: .post, body: body),
            as: JointAcceptResponseDTO.self
        )
        if response.success == false {
            throw AppError.unknown(response.message ?? "Falha ao aceitar convite")
        }
        await invalidateCaches(matching: ["bff:joint:", "bff:dashboard:", "bff:financial-moment:"])
    }

    public func unlinkJoint() async throws {
        _ = try await api.sendRaw(APIRequest(path: "joint/unlink", method: .delete))
        await invalidateCaches(matching: ["bff:joint:", "bff:dashboard:", "bff:financial-moment:"])
    }

    func getBankItems(force: Bool = false) async throws -> [PluggyItemDTO] {
        let data = try await cachedRaw("bff:items", force: force, APIRequest(path: "items"))
        let list = try await decode(PluggyListDTO<PluggyItemDTO>.self, from: data)
        return list.results
    }

    public func createConnectToken(itemId: String? = nil) async throws -> String {
        let body = try JSONEncoder().encode(ConnectTokenBody(itemId: itemId))
        let dto = try await api.send(
            APIRequest(path: "items/connect-token", method: .post, body: body),
            as: ConnectTokenDTO.self
        )
        guard let token = dto.accessToken, !token.isEmpty else {
            throw AppError.unknown("Token de conexão vazio")
        }
        return token
    }

    public func registerBankItem(id: String) async throws {
        let body = try JSONEncoder().encode(RegisterItemBody(itemId: id))
        _ = try await api.sendRaw(APIRequest(path: "items/register", method: .post, body: body))
        await invalidateCaches(matching: ["bff:"])
    }

    public func deleteBankItem(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "items/\(id)", method: .delete))
        await invalidateCaches(matching: ["bff:"])
    }

    func parseBill(base64: String, mimeType: String) async throws -> ParsedBillDTO {
        let body = try JSONEncoder().encode(ParseBillBody(base64: base64, mimeType: mimeType))
        return try await api.send(
            APIRequest(path: "parse-bill", method: .post, body: body),
            as: ParsedBillDTO.self
        )
    }

    public func createTelegramLinkToken() async throws -> String {
        let dto = try await api.send(
            APIRequest(path: "chatbot/telegram/link-token", method: .post, body: Data("{}".utf8)),
            as: TelegramLinkTokenDTO.self
        )
        guard let token = dto.token, !token.isEmpty else {
            throw AppError.unknown("Token do Telegram vazio")
        }
        return token
    }

    public func getCreditCardsScreen(force: Bool = false) async throws -> CreditCardsScreenDTO {
        let data = try await cachedRaw("bff:credit-cards", force: force, APIRequest(path: "credit-cards"))
        return try await decode(CreditCardsScreenDTO.self, from: data)
    }

    // MARK: - Dashboard

    public func getDashboard(month: YearMonth, force: Bool = false) async throws -> DashboardDTO {
        let request = APIRequest(
            path: "dashboard",
            queryItems: [URLQueryItem(name: "month", value: month.key)]
        )
        let data = try await cachedRaw("bff:dashboard:v3:\(month.key)", force: force, request)
        return try await decode(DashboardDTO.self, from: data)
    }

    public func getAgenda(month: YearMonth, force: Bool = false) async throws -> AgendaScreenDTO {
        let request = APIRequest(
            path: "agenda",
            queryItems: [URLQueryItem(name: "month", value: month.key)]
        )
        let data = try await cachedRaw("bff:agenda:\(month.key)", force: force, request)
        return try await decode(AgendaScreenDTO.self, from: data)
    }

    public func getBudgetScreen(month: YearMonth, force: Bool = false) async throws -> BudgetScreenDTO {
        let request = APIRequest(
            path: "budget-screen",
            queryItems: [URLQueryItem(name: "month", value: month.key)]
        )
        let data = try await cachedRaw("bff:budget-screen:\(month.key)", force: force, request)
        return try await decode(BudgetScreenDTO.self, from: data)
    }

    public func getReports(months: Int, accountId: String? = nil, force: Bool = false) async throws -> ReportsScreenDTO {
        var items = [URLQueryItem(name: "months", value: String(months))]
        if let accountId, !accountId.isEmpty {
            items.append(URLQueryItem(name: "accountId", value: accountId))
        }
        let key = "bff:reports:\(months):\(accountId ?? "all")"
        let data = try await cachedRaw(key, force: force, APIRequest(path: "reports", queryItems: items))
        return try await decode(ReportsScreenDTO.self, from: data)
    }

    public func getSubscriptionsScreen(force: Bool = false) async throws -> SubscriptionsScreenDTO {
        let data = try await cachedRaw("bff:subscriptions", force: force, APIRequest(path: "subscriptions"))
        return try await decode(SubscriptionsScreenDTO.self, from: data)
    }

    // MARK: - Financial Moment

    public func getFinancialMoment(month: YearMonth, force: Bool = false) async throws -> FinancialMomentDTO {
        let request = APIRequest(
            path: "financial-moment",
            queryItems: [URLQueryItem(name: "month", value: month.key)]
        )
        let data = try await cachedRaw("bff:financial-moment:\(month.key)", force: force, request)
        return try await decode(FinancialMomentDTO.self, from: data)
    }

    public func getCurrentSalary(for month: YearMonth, force: Bool = false) async throws -> SalarySettingDTO {
        let request = APIRequest(
            path: "financial-moment/salary",
            queryItems: [URLQueryItem(name: "month", value: month.key)]
        )
        let data = try await cachedRaw("bff:salary:\(month.key)", force: force, request)
        return try await decode(SalarySettingDTO.self, from: data)
    }

    public func saveSalary(_ amount: Money, for month: YearMonth) async throws {
        let requestDTO = SaveSalaryRequestDTO(amount: NSDecimalNumber(decimal: amount.amount).doubleValue, month: month.key)
        let encoder = JSONEncoder()
        let body = try encoder.encode(requestDTO)

        let request = APIRequest(
            path: "financial-moment/salary",
            method: .post,
            body: body
        )

        _ = try await api.sendRaw(request)
        await invalidateCaches(matching: [
            "bff:salary:",
            "bff:financial-moment:",
            "bff:dashboard:",
            "bff:joint:",
        ])
    }

    public func toggleManualExpensePaid(expenseId: String, isPaid: Bool) async throws {
        let requestDTO = ToggleManualExpensePaidRequestDTO(expenseId: expenseId, isPaid: isPaid)
        let encoder = JSONEncoder()
        let body = try encoder.encode(requestDTO)

        let request = APIRequest(
            path: "financial-moment/toggle-manual-expense",
            method: .post,
            body: body
        )

        _ = try await api.sendRaw(request)
        await invalidateCaches(matching: [
            "bff:domain:manuals",
            "bff:financial-moment:",
            "bff:dashboard:",
            "bff:joint:",
            "bff:agenda:",
            "bff:budget-screen:",
            "bff:reports:",
            "bff:subscriptions",
        ])
    }

    public func syncBankItem(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "items/\(id)", method: .patch, body: Data("{}".utf8)))
        await invalidateCaches(matching: ["bff:"])
    }

    // MARK: - Domain CRUD (`/v1/domain/*`)

    func getProfile(force: Bool = false) async throws -> DomainProfileDTO {
        try await domainGet("profile", as: DomainProfileDTO.self, cacheKey: "bff:domain:profile", force: force)
    }

    func patchProfile(_ fields: [String: Any]) async throws -> DomainProfileDTO {
        let body = try JSONSerialization.data(withJSONObject: fields)
        let data = try await api.sendRaw(APIRequest(path: "v1/domain/profile", method: .patch, body: body))
        await invalidateCaches(matching: ["bff:domain:profile", "bff:dashboard:", "bff:accounts"])
        return try await unwrapDomain(DomainProfileDTO.self, from: data)
    }

    func getBudgets(force: Bool = false) async throws -> [DomainBudgetRowDTO] {
        try await domainGet("budgets", as: [DomainBudgetRowDTO].self, cacheKey: "bff:domain:budgets", force: force)
    }

    public func saveBudget(category: String, limit: Decimal, period: BudgetPeriod = .monthly) async throws {
        try await domainWrite(
            path: "v1/domain/budgets",
            method: .post,
            body: [
                "category": category,
                "limit": NSDecimalNumber(decimal: limit).doubleValue,
                "period": period.rawValue,
            ]
        )
        await invalidateCaches(matching: ["bff:domain:budgets", "bff:dashboard:", "bff:budget-screen:"])
    }

    public func deleteBudget(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "v1/domain/budgets/\(id)", method: .delete))
        await invalidateCaches(matching: ["bff:domain:budgets", "bff:dashboard:", "bff:budget-screen:"])
    }

    func getGoals(force: Bool = false) async throws -> [DomainGoalRowDTO] {
        try await domainGet("goals", as: [DomainGoalRowDTO].self, cacheKey: "bff:domain:goals", force: force)
    }

    public func saveGoal(_ goal: Goal) async throws {
        var body: [String: Any] = [
            "id": goal.id,
            "title": goal.name,
            "target_amount": NSDecimalNumber(decimal: goal.target.amount).doubleValue,
            "current_amount": NSDecimalNumber(decimal: goal.current.amount).doubleValue,
        ]
        if let deadline = goal.deadline?.isoString {
            body["deadline"] = deadline
        }
        try await domainWrite(path: "v1/domain/goals", method: .post, body: body)
        await invalidateCaches(matching: ["bff:domain:goals"])
    }

    public func deleteGoal(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "v1/domain/goals/\(id)", method: .delete))
        await invalidateCaches(matching: ["bff:domain:goals"])
    }

    func getPurchaseCategories(force: Bool = false) async throws -> [DomainPurchaseCategoryRowDTO] {
        try await domainGet(
            "purchase-categories",
            as: [DomainPurchaseCategoryRowDTO].self,
            cacheKey: "bff:domain:purchase-categories",
            force: force
        )
    }

    public func savePurchaseCategory(_ category: PurchaseCategory) async throws {
        var body: [String: Any] = [
            "id": category.id,
            "key": category.key,
            "label": category.label,
            "sort_order": category.sortOrder,
        ]
        if let color = category.color {
            body["color"] = color
        }
        if let icon = category.icon {
            body["icon"] = icon
        }
        try await domainWrite(path: "v1/domain/purchase-categories", method: .post, body: body)
        await invalidateCaches(matching: ["bff:domain:purchase-categories"])
    }

    public func deletePurchaseCategory(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "v1/domain/purchase-categories/\(id)", method: .delete))
        await invalidateCaches(matching: ["bff:domain:purchase-categories"])
    }

    func getMealBenefits(force: Bool = false) async throws -> [DomainMealBenefitRowDTO] {
        try await domainGet("meal-benefits", as: [DomainMealBenefitRowDTO].self, cacheKey: "bff:domain:meal-benefits", force: force)
    }

    func getMealBenefitPurchases(force: Bool = false) async throws -> [DomainMealPurchaseRowDTO] {
        try await domainGet("meal-benefit-purchases", as: [DomainMealPurchaseRowDTO].self, cacheKey: "bff:domain:meal-benefit-purchases", force: force)
    }

    public func saveMealBenefit(_ benefit: MealBenefit) async throws {
        let body: [String: Any] = [
            "id": benefit.id,
            "kind": benefit.kind.rawValue,
            "label": benefit.label,
            "monthly_amount": NSDecimalNumber(decimal: benefit.monthlyAmount.amount).doubleValue,
            "credit_day": benefit.creditDay,
            "starts_on": benefit.startsOn.isoString,
            "opening_balance": NSDecimalNumber(decimal: benefit.openingBalance.amount).doubleValue,
            "show_in_moment": benefit.showInMoment,
        ]
        try await domainWrite(path: "v1/domain/meal-benefits", method: .post, body: body)
        await invalidateCaches(matching: ["bff:domain:meal-benefits", "bff:financial-moment:", "bff:joint:"])
    }

    public func deleteMealBenefit(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "v1/domain/meal-benefits/\(id)", method: .delete))
        await invalidateCaches(matching: ["bff:domain:meal-benefits", "bff:financial-moment:", "bff:joint:"])
    }

    public func saveMealBenefitPurchase(_ purchase: MealBenefitPurchase) async throws {
        let body: [String: Any] = [
            "id": purchase.id,
            "benefit_id": purchase.benefitId,
            "amount": NSDecimalNumber(decimal: purchase.amount.amount).doubleValue,
            "purchased_at": purchase.purchasedAt.isoString,
            "description": purchase.description,
            "category": purchase.category,
        ]
        try await domainWrite(path: "v1/domain/meal-benefit-purchases", method: .post, body: body)
        await invalidateCaches(matching: ["bff:domain:meal-benefit-purchases", "bff:financial-moment:", "bff:joint:", "bff:budget-screen:", "bff:dashboard:"])
    }

    public func deleteMealBenefitPurchase(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "v1/domain/meal-benefit-purchases/\(id)", method: .delete))
        await invalidateCaches(matching: ["bff:domain:meal-benefit-purchases", "bff:financial-moment:", "bff:joint:", "bff:budget-screen:", "bff:dashboard:"])
    }

    func getReceivables(force: Bool = false) async throws -> [DomainReceivableRowDTO] {
        try await domainGet("receivables", as: [DomainReceivableRowDTO].self, cacheKey: "bff:domain:receivables", force: force)
    }

    public func saveReceivable(_ receivable: Receivable) async throws {
        let history: [[String: Any]] = receivable.installmentHistory.map { inst in
            var row: [String: Any] = [
                "installment_number": inst.installmentNumber,
                "amount": NSDecimalNumber(decimal: inst.amount.amount).doubleValue,
                "due_date": inst.dueDate.isoString,
            ]
            if let paidAt = inst.paidAt {
                row["paid_at"] = paidAt.isoString
            } else {
                row["paid_at"] = NSNull()
            }
            return row
        }
        var body: [String: Any] = [
            "id": receivable.id,
            "person_name": receivable.counterparty ?? "",
            "description": receivable.description,
            "total_amount": NSDecimalNumber(decimal: receivable.amount.amount).doubleValue,
            "original_total_amount": NSDecimalNumber(decimal: (receivable.originalTotalAmount ?? receivable.amount).amount).doubleValue,
            "installments": receivable.installments,
            "paid_installments": receivable.paidInstallments,
            "is_continuous": receivable.isContinuous,
            "installment_history": history,
        ]
        if let color = receivable.personColor { body["person_color"] = color }
        if let notes = receivable.notes { body["notes"] = notes }
        if let linked = receivable.linkedTransactionId { body["linked_transaction_id"] = linked }
        if let forecast = receivable.linkedBillForecastDate { body["linked_bill_forecast_date"] = forecast }
        try await domainWrite(path: "v1/domain/receivables", method: .post, body: body)
        await invalidateCaches(matching: ["bff:domain:receivables", "bff:financial-moment:", "bff:joint:", "bff:agenda:"])
    }

    public func deleteReceivable(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "v1/domain/receivables/\(id)", method: .delete))
        await invalidateCaches(matching: ["bff:domain:receivables", "bff:financial-moment:", "bff:joint:", "bff:agenda:"])
    }

    func getManualExpenses(month: String? = nil, force: Bool = false) async throws -> [DomainManualRowDTO] {
        _ = month
        return try await domainGet(
            "manual-transactions",
            as: [DomainManualRowDTO].self,
            cacheKey: "bff:domain:manuals",
            force: force
        )
    }

    func saveManualExpense(_ expense: ManualExpense) async throws -> DomainManualRowDTO {
        var body: [String: Any] = [
            "id": expense.id,
            "description": expense.description,
            "original_description": expense.originalDescription ?? expense.baseDescription,
            "amount": NSDecimalNumber(decimal: expense.amount.amount).doubleValue,
            "date": expense.date.isoString,
            "category": expense.category ?? "Other",
            "type": "DEBIT",
            "status": "POSTED",
            "is_paid": expense.isPaid,
            "is_recurring": expense.isRecurring,
            "is_continuous": expense.isContinuous,
        ]
        if let accountId = expense.accountId, accountId != "manual" {
            body["account_id"] = accountId
        }
        if let parentId = expense.parentId {
            body["parent_id"] = parentId
        }
        if let frequency = expense.frequency {
            body["frequency"] = frequency
        }
        if let paidAt = expense.paidAt {
            body["paid_at"] = paidAt.isoString
        }
        let data = try await domainWriteReturning(
            path: "v1/domain/manual-transactions",
            method: .post,
            body: body
        )
        await invalidateCaches(matching: [
            "bff:domain:manuals",
            "bff:financial-moment:",
            "bff:dashboard:",
            "bff:joint:",
            "bff:agenda:",
            "bff:budget-screen:",
            "bff:reports:",
            "bff:subscriptions",
        ])
        return try await unwrapDomain(DomainManualRowDTO.self, from: data)
    }

    public func deleteManualExpense(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "v1/domain/manual-transactions/\(id)", method: .delete))
        await invalidateCaches(matching: [
            "bff:domain:manuals",
            "bff:financial-moment:",
            "bff:dashboard:",
            "bff:joint:",
            "bff:agenda:",
            "bff:budget-screen:",
            "bff:reports:",
            "bff:subscriptions",
        ])
    }

    func getManualAccounts(force: Bool = false) async throws -> [DomainManualAccountRowDTO] {
        try await domainGet(
            "manual-accounts",
            as: [DomainManualAccountRowDTO].self,
            cacheKey: "bff:domain:manual-accounts",
            force: force
        )
    }

    public func saveManualAccount(_ account: ManualAccount) async throws {
        let isCredit = account.type == .credit
        var body: [String: Any] = [
            "id": account.id,
            "name": account.name,
            "type": isCredit ? "CREDIT" : "BANK",
            "institution_name": account.institutionName,
            "balance": NSDecimalNumber(decimal: account.balance.amount).doubleValue,
        ]
        if isCredit {
            body["bill_amount"] = NSDecimalNumber(decimal: (account.billAmount ?? account.balance).amount).doubleValue
            if let day = account.billDueDay { body["bill_due_day"] = day }
            if let limit = account.creditLimit {
                body["credit_limit"] = NSDecimalNumber(decimal: limit.amount).doubleValue
            }
        }
        try await domainWrite(path: "v1/domain/manual-accounts", method: .post, body: body)
        await invalidateCaches(matching: ["bff:domain:manual-accounts", "bff:accounts", "bff:dashboard:"])
    }

    public func deleteManualAccount(id: String) async throws {
        _ = try await api.sendRaw(APIRequest(path: "v1/domain/manual-accounts/\(id)", method: .delete))
        await invalidateCaches(matching: ["bff:domain:manual-accounts", "bff:accounts", "bff:dashboard:"])
    }

    private func decodeSnake<T: Decodable & Sendable>(_ type: T.Type, from data: Data) async throws -> T {
        try await Task.detached(priority: .userInitiated) {
            do {
                return try JSONDecoder.financial.decode(T.self, from: data)
            } catch {
                throw AppError.decodingFailed(String(describing: error))
            }
        }.value
    }

    private func unwrapDomain<T: Decodable & Sendable>(_ type: T.Type, from data: Data) async throws -> T {
        let envelope = try await decodeSnake(V1Envelope<T>.self, from: data)
        guard let value = envelope.data else {
            throw AppError.decodingFailed("Envelope /v1 sem data")
        }
        return value
    }

    private func domainGet<T: Decodable & Sendable>(
        _ resource: String,
        as type: T.Type,
        cacheKey: String,
        force: Bool
    ) async throws -> T {
        let data = try await cachedRaw(cacheKey, force: force, APIRequest(path: "v1/domain/\(resource)"))
        return try await unwrapDomain(T.self, from: data)
    }

    @discardableResult
    private func domainWrite(path: String, method: HTTPMethod, body: [String: Any]) async throws -> Data {
        try await domainWriteReturning(path: path, method: method, body: body)
    }

    @discardableResult
    private func domainWriteReturning(path: String, method: HTTPMethod, body: [String: Any]) async throws -> Data {
        let payload = try JSONSerialization.data(withJSONObject: sanitizedJSON(body))
        return try await api.sendRaw(APIRequest(path: path, method: method, body: payload))
    }

    private func sanitizedJSON(_ object: [String: Any]) -> [String: Any] {
        object
    }
}
