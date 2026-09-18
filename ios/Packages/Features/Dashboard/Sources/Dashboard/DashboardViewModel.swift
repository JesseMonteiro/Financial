import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

public enum DailyFlowRange: Int, CaseIterable, Identifiable, Sendable {
    case days7 = 7
    case days15 = 15
    case days30 = 30

    public var id: Int { rawValue }
    public var label: String {
        switch self {
        case .days7: "7D"
        case .days15: "15D"
        case .days30: "30D"
        }
    }
}

public struct DailySpendPoint: Identifiable, Hashable, Sendable {
    public var id: String { day.isoString }
    public var day: InstantDate
    public var amount: Decimal
    public var largestPurchase: Decimal

    public init(day: InstantDate, amount: Decimal, largestPurchase: Decimal = 0) {
        self.day = day
        self.amount = amount
        self.largestPurchase = largestPurchase
    }

    public var isToday: Bool { day == InstantDate(from: Date()) }

    public var doubleAmount: Double { NSDecimalNumber(decimal: amount).doubleValue }

    public var dateValue: Date { day.date() ?? Date() }
}

enum DailyFlowBuilder {
    static func saoPauloCalendar() -> Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        return cal
    }

    static func isExpense(_ tx: Transaction) -> Bool {
        isNewPurchase(kind: tx.kind, description: tx.description, category: tx.category)
    }

    static func isNewPurchase(kind: TransactionKind, description: String, category: String?) -> Bool {
        if kind == .credit { return false }
        let cat = (category ?? "").lowercased()
        if cat.contains("credit card payment")
            || cat == "transfers"
            || cat.contains("salary")
            || cat.contains("investments")
            || cat.contains("loan") {
            return false
        }
        return !isBillOrAccountPayment(description)
    }

    static func isNewPurchase(_ tx: DashboardRecentTransaction) -> Bool {
        if tx.isCredit { return false }
        return isNewPurchase(kind: .debit, description: tx.description, category: tx.category)
    }

    static func isBillOrAccountPayment(_ description: String) -> Bool {
        let d = description
            .uppercased()
            .folding(options: .diacriticInsensitive, locale: Locale(identifier: "en"))
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if d.hasPrefix("PAGAMENTO") { return true }
        if d.contains("PIX ENVIADO") { return true }
        if d.contains("TRANSFERENCIA") { return true }
        if d.hasPrefix("TED ") || d.hasPrefix("TED-") || d == "TED" { return true }
        if d.hasPrefix("DOC ") { return true }
        let needles = [
            "PAGAMENTO DE FATURA",
            "PAGAMENTO RECEBIDO",
            "PAGAMENTO ON LINE",
            "PAGAMENTO ONLINE",
            "PAGAMENTO COM SALDO",
            "PAGAMENTO PIX",
            "PAGTO FATURA",
            "PAGAMENTO FATURA",
            "PAGTO DEBITO AUTOMATICO",
            "DEBITO AUTOMATICO FATURA",
            "DEBITO AUTOMATICO",
            "CONVENIO",
            "PAGTO CONTA",
            "PAGAMENTO CONTA",
            "PAGAMENTO BOLETO",
            "PAGTO BOLETO",
        ]
        return needles.contains { d.contains($0) }
    }

    static func points(
        from transactions: [Transaction],
        recent: [DashboardRecentTransaction] = [],
        snapshot: [DashboardDailySpendPoint] = [],
        days: Int,
        now: Date = Date()
    ) -> [DailySpendPoint] {
        let cal = saoPauloCalendar()
        var byDay: [InstantDate: Decimal] = [:]
        var maxByDay: [InstantDate: Decimal] = [:]

        func rememberMax(day: InstantDate, purchase: Decimal) {
            guard day.year >= 2020 else { return }
            let value = abs(purchase)
            guard value > 0 else { return }
            maxByDay[day] = max(maxByDay[day] ?? 0, value)
        }

        func add(day: InstantDate, amount: Decimal, purchase: Decimal? = nil) {
            guard day.year >= 2020 else { return }
            byDay[day, default: 0] += abs(amount)
            rememberMax(day: day, purchase: purchase ?? amount)
        }

        if !snapshot.isEmpty {
            for row in snapshot {
                guard let day = InstantDate(isoString: row.date) else { continue }
                byDay[day] = abs(row.amount)
                rememberMax(day: day, purchase: row.maxPurchase)
            }
        } else {
            for tx in transactions where isExpense(tx) {
                add(day: tx.date, amount: tx.amount.amount, purchase: tx.amount.amount)
            }
            for tx in recent where isNewPurchase(tx) {
                guard let day = InstantDate(isoString: tx.date) else { continue }
                add(day: day, amount: tx.amount.amount, purchase: tx.amount.amount)
            }
        }

        return (0..<days).reversed().compactMap { offset in
            guard let date = cal.date(byAdding: .day, value: -offset, to: now) else { return nil }
            let day = InstantDate(from: date, calendar: cal)
            return DailySpendPoint(
                day: day,
                amount: byDay[day] ?? 0,
                largestPurchase: maxByDay[day] ?? 0
            )
        }
    }

    static func todayTransactionCount(from transactions: [Transaction], now: Date = Date()) -> Int {
        let today = InstantDate(from: now, calendar: saoPauloCalendar())
        return transactions.filter { $0.date == today && isExpense($0) }.count
    }

    static func cycleProgress(now: Date = Date()) -> Double {
        let cal = saoPauloCalendar()
        let day = cal.component(.day, from: now)
        let days = cal.range(of: .day, in: .month, for: now)?.count ?? 30
        return min(1, Double(day) / Double(max(days, 1)))
    }

    static func windowStart(days: Int, now: Date = Date()) -> InstantDate {
        let cal = saoPauloCalendar()
        let today = InstantDate(from: now, calendar: cal)
        guard let todayDate = today.date(calendar: cal),
              let start = cal.date(byAdding: .day, value: -(max(days, 1) - 1), to: todayDate)
        else { return today }
        return InstantDate(from: start, calendar: cal)
    }

    static func creditPurchases(
        from purchases: [DashboardRecentTransaction],
        days: Int,
        now: Date = Date()
    ) -> [DashboardRecentTransaction] {
        let start = windowStart(days: days, now: now)
        let today = InstantDate(from: now, calendar: saoPauloCalendar())
        return purchases
            .filter { purchase in
                guard let day = InstantDate(isoString: purchase.date) else { return false }
                return day >= start && day <= today && !purchase.isCredit
            }
            .sorted { $0.date > $1.date }
    }

    static func creditPurchases(
        from screen: CreditCardsScreen,
        days: Int,
        now: Date = Date(),
        limit: Int = 24
    ) -> [DashboardRecentTransaction] {
        let start = windowStart(days: days, now: now)
        let today = InstantDate(from: now, calendar: saoPauloCalendar())
        let cal = saoPauloCalendar()

        var seen = Set<String>()
        var rows: [(day: InstantDate, line: CreditBillLine)] = []
        for period in screen.periods.values {
            for bill in period.bills {
                for line in bill.items {
                    if line.isPayment || line.isProjected || line.isCredit { continue }
                    if let n = line.installmentNumber, n > 1 { continue }
                    // Prefer purchaseDate (matches Fluxo Diário).
                    guard let day = line.purchaseDate else { continue }
                    guard day >= start && day <= today else { continue }
                    if seen.contains(line.id) { continue }
                    seen.insert(line.id)
                    rows.append((day, line))
                }
            }
        }

        rows.sort {
            if $0.day != $1.day { return $0.day > $1.day }
            return $0.line.id > $1.line.id
        }

        let todayKey = InstantDate(from: now, calendar: cal)
        return rows.prefix(limit).map { row in
            let relative: String
            if row.day == todayKey {
                relative = "Hoje"
            } else if let yest = cal.date(byAdding: .day, value: -1, to: now),
                      row.day == InstantDate(from: yest, calendar: cal) {
                relative = "Ontem"
            } else {
                relative = String(format: "%02d/%02d/%04d", row.day.day, row.day.month, row.day.year)
            }
            return DashboardRecentTransaction(
                id: row.line.id,
                description: row.line.description,
                category: row.line.category ?? "",
                categoryId: row.line.categoryId,
                date: row.day.isoString,
                dateRelative: relative,
                amount: Money(amount: abs(row.line.amount.amount)),
                isCredit: false,
                isPending: row.line.isPending,
                accountId: row.line.accountId,
                accountName: row.line.accountName
            )
        }
    }

    static func creditPurchases(
        from transactions: [Transaction],
        creditAccountIds: Set<String>,
        days: Int,
        now: Date = Date(),
        limit: Int = 24
    ) -> [DashboardRecentTransaction] {
        let start = windowStart(days: days, now: now)
        let today = InstantDate(from: now, calendar: saoPauloCalendar())
        let cal = saoPauloCalendar()

        var seen = Set<String>()
        var rows: [(day: InstantDate, tx: Transaction)] = []
        for tx in transactions {
            if !creditAccountIds.isEmpty, !creditAccountIds.contains(tx.accountId) { continue }
            guard isExpense(tx) else { continue }
            let day = tx.date
            guard day >= start && day <= today else { continue }
            if seen.contains(tx.id) { continue }
            seen.insert(tx.id)
            rows.append((day, tx))
        }

        rows.sort {
            if $0.day != $1.day { return $0.day > $1.day }
            return $0.tx.id > $1.tx.id
        }

        let todayKey = InstantDate(from: now, calendar: cal)
        return rows.prefix(limit).map { row in
            let relative: String
            if row.day == todayKey {
                relative = "Hoje"
            } else if let yest = cal.date(byAdding: .day, value: -1, to: now),
                      row.day == InstantDate(from: yest, calendar: cal) {
                relative = "Ontem"
            } else {
                relative = String(format: "%02d/%02d/%04d", row.day.day, row.day.month, row.day.year)
            }
            return DashboardRecentTransaction(
                id: row.tx.id,
                description: row.tx.description,
                category: row.tx.category ?? "",
                categoryId: row.tx.categoryId,
                date: row.day.isoString,
                dateRelative: relative,
                amount: Money(amount: abs(row.tx.amount.amount)),
                isCredit: false,
                isPending: row.tx.isPending,
                accountId: row.tx.accountId
            )
        }
    }
}

