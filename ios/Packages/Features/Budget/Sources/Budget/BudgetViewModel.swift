import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

/// A single line item shown in a budget category's expanded transaction list.
public struct BudgetTransactionItem: Sendable, Identifiable, Hashable {
    public let id: String
    public let description: String
    public let date: InstantDate
    public let amount: Money
    public let isMeal: Bool
    public let accountName: String
}

/// Groups transactions by budget period (daily, weekly, biweekly, monthly).
public struct BudgetPeriodGroup: Sendable, Identifiable, Hashable {
    public let id: String
    public let label: String
    public let transactions: [BudgetTransactionItem]
    public let total: Money
    
    public init(id: String, label: String, transactions: [BudgetTransactionItem], total: Money) {
        self.id = id
        self.label = label
        self.transactions = transactions
        self.total = total
    }
}

@Observable
@MainActor
public final class BudgetViewModel {
    public private(set) var state: FeatureLoadState<[BudgetLimit]> = .idle
    public private(set) var limits: [BudgetLimit] = []
    public private(set) var purchaseCategories: [PurchaseCategory] = PurchaseCategoryCatalog.defaults
    public private(set) var transactionsByCategory: [String: [BudgetTransactionItem]] = [:]
    public var selectedMonth: YearMonth = YearMonth(from: Date())
    public var errorMessage: String?
    public var draftCategory = BudgetCategoryCatalog.labels[0]
    public var draftLimit = ""
    public var draftPeriod: BudgetPeriod = .monthly
    /// When non-nil, the editor is updating an existing meta (category locked).
    public private(set) var editingCategory: String?
    /// Expanded category for showing transactions
    public var expandedCategory: String?

