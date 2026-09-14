import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

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

    public private(set) var state: FeatureLoadState<[Transaction]> = .idle
    public private(set) var transactions: [Transaction] = []
    public private(set) var accounts: [Account] = []
    public var months: Window = .six
    public var accountId: String?
    public var errorMessage: String?
    public var csvURL: URL?

    private let transactionsRepository: (any TransactionsRepository)?
    private let accountsRepository: (any AccountsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        transactions: (any TransactionsRepository)? = nil,
        accounts: (any AccountsRepository)? = nil
    ) {
        self.transactionsRepository = transactions
        self.accountsRepository = accounts
    }

    public var expenseTotal: Money {
        transactions.filter { $0.kind == .debit }.reduce(Money.zero) { $0.adding($1.amount) }
    }

    public var incomeTotal: Money {
        transactions.filter { $0.kind == .credit }.reduce(Money.zero) { $0.adding($1.amount) }
    }

    public var byCategory: [(name: String, amount: Money)] {
        var map: [String: Decimal] = [:]
        for tx in transactions where tx.kind == .debit {
            map[tx.category ?? "Outros", default: 0] += tx.amount.amount
        }
        return map
            .map { (name: $0.key, amount: Money(amount: $0.value)) }
            .sorted { $0.amount.amount > $1.amount.amount }
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
        guard let transactionsRepository else {
        state = .empty
            return
        }
        do {
            let current = YearMonth(from: Date())
            var collected: [Transaction] = []
            async let accountsTask = accountsRepository?.fetchAccounts(force: force) ?? []
            for offset in 0..<months.rawValue {
                let month = current.adding(months: -offset)
                let loaded = try await transactionsRepository.fetchTransactions(
                    accountId: accountId,
                    month: month,
                    force: force
                )
                collected.append(contentsOf: loaded)
            }
            accounts = try await accountsTask
            transactions = collected
            csvURL = writeCSV(collected)
            state = transactions.isEmpty ? .empty : .loaded(transactions)
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

    private func writeCSV(_ rows: [Transaction]) -> URL? {
        var lines = ["data,descricao,categoria,tipo,valor"]
        for tx in rows {
            let desc = tx.description.replacingOccurrences(of: ",", with: " ")
            lines.append("\(tx.date.isoString),\(desc),\(tx.category ?? ""),\(tx.kind.rawValue),\(tx.amount.amount)")
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("relatorio.csv")
        try? lines.joined(separator: "\n").data(using: .utf8)?.write(to: url)
        return url
    }
}