@Observable
@MainActor
public final class DashboardViewModel {
    public private(set) var state: FeatureLoadState<DashboardSnapshot> = .idle
    public private(set) var selectedMonth: YearMonth
    public var errorMessage: String?

    public private(set) var dailySpend: [DailySpendPoint] = []
    public private(set) var recentCreditPurchases: [DashboardRecentTransaction] = []
    public private(set) var todayTransactionCount: Int = 0
    public var dailyRange: DailyFlowRange = .days7
    public var selectedDay: InstantDate?

    private let loadDashboard: any LoadDashboardUseCase
    private let transactions: (any TransactionsRepository)?
    private let accounts: (any AccountsRepository)?
    private let creditCards: (any CreditCardsRepository)?
    private let purchaseCategoriesRepository: (any PurchaseCategoriesRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?
    private var loadGeneration = 0
    public private(set) var categoryOptions: [LineItemCategoryOption] = []
    public private(set) var purchaseCategories: [PurchaseCategory] = PurchaseCategoryCatalog.defaults

    public static let recentCreditPurchaseDays = 15

    public init(
        loadDashboard: any LoadDashboardUseCase,
        transactions: (any TransactionsRepository)? = nil,
        accounts: (any AccountsRepository)? = nil,
        creditCards: (any CreditCardsRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil
    ) {
        self.loadDashboard = loadDashboard
        self.transactions = transactions
        self.accounts = accounts
        self.creditCards = creditCards
        self.purchaseCategoriesRepository = purchaseCategories
        self.selectedMonth = YearMonth(from: Date())
    }

    public var visibleDailySpend: [DailySpendPoint] {
        let n = dailyRange.rawValue
        guard dailySpend.count > n else { return dailySpend }
        return Array(dailySpend.suffix(n))
    }

    public var focusedPoint: DailySpendPoint? {
        if let selectedDay, let match = visibleDailySpend.first(where: { $0.day == selectedDay }) {
            return match
        }
        if let lastSpend = visibleDailySpend.last(where: { $0.amount > 0 }) {
            return lastSpend
        }
        return visibleDailySpend.last
    }

    /// Largest single purchase in the selected 7/15/30-day range.
    public var largestPurchase: DailySpendPoint? {
        let points = visibleDailySpend
        if let best = points.max(by: { $0.largestPurchase < $1.largestPurchase }),
           best.largestPurchase > 0 {
            return best
        }
        return points.max(by: { $0.amount < $1.amount }).flatMap { $0.amount > 0 ? $0 : nil }
    }

    public var largestPurchaseAmount: Decimal {
        let point = largestPurchase
        if let point, point.largestPurchase > 0 { return point.largestPurchase }
        return point?.amount ?? 0
    }

    /// Mean of the same daily purchase totals plotted on the chart for the selected range.
    public var dailyAverage: Decimal {
        let points = visibleDailySpend
        guard !points.isEmpty else { return 0 }
        let total = points.reduce(Decimal.zero) { $0 + $1.amount }
        return total / Decimal(points.count)
    }

    public var dayOverDayDeltaPct: Double? {
        let points = visibleDailySpend
        guard points.count >= 2 else { return nil }
        let today = points[points.count - 1].doubleAmount
        let yesterday = points[points.count - 2].doubleAmount
        guard yesterday > 0 else { return today == 0 ? 0 : nil }
        return ((today - yesterday) / yesterday) * 100
    }

    public var cycleProgress: Double { DailyFlowBuilder.cycleProgress() }

    public func select(day: InstantDate) {
        selectedDay = day
    }

    public func load(force: Bool = false) async {
        await load(force: force, cancellationRetry: 0)
    }

    private func load(force: Bool, cancellationRetry: Int) async {
        let cacheKey = selectedMonth.key
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) {
            if categoryOptions.isEmpty { await loadCategories(force: true) }
            // Dashboard snapshot may be fresh while the purchases strip was never filled
            // (stale BFF payload / first paint before credit-ledger load).
            if recentCreditPurchases.isEmpty {
                if case .loaded(let snap) = state {
                    await loadRecentCreditPurchases(from: snap, force: false)
                } else {
                    await loadRecentCreditPurchases(from: nil, force: false)
                }
            }
            return
        }

        loadGeneration &+= 1
        let generation = loadGeneration
        state.beginLoad(silentIfPossible: true)
        do {
            var snapshot = try await loadDashboard.execute(month: selectedMonth, force: force)
            // Home “Últimas Transações”: only effected activity — never future/projected parcels.
            snapshot.recentTransactions = Self.executedRecentTransactions(snapshot.recentTransactions)
            guard generation == loadGeneration else { return }
            await loadDailyFlow(
                force: force,
                recent: snapshot.recentTransactions,
                snapshot: snapshot.dailySpend
            )
            await loadRecentCreditPurchases(from: snapshot, force: force)
            guard generation == loadGeneration else { return }
            let hasAccounts = snapshot.summary.bankCount + snapshot.summary.creditCount > 0
            let hasActivity = !snapshot.recentTransactions.isEmpty
                || snapshot.summary.netWorth.amount != 0
                || !snapshot.insights.isEmpty
            if !hasAccounts && !hasActivity {
                state = .empty
            } else {
                state = .loaded(snapshot)
            }
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
            await loadCategories(force: force)
        } catch {
            guard generation == loadGeneration else { return }
            if Self.isCancellation(error) {
                // The SwiftUI `.task` that started this load is already cancelled, so a
                // nested await would also cancel. Hop to a fresh Task for one retry.
                if !state.hasContent, cancellationRetry < 1 {
                    let forceRetry = force
                    let retry = cancellationRetry + 1
                    Task { @MainActor in
                        try? await Task.sleep(for: .milliseconds(200))
                        await self.load(force: forceRetry, cancellationRetry: retry)
                    }
                }
                return
            }
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Erro ao carregar visão geral.")
            }
        }
    }

