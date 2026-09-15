import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class ReportsViewModel {
    public enum Window: Int, CaseIterable, Identifiable {
        case three = 3
        case six = 6
        case twelve = 12
        public var id: Int { rawValue }
        public var title: String { "\(rawValue) meses" }
    }

    public private(set) var state: FeatureLoadState<ReportsSnapshot> = .idle
    public private(set) var snapshot: ReportsSnapshot?
    public var months: Window = .six
    public var accountId: String?
    public var errorMessage: String?
    public var csvURL: URL?

    private let reports: any ReportsRepository
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(reports: any ReportsRepository = StubReportsRepository()) {
        self.reports = reports
    }

    public var accounts: [ReportAccountRef] { snapshot?.accounts ?? [] }
    public var incomeTotal: Money { snapshot?.income ?? .zero }
    public var expenseTotal: Money { snapshot?.expense ?? .zero }
    public var byCategory: [(name: String, amount: Money)] {
        (snapshot?.categories ?? []).map { (name: $0.name, amount: $0.amount) }
    }

    public var calculationMismatch: Bool {
        !CalculationVersion.matches(snapshot?.calculationVersion)
    }

    public func load(force: Bool = false) async {
        let cacheKey = "reports:\(months.rawValue):\(accountId ?? "all")"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) { return }
        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        do {
            let loaded = try await reports.fetchReport(
                months: months.rawValue,
                accountId: accountId,
                force: force
            )
            snapshot = loaded
            csvURL = writeCSV(loaded)
            let empty = loaded.income.isZero && loaded.expense.isZero && loaded.categories.isEmpty
            state = empty ? .empty : .loaded(loaded)
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

    private func writeCSV(_ snap: ReportsSnapshot) -> URL? {
        var lines = ["categoria,valor"]
        for row in snap.categories {
            lines.append("\(row.name),\(row.amount.amount)")
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("relatorio.csv")
        try? lines.joined(separator: "\n").data(using: .utf8)?.write(to: url)
        return url
    }
}