    private let repository: (any BudgetRepository)?
    private let transactionsRepository: (any TransactionsRepository)?
    private let mealBenefitsRepository: (any MealBenefitsRepository)?
    private let purchaseCategoriesRepository: (any PurchaseCategoriesRepository)?
    private let accountsRepository: (any AccountsRepository)?
    private let billsRepository: (any BillsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        repository: (any BudgetRepository)? = nil,
        transactions: (any TransactionsRepository)? = nil,
        mealBenefits: (any MealBenefitsRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil,
        accounts: (any AccountsRepository)? = nil,
        bills: (any BillsRepository)? = nil
    ) {
        self.repository = repository
        self.transactionsRepository = transactions
        self.mealBenefitsRepository = mealBenefits
        self.purchaseCategoriesRepository = purchaseCategories
        self.accountsRepository = accounts
        self.billsRepository = bills
    }

    // MARK: - Due Month Helpers (mirrors creditBillPeriod.ts)
    
    /// Extract YYYY-MM from ISO date string
    private static func ymFromIso(_ iso: String?) -> String? {
        guard let iso = iso, iso.count >= 7 else { return nil }
        return String(iso.prefix(7))
    }
    
    /// Add months to YYYY-MM string
    private static func ymAdd(_ ym: String?, months: Int) -> String? {
        guard let ym = ym, ym.count == 7, ym != "Outros" else { return ym }
        let parts = ym.split(separator: "-")
        guard parts.count == 2,
              var year = Int(parts[0]),
              var month = Int(parts[1]) else { return ym }
        
        month += months
        while month > 12 {
            month -= 12
            year += 1
        }
        while month < 1 {
            month += 12
            year -= 1
        }
        return String(format: "%04d-%02d", year, month)
    }
    
    /// Infer forecastToDueOffset from transactions and bills (0 or 1)
    private static func inferForecastToDueOffset(transactions: [Transaction], bills: [Bill]) -> Int {
        let billMap = Dictionary(uniqueKeysWithValues: bills.map { ($0.id, $0) })
        var eqDue = 0
        var eqDueMinus1 = 0
        
        for tx in transactions {
            guard let fc = tx.billForecastDate,
                  let billId = tx.billId,
                  let bill = billMap[billId],
                  let dueYm = ymFromIso(bill.dueDate?.isoString) else { continue }
            
            if fc == dueYm { eqDue += 1 }
            if fc == ymAdd(dueYm, months: -1) { eqDueMinus1 += 1 }
        }
        
        if eqDue + eqDueMinus1 > 0 {
            return eqDue >= eqDueMinus1 ? 0 : 1
        }
        
        // Simplified: default to 0 (forecast == due, Nubank-like)
        // Note: Bill model doesn't include closingDate field
        return 0
    }
    
    /// Get due month key for a transaction
    private static func getDueMonthKey(
        tx: Transaction,
        bills: [Bill],
        forecastToDueOffset: Int
    ) -> String? {
        let billMap = Dictionary(uniqueKeysWithValues: bills.map { ($0.id, $0) })
        
        // Try billId first
        if let billId = tx.billId,
           let bill = billMap[billId],
           let dueYm = ymFromIso(bill.dueDate?.isoString) {
            return dueYm
        }
        
        // Try forecast date
        if let fc = tx.billForecastDate {
            return ymAdd(fc, months: forecastToDueOffset)
        }
        
        // Last resort: use transaction date
        let txYm = ymFromIso(tx.date.isoString)
        if forecastToDueOffset == 0 {
            return txYm
        } else {
            return ymAdd(txYm, months: 1)
        }
    }
    
    /// Determine due month for a transaction (credit cards use bill due, bank uses calendar)
    private static func txDueMonth(
        tx: Transaction,
        bills: [Bill],
        creditAccountIds: Set<String>,
        forecastToDueOffset: Int
    ) -> String? {
        let accountId = tx.accountId
        let isCard = tx.creditCardMetadata != nil ||
                     creditAccountIds.contains(accountId) ||
                     bills.contains { $0.accountId == accountId }
        
        if isCard {
            return getDueMonthKey(tx: tx, bills: bills, forecastToDueOffset: forecastToDueOffset)
        }
        
        return ymFromIso(tx.date.isoString)
    }
    
    /// Mirrors web `isBillPayment` (src/utils/creditBillPeriod.js) — keeps bill
    /// payments/transfers out of the expanded transaction list.
    private static func isBillPayment(_ description: String) -> Bool {
        let d = description
            .uppercased()
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "pt_BR"))
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if d.hasPrefix("PAGAMENTO") { return true }
        let needles = [
            "PAGAMENTO DE FATURA", "PAGAMENTO RECEBIDO", "PAGAMENTO ON LINE",
            "PAGAMENTO ONLINE", "PAGAMENTO COM SALDO", "PAGAMENTO PIX",
            "PAGTO FATURA", "PAGAMENTO FATURA", "PAGTO DEBITO AUTOMATICO",
            "DEBITO AUTOMATICO FATURA",
        ]
        return needles.contains { d.contains($0) }
    }

    /// Recalculate budget spending using calendar month (purchase date) instead of due month.
    /// This ensures the displayed totals match the transaction list.
    private func recalculateSpendingByCalendarMonth(
        transactions: [Transaction],
        mealPurchases: [MealBenefitPurchase],
        mealBenefits: [MealBenefit]
    ) {
        var spendingByCategory: [String: (total: Decimal, bank: Decimal, meal: Decimal)] = [:]
        
        // Process regular transactions
        for tx in transactions {
            let calendarMonth = Self.ymFromIso(tx.date.isoString)
            guard calendarMonth == selectedMonth.key else { continue }
            guard tx.kind == .debit else { continue }
            guard !Self.isBillPayment(tx.description) else { continue }
            
            let category = BudgetCategoryCatalog.translateCategory(tx.category)
            let amount = tx.amount.amount
            
            var entry = spendingByCategory[category] ?? (0, 0, 0)
            entry.total += amount
            entry.bank += amount
            spendingByCategory[category] = entry
        }
        
        // Process meal purchases
        for purchase in mealPurchases {
            let calendarMonth = Self.ymFromIso(purchase.date.isoString)
            guard calendarMonth == selectedMonth.key else { continue }
            
            let benefit = mealBenefits.first { $0.id == purchase.benefitId }
            let category = benefit?.kind == .vr ? "Restaurante" : "Supermercado & Alimentação"
            let amount = purchase.amount.amount
            
            var entry = spendingByCategory[category] ?? (0, 0, 0)
            entry.total += amount
            entry.meal += amount
            spendingByCategory[category] = entry
        }
        
        // Update limits with recalculated spending
        limits = limits.map { limit in
            guard let spending = spendingByCategory[limit.category] else { return limit }
            
            var updated = limit
            updated.spent = Money(amount: spending.total, currencyCode: "BRL")
            updated.spentBank = Money(amount: spending.bank, currencyCode: "BRL")
            updated.spentMeal = Money(amount: spending.meal, currencyCode: "BRL")
            return updated
        }
    }
    
    /// Builds the per-category transaction list shown when a budget row is expanded.
    ///
    /// Uses **calendar month** (purchase date) for filtering. Budget totals are also
    /// recalculated using calendar month to ensure they match the transaction list.
    ///
    /// Fetches with `month: nil` (unbounded) and filters by calendar month client-side.
    private func loadTransactionsByCategory(force: Bool) async {
        guard let transactionsRepository else { return }
        var map: [String: [BudgetTransactionItem]] = [:]

        async let txTask = transactionsRepository.fetchTransactions(
            accountId: nil,
            month: nil,
            force: force
        )
        async let benefitsTask = mealBenefitsRepository?.fetchBenefits(force: force)
        async let accountsTask = accountsRepository?.fetchAccounts(force: force)

        let accounts = (try? await accountsTask) ?? []
        let accountsById = Dictionary(uniqueKeysWithValues: accounts.map { ($0.id, $0) })
        
        // Identify credit card accounts
        let creditAccountIds = Set(accounts.filter { $0.type == .credit }.map(\.id))
        
        // Fetch bills for each credit card account
        var bills: [Bill] = []
        if let billsRepo = billsRepository {
            print("🔍 [Budget] Fetching bills for \(creditAccountIds.count) credit card accounts...")
            for accountId in creditAccountIds {
                do {
                    let accountBills = try await billsRepo.fetchBills(accountId: accountId, dueMonth: nil)
                    bills.append(contentsOf: accountBills)
                    print("🔍 [Budget] Account \(accountId.prefix(8))... fetched \(accountBills.count) bills")
                } catch {
                    print("❌ [Budget] Error fetching bills for \(accountId.prefix(8))...: \(error)")
                }
            }
            print("🔍 [Budget] Total bills fetched: \(bills.count)")
        } else {
            print("❌ [Budget] BillsRepository is nil")
        }
        
        if let txs = try? await txTask {
            // Calculate forecastToDueOffset
            let forecastToDueOffset = Self.inferForecastToDueOffset(
                transactions: txs.filter { $0.creditCardMetadata != nil },
                bills: bills
            )
            
            // Debug: Log transactions with credit card metadata
            let txsWithMeta = txs.filter { $0.creditCardMetadata != nil || $0.billId != nil }
            print("🔍 [Budget] Transactions with credit metadata: \(txsWithMeta.count)/\(txs.count)")
            print("🔍 [Budget] Bills fetched: \(bills.count)")
            print("🔍 [Budget] Forecast to due offset: \(forecastToDueOffset)")
            print("🔍 [Budget] Credit account IDs: \(creditAccountIds)")
            
            for tx in txs {
                // Use calendar month for transaction list (not due month)
                // This shows purchases made in the selected month, regardless of billing month
                let calendarMonth = Self.ymFromIso(tx.date.isoString)
                
                // Debug: Log first few transactions
                if map.values.flatMap({ $0 }).count < 5 {
                    let dueMonth = Self.txDueMonth(
                        tx: tx,
                        bills: bills,
                        creditAccountIds: creditAccountIds,
                        forecastToDueOffset: forecastToDueOffset
                    )
                    let isCard = creditAccountIds.contains(tx.accountId)
                    print("🔍 [Budget] TX: \(tx.description.prefix(30)) | Calendar: \(calendarMonth ?? "nil") | Due: \(dueMonth ?? "nil") | IsCard: \(isCard) | Selected: \(selectedMonth.key)")
                }
                
                guard calendarMonth == selectedMonth.key else { continue }
                guard tx.kind == .debit else { continue }
                guard !Self.isBillPayment(tx.description) else { continue }
                let label = BudgetCategoryCatalog.translateCategory(tx.category)
                let accountName = accountsById[tx.accountId]?.name ?? "Conta"
                map[label, default: []].append(
                    BudgetTransactionItem(id: tx.id, description: tx.description, date: tx.date, amount: tx.amount, isMeal: false, accountName: accountName)
                )
            }
        }

        if let benefits = try? await benefitsTask {
            for benefit in benefits {
                for purchase in benefit.purchases {
                    guard purchase.purchasedAt.yearMonth == selectedMonth else { continue }
                    let category = purchase.category.isEmpty
                        ? benefit.kind.defaultBudgetCategory
                        : purchase.category
                    let description = purchase.description.isEmpty
                        ? (benefit.kind == .vr ? "VR — compra" : "VA — compra")
                        : purchase.description
                    let accountName = benefit.label.isEmpty
                        ? (benefit.kind == .vr ? "VR" : "VA")
                        : benefit.label
                    map[category, default: []].append(
                        BudgetTransactionItem(id: purchase.id, description: description, date: purchase.purchasedAt, amount: purchase.amount, isMeal: true, accountName: accountName)
                    )
                }
            }
        }

        for key in map.keys {
            map[key]?.sort { $0.date > $1.date }
        }
        transactionsByCategory = map
        
        // Recalculate budget spending using calendar month to match transaction list
        let allMealPurchases = (try? await benefitsTask)?.flatMap(\.purchases) ?? []
        let allBenefits = (try? await benefitsTask) ?? []
        if let txs = try? await txTask {
            recalculateSpendingByCalendarMonth(
                transactions: txs,
                mealPurchases: allMealPurchases,
                mealBenefits: allBenefits
            )
        }
    }

    public var isEditing: Bool { editingCategory != nil }
    
    /// Groups transactions by budget period for display with period headers and totals.
    public func groupedTransactions(for category: String, period: BudgetPeriod) -> [BudgetPeriodGroup] {
        let items = transactionsByCategory[category] ?? []
        if items.isEmpty { return [] }
        
        var groups: [String: (label: String, items: [BudgetTransactionItem], sortDate: InstantDate)] = [:]
        
        for item in items {
            let key: String
            let label: String
            
            switch period {
            case .daily:
                key = item.date.isoString
                label = String(format: "%02d/%02d", item.date.day, item.date.month)
            case .weekly:
                let weekNum = (item.date.day - 1) / 7 + 1
                key = "week-\(weekNum)"
                label = "Semana \(weekNum)"
            case .biweekly:
                let half = item.date.day <= 15 ? 1 : 2
                key = "half-\(half)"
                label = half == 1 ? "1ª Quinzena" : "2ª Quinzena"
            case .monthly:
                key = "month"
                label = "Mês completo"
            }
            
            if groups[key] == nil {
                groups[key] = (label: label, items: [], sortDate: item.date)
            }
            groups[key]?.items.append(item)
        }
        
        let sorted = groups.map { key, value in
            let total = value.items.reduce(Money.zero) { $0.adding($1.amount) }
            return BudgetPeriodGroup(
                id: key,
                label: value.label,
                transactions: value.items.sorted { $0.date > $1.date },
                total: total
            )
        }.sorted { $0.transactions.first?.date ?? InstantDate(year: 1970, month: 1, day: 1) > $1.transactions.first?.date ?? InstantDate(year: 1970, month: 1, day: 1) }
        
        return sorted
    }

    public var categoryPickerLabels: [String] {
        var labels = Set(BudgetCategoryCatalog.labels)
        for category in PurchaseCategoryCatalog.resolved(purchaseCategories) {
            labels.insert(category.label)
        }
        for limit in limits {
            labels.insert(limit.category)
        }
        // Filter out excluded categories
        return labels
            .filter { !BudgetCategoryCatalog.excludedCategories.contains($0) }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    /// Categories available when creating a new meta (exclude ones that already have a limit and excluded categories).
    public var availableCategoriesForCreate: [String] {
        let taken = Set(limits.filter(\.hasLimit).map(\.category))
        return categoryPickerLabels.filter { 
            !taken.contains($0) && !BudgetCategoryCatalog.excludedCategories.contains($0)
        }
    }

    public var spentTotal: Money {
        limits.reduce(Money.zero) { $0.adding($1.spent) }
    }

    public var limitTotal: Money {
        limits.filter(\.hasLimit).reduce(Money.zero) { $0.adding($1.limit) }
    }

    public var monthCapTotal: Money {
        limits.filter(\.hasLimit).reduce(Money.zero) { $0.adding($1.monthCap) }
    }

    public var categoriesWithBudget: Int {
        limits.filter(\.hasLimit).count
    }

    public var overBudgetCount: Int {
        limits.filter { $0.hasLimit && $0.spent.amount > $0.limit.amount }.count
    }

    public var budgetBalance: Money {
        Money(amount: abs(limitTotal.amount - spentTotal.amount))
    }

    public var isOverTotalAllowance: Bool {
        limitTotal.amount > 0 && spentTotal.amount > limitTotal.amount
    }

    public var canGoNext: Bool {
        selectedMonth < YearMonth(from: Date())
    }

    public func goToPreviousMonth() {
        selectedMonth = selectedMonth.previous
    }

    public func goToNextMonth() {
        guard canGoNext else { return }
        selectedMonth = selectedMonth.next
    }

    public func beginCreate() {
        editingCategory = nil
        draftPeriod = .monthly
        draftLimit = ""
        let available = availableCategoriesForCreate
        draftCategory = available.first
            ?? categoryPickerLabels.first
            ?? BudgetCategoryCatalog.labels[0]
    }

    public func beginEdit(_ limit: BudgetLimit) {
        editingCategory = limit.category
        draftCategory = limit.category
        draftPeriod = limit.period
        let amount = limit.periodAmount.amount
        if amount == 0 {
            draftLimit = ""
        } else {
            draftLimit = NSDecimalNumber(decimal: amount).stringValue
        }
    }

    public func beginSetLimit(_ limit: BudgetLimit) {
        editingCategory = limit.hasLimit ? limit.category : nil
        draftCategory = limit.category
        draftPeriod = limit.hasLimit ? limit.period : .monthly
        if limit.hasLimit, limit.periodAmount.amount > 0 {
            draftLimit = NSDecimalNumber(decimal: limit.periodAmount.amount).stringValue
        } else {
            draftLimit = ""
        }
    }

    public func cancelEditor() {
        editingCategory = nil
        draftLimit = ""
        draftPeriod = .monthly
    }

    public func load(force: Bool = false) async {
        let cacheKey = "budget:\(selectedMonth.key)"
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
            async let limitsTask = repository.fetchLimits(month: selectedMonth, force: force)
            async let categoriesTask = purchaseCategoriesRepository?.fetchCategories(force: force)
            limits = try await limitsTask
            if let loaded = try? await categoriesTask {
                purchaseCategories = PurchaseCategoryCatalog.resolved(loaded)
            }
            await loadTransactionsByCategory(force: force)
            if !categoryPickerLabels.contains(draftCategory) {
                draftCategory = categoryPickerLabels.first ?? BudgetCategoryCatalog.labels[0]
            }
            // Keep loaded UI when there are spend rows without metas (parity with web).
            state = limits.isEmpty ? .empty : .loaded(limits)
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
        let category = (editingCategory ?? draftCategory)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let amount = Decimal(string: draftLimit.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard !category.isEmpty, amount > 0 else {
            errorMessage = "Informe categoria e valor da meta."
            return
        }
        let money = Money(amount: amount)
        let limit = BudgetLimit(
            id: editingCategory ?? category,
            category: category,
            limit: money,
            spent: .zero,
            month: selectedMonth,
            period: draftPeriod,
            periodAmount: money,
            monthCap: money,
            hasLimit: true
        )
        do {
            try await repository.saveLimit(limit)
            cancelEditor()
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ limit: BudgetLimit) async {
        guard limit.hasLimit else { return }
        guard let repository else { return }
        // Prefer UUID id from budget-screen; never DELETE with category label as path.
        let id = limit.id
        guard id != limit.category, !id.isEmpty else {
            errorMessage = "Não foi possível excluir esta meta. Atualize a tela e tente de novo."
            return
        }
        do {
            try await repository.deleteLimit(id: id, category: limit.category)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
