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
}

@Observable
@MainActor
public final class DashboardViewModel {
    public private(set) var state: FeatureLoadState<DashboardSnapshot> = .idle
    public private(set) var selectedMonth: YearMonth
    public var errorMessage: String?

    public private(set) var dailySpend: [DailySpendPoint] = []
    public private(set) var todayTransactionCount: Int = 0
    public var dailyRange: DailyFlowRange = .days7
    public var selectedDay: InstantDate?

    private let loadDashboard: any LoadDashboardUseCase
    private let transactions: (any TransactionsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?
    private var loadGeneration = 0
    public private(set) var categoryOptions: [LineItemCategoryOption] = []

    public init(
        loadDashboard: any LoadDashboardUseCase,
        transactions: (any TransactionsRepository)? = nil
    ) {
        self.loadDashboard = loadDashboard
        self.transactions = transactions
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
            return
        }

        loadGeneration &+= 1
        let generation = loadGeneration
        state.beginLoad(silentIfPossible: true)
        do {
            let snapshot = try await loadDashboard.execute(month: selectedMonth, force: force)
            guard generation == loadGeneration else { return }
            await loadDailyFlow(
                force: force,
                recent: snapshot.recentTransactions,
                snapshot: snapshot.dailySpend
            )
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
        guard let transactions else { return }
        let cats = (try? await transactions.fetchCategories(force: force)) ?? []
        if !cats.isEmpty {
            categoryOptions = LineItemCategoryOption.pluggyOptions(cats)
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
}
