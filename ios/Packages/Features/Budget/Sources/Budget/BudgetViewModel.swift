import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

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

    /// Synchronize limits' spent amounts and subcategories directly with transactionsByCategory
    /// so that card headers and transaction lists are 100% mathematically identical.
    public func syncLimitsWithTransactions() {
        limits = limits.map { limit in
            let items: [BudgetTransactionItem]
            if BudgetCategoryCatalog.isSubcategory(limit.category) {
                let canonical = BudgetCategoryCatalog.canonicalBudgetCategoryKey(limit.category)
                let label = BudgetCategoryCatalog.label(forCategory: limit.category)
                items = transactionsByCategory[canonical]
                    ?? transactionsByCategory[limit.category]
                    ?? transactionsByCategory[label]
                    ?? transactionsByCategory[limit.displayLabel]
                    ?? []
            } else {
                let baseKey = BudgetCategoryCatalog.resolveBudgetCategoryKey(limit.category)
                items = transactionsByCategory[limit.category]
                    ?? transactionsByCategory[limit.displayLabel]
                    ?? transactionsByCategory[baseKey]
                    ?? []
            }

            var updated = limit
            updated.isSubcategory = BudgetCategoryCatalog.isSubcategory(limit.category)
            updated.parentCategoryLabel = BudgetCategoryCatalog.parentLabel(forSubcategory: limit.category)

            let totalSpent = items.reduce(Decimal.zero) { $0 + $1.amount.amount }
            let bankSpent = items.filter { !$0.isMeal }.reduce(Decimal.zero) { $0 + $1.amount.amount }
            let mealSpent = items.filter { $0.isMeal }.reduce(Decimal.zero) { $0 + $1.amount.amount }

            // If we have items in the transaction list, or if backend reported 0, update with exact sum
            if !items.isEmpty || updated.spent.amount == 0 {
                updated.spent = Money(amount: totalSpent, currencyCode: "BRL")
                updated.spentBank = Money(amount: bankSpent, currencyCode: "BRL")
                updated.spentMeal = Money(amount: mealSpent, currencyCode: "BRL")
            }

            // Subcategories breakdown directly from the displayed transactions (only for base/parent categories)
            if !updated.isSubcategory {
                var subs: [String: Decimal] = [:]
                let baseKey = BudgetCategoryCatalog.resolveBudgetCategoryKey(limit.category)
                let baseLabel = BudgetCategoryCatalog.label(forBaseKey: baseKey)
                for item in items {
                    if let sub = item.subCategoryLabel, !sub.isEmpty, sub != baseLabel, sub != baseKey {
                        subs[sub, default: 0] += item.amount.amount
                    }
                }
                if !subs.isEmpty {
                    updated.subcategories = subs.map {
                        BudgetSubcategorySpend(label: $0.key, spent: Money(amount: $0.value, currencyCode: "BRL"))
                    }.sorted { $0.spent.amount > $1.spent.amount }
                }
            } else {
                updated.subcategories = []
            }
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
                let baseKey = BudgetCategoryCatalog.resolveBudgetCategoryKey(tx.category)
                let subLabel = BudgetCategoryCatalog.translateCategory(tx.category)
                let canonicalSub = BudgetCategoryCatalog.canonicalBudgetCategoryKey(tx.category)
                let accountName = accountsById[tx.accountId]?.name ?? "Conta"
                let item = BudgetTransactionItem(
                    id: tx.id,
                    description: tx.description,
                    date: tx.date,
                    amount: tx.amount,
                    isMeal: false,
                    accountName: accountName,
                    subCategoryLabel: subLabel
                )
                map[baseKey, default: []].append(item)
                if BudgetCategoryCatalog.isSubcategory(canonicalSub) {
                    map[canonicalSub, default: []].append(item)
                }
                if subLabel != baseKey {
                    map[subLabel, default: []].append(item)
                }
            }
        }

        if let benefits = try? await benefitsTask {
            for benefit in benefits {
                for purchase in benefit.purchases {
                    guard purchase.purchasedAt.yearMonth == selectedMonth else { continue }
                    let rawCategory = purchase.category.isEmpty
                        ? benefit.kind.defaultBudgetCategory
                        : purchase.category
                    let baseKey = BudgetCategoryCatalog.resolveBudgetCategoryKey(rawCategory)
                    let subLabel = BudgetCategoryCatalog.translateCategory(rawCategory)
                    let canonicalSub = BudgetCategoryCatalog.canonicalBudgetCategoryKey(rawCategory)
                    let description = purchase.description.isEmpty
                        ? (benefit.kind == .vr ? "VR — compra" : "VA — compra")
                        : purchase.description
                    let accountName = benefit.label.isEmpty
                        ? (benefit.kind == .vr ? "VR" : "VA")
                        : benefit.label
                    let item = BudgetTransactionItem(
                        id: purchase.id,
                        description: description,
                        date: purchase.purchasedAt,
                        amount: purchase.amount,
                        isMeal: true,
                        accountName: accountName,
                        subCategoryLabel: subLabel
                    )
                    map[baseKey, default: []].append(item)
                    if BudgetCategoryCatalog.isSubcategory(canonicalSub) {
                        map[canonicalSub, default: []].append(item)
                    }
                    if subLabel != baseKey {
                        map[subLabel, default: []].append(item)
                    }
                }
            }
        }

        for key in map.keys {
            map[key]?.sort { $0.date > $1.date }
        }

        // Alias display labels and category keys so lookup always succeeds
        for limit in limits {
            if BudgetCategoryCatalog.isSubcategory(limit.category) {
                let canonical = BudgetCategoryCatalog.canonicalBudgetCategoryKey(limit.category)
                let label = BudgetCategoryCatalog.label(forCategory: limit.category)
                let items = map[canonical] ?? map[limit.category] ?? map[label] ?? map[limit.displayLabel] ?? []
                if !items.isEmpty {
                    map[limit.category] = items
                    map[limit.displayLabel] = items
                    map[canonical] = items
                    map[label] = items
                }
            } else {
                let baseKey = BudgetCategoryCatalog.resolveBudgetCategoryKey(limit.category)
                let items = map[baseKey] ?? map[limit.category] ?? map[limit.displayLabel] ?? []
                if !items.isEmpty {
                    map[limit.category] = items
                    map[limit.displayLabel] = items
                    map[baseKey] = items
                }
            }
        }

        transactionsByCategory = map
        syncLimitsWithTransactions()
    }

    public var isEditing: Bool { editingCategory != nil }
    
    /// Groups transactions by budget period for display with period headers and totals.
    public func groupedTransactions(for category: String, period: BudgetPeriod) -> [BudgetPeriodGroup] {
        let items: [BudgetTransactionItem]
        if BudgetCategoryCatalog.isSubcategory(category) {
            let canonical = BudgetCategoryCatalog.canonicalBudgetCategoryKey(category)
            let label = BudgetCategoryCatalog.label(forCategory: category)
            items = transactionsByCategory[canonical]
                ?? transactionsByCategory[category]
                ?? transactionsByCategory[label]
                ?? transactionsByCategory[BudgetCategoryCatalog.label(forCategory: canonical)]
                ?? []
        } else {
            let baseKey = BudgetCategoryCatalog.resolveBudgetCategoryKey(category)
            items = transactionsByCategory[category]
                ?? transactionsByCategory[baseKey]
                ?? transactionsByCategory[BudgetCategoryCatalog.label(forBaseKey: baseKey)]
                ?? []
        }
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

    public var categoryHierarchyGroups: [BudgetCategoryCatalog.CategoryHierarchyGroup] {
        let taken = Set(limits.filter(\.hasLimit).map {
            BudgetCategoryCatalog.canonicalBudgetCategoryKey($0.category)
        })
        return BudgetCategoryCatalog.hierarchy.compactMap { group in
            if BudgetCategoryCatalog.excludedCategories.contains(group.parent.key) ||
               BudgetCategoryCatalog.excludedCategories.contains(group.parent.label) {
                return nil
            }
            let availableSubs = group.subcategories.filter { sub in
                !taken.contains(sub.key) &&
                !BudgetCategoryCatalog.excludedCategories.contains(sub.key) &&
                !BudgetCategoryCatalog.excludedCategories.contains(sub.label)
            }
            let isParentAvailable = !taken.contains(group.parent.key)
            if !isParentAvailable && availableSubs.isEmpty {
                return nil
            }
            return BudgetCategoryCatalog.CategoryHierarchyGroup(
                parent: group.parent,
                subcategories: availableSubs
            )
        }
    }

    public func isCategoryTaken(_ key: String) -> Bool {
        let canonical = BudgetCategoryCatalog.canonicalBudgetCategoryKey(key)
        return limits.contains { $0.hasLimit && BudgetCategoryCatalog.canonicalBudgetCategoryKey($0.category) == canonical }
    }

    public var categoryPickerLabels: [String] {
        var labels: [String] = []
        var seen = Set<String>()

        for group in BudgetCategoryCatalog.hierarchy {
            if !BudgetCategoryCatalog.excludedCategories.contains(group.parent.key) &&
               !seen.contains(group.parent.label) {
                labels.append(group.parent.label)
                seen.insert(group.parent.label)
                seen.insert(group.parent.key)
            }
            for sub in group.subcategories {
                if !BudgetCategoryCatalog.excludedCategories.contains(sub.key) &&
                   !seen.contains(sub.label) {
                    labels.append(sub.label)
                    seen.insert(sub.label)
                    seen.insert(sub.key)
                }
            }
        }

        return labels.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    /// Categories available when creating a new meta (exclude ones that already have a limit and excluded categories).
    public var availableCategoriesForCreate: [String] {
        let taken = Set(limits.filter(\.hasLimit).map {
            BudgetCategoryCatalog.canonicalBudgetCategoryKey($0.category)
        })
        return categoryPickerLabels.filter { label in
            let canonical = BudgetCategoryCatalog.canonicalBudgetCategoryKey(label)
            return !taken.contains(canonical) && !BudgetCategoryCatalog.excludedCategories.contains(label)
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
        let availableGroups = categoryHierarchyGroups
        if let firstGroup = availableGroups.first {
            if !isCategoryTaken(firstGroup.parent.key) {
                draftCategory = firstGroup.parent.key
            } else if let firstSub = firstGroup.subcategories.first {
                draftCategory = firstSub.key
            } else {
                draftCategory = firstGroup.parent.key
            }
        } else {
            draftCategory = "Food and drinks"
        }
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
            
            // Populate transactionsByCategory directly from limits returned by the BFF
            var map: [String: [BudgetTransactionItem]] = [:]
            for limit in limits {
                if !limit.transactions.isEmpty {
                    map[limit.category] = limit.transactions
                    map[limit.displayLabel] = limit.transactions
                    if BudgetCategoryCatalog.isSubcategory(limit.category) {
                        let subKey = BudgetCategoryCatalog.canonicalBudgetCategoryKey(limit.category)
                        map[subKey] = limit.transactions
                    } else {
                        let baseKey = BudgetCategoryCatalog.resolveBudgetCategoryKey(limit.category)
                        map[baseKey] = limit.transactions
                    }
                }
            }
            if !map.isEmpty {
                self.transactionsByCategory = map
            } else {
                await loadTransactionsByCategory(force: force)
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
        let rawCategory = (editingCategory ?? draftCategory)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let amount = Decimal(string: draftLimit.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard !rawCategory.isEmpty, amount > 0 else {
            errorMessage = "Informe categoria e valor da meta."
            return
        }
        let category = BudgetCategoryCatalog.canonicalBudgetCategoryKey(rawCategory)
        let isSub = BudgetCategoryCatalog.isSubcategory(category)
        let parentLabel = BudgetCategoryCatalog.parentLabel(forSubcategory: category)
        let displayLabel = BudgetCategoryCatalog.label(forCategory: category)
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
            hasLimit: true,
            categoryLabel: displayLabel,
            isSubcategory: isSub,
            parentCategoryLabel: parentLabel
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