    private static func isCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let urlError = error as? URLError, urlError.code == .cancelled { return true }
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
    }

    /// Drop rows dated after today (SP). Projected installments often arrive with future `date`.
    static func executedRecentTransactions(
        _ rows: [DashboardRecentTransaction],
        now: Date = Date()
    ) -> [DashboardRecentTransaction] {
        let today = InstantDate(from: now, calendar: DailyFlowBuilder.saoPauloCalendar())
        return rows.filter { row in
            guard let day = InstantDate(isoString: row.date) else { return false }
            return day <= today
        }
    }

    public func changeCategory(id: String, option: LineItemCategoryOption) async {
        guard let transactions else { return }
        do {
            try await transactions.updateCategory(id: id, categoryId: option.id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    private func loadCategories(force: Bool) async {
        if let transactions {
            let cats = (try? await transactions.fetchCategories(force: force)) ?? []
            if !cats.isEmpty {
                categoryOptions = LineItemCategoryOption.pluggyOptions(cats)
            }
        }
        if let purchaseCategoriesRepository,
           let cats = try? await purchaseCategoriesRepository.fetchCategories(force: force) {
            purchaseCategories = PurchaseCategoryCatalog.resolved(cats)
        }
    }

    private func loadDailyFlow(
        force: Bool,
        recent: [DashboardRecentTransaction] = [],
        snapshot: [DashboardDailySpendPoint] = []
    ) async {
        let now = Date()
        let cal = DailyFlowBuilder.saoPauloCalendar()
        var collected: [Transaction] = []
        let snapshotProvided = !snapshot.isEmpty
        if !snapshotProvided, let transactions {
            let current = YearMonth(from: now)
            let months = [current.adding(months: -1), current]
            for month in months {
                let batch = (try? await transactions.fetchTransactions(
                    accountId: nil,
                    month: month,
                    force: force
                )) ?? []
                collected.append(contentsOf: batch)
            }
        }
        dailySpend = DailyFlowBuilder.points(
            from: collected,
            recent: snapshotProvided ? [] : recent,
            snapshot: snapshot,
            days: 30,
            now: now
        )
        todayTransactionCount = DailyFlowBuilder.todayTransactionCount(from: collected, now: now)
        if selectedDay == nil {
            selectedDay = dailySpend.last(where: { $0.amount > 0 })?.day
                ?? InstantDate(from: now, calendar: cal)
        }
    }

    private func loadRecentCreditPurchases(from snapshot: DashboardSnapshot?, force: Bool) async {
        if let snapshot {
            let windowed = DailyFlowBuilder.creditPurchases(
                from: snapshot.recentCreditPurchases,
                days: Self.recentCreditPurchaseDays
            )
            if !windowed.isEmpty {
                recentCreditPurchases = windowed
                return
            }
        }

        // Same ledger as Cartões — purchaseDate already matches Fluxo Diário.
        if let creditCards,
           let screen = try? await creditCards.fetchScreen(force: force) {
            let fromCards = DailyFlowBuilder.creditPurchases(
                from: screen,
                days: Self.recentCreditPurchaseDays
            )
            if !fromCards.isEmpty {
                recentCreditPurchases = fromCards
                return
            }
        }

        guard let transactions else {
            recentCreditPurchases = []
            return
        }

        let now = Date()
        let current = YearMonth(from: now)
        var creditIds = Set<String>()
        if let accounts,
           let list = try? await accounts.fetchAccounts(force: false) {
            creditIds = Set(list.filter(\.isCreditCard).map(\.id))
        }

        var collected: [Transaction] = []
        let accountTargets: [String?] = creditIds.isEmpty
            ? [nil]
            : creditIds.map { Optional($0) }
        for accountId in accountTargets {
            for month in [current.adding(months: -1), current] {
                let batch = (try? await transactions.fetchTransactions(
                    accountId: accountId,
                    month: month,
                    force: force
                )) ?? []
                collected.append(contentsOf: batch)
            }
        }

        recentCreditPurchases = DailyFlowBuilder.creditPurchases(
            from: collected,
            creditAccountIds: creditIds,
            days: Self.recentCreditPurchaseDays,
            now: now
        )
    }
}
