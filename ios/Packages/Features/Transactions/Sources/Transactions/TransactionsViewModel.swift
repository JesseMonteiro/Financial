import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

@Observable
@MainActor
public final class TransactionsViewModel {
    public private(set) var state: FeatureLoadState<[Transaction]> = .idle
    public private(set) var transactions: [Transaction] = []
    public private(set) var accountsById: [String: Account] = [:]
    public private(set) var pluggyCategories: [TransactionCategory] = []
    public var searchText: String = ""
    public var selectedMonth: YearMonth? = YearMonth(from: Date())
    public var selectedAccountId: String?
    public var selectedKind: TransactionKind?
    public var selectedCategory: String?
    public var errorMessage: String?
    public var csvURL: URL?

    private let transactionsRepository: (any TransactionsRepository)?
    private let accountsRepository: (any AccountsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        transactionsRepository: (any TransactionsRepository)? = nil,
        accountsRepository: (any AccountsRepository)? = nil
    ) {
        self.transactionsRepository = transactionsRepository
        self.accountsRepository = accountsRepository
    }

    public var accounts: [Account] {
        Array(accountsById.values).sorted { $0.name < $1.name }
    }

    public var categories: [String] {
        Array(Set(transactions.compactMap(\.category))).sorted()
    }

    public var categoryOptions: [LineItemCategoryOption] {
        LineItemCategoryOption.pluggyOptions(pluggyCategories)
    }

    public var filteredTransactions: [Transaction] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return transactions.filter { tx in
            if let selectedMonth, tx.date.yearMonth != selectedMonth { return false }
            if let selectedAccountId, tx.accountId != selectedAccountId { return false }
            if let selectedKind, tx.kind != selectedKind { return false }
            if let selectedCategory, tx.category != selectedCategory { return false }
            guard !query.isEmpty else { return true }
            return tx.description.lowercased().contains(query)
                || (tx.category?.lowercased().contains(query) ?? false)
        }
    }

    public func load(force: Bool = false) async {
        let cacheKey = "transactions:\(selectedAccountId ?? "all")"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) {
            if pluggyCategories.isEmpty {
                pluggyCategories = (try? await transactionsRepository?.fetchCategories(force: true)) ?? []
            }
            return
        }

        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        guard let transactionsRepository else {
            state = .empty
            return
        }
        do {
            async let accountsTask = accountsRepository?.fetchAccounts(force: force) ?? []
            async let txTask = transactionsRepository.fetchTransactions(
                accountId: selectedAccountId,
                month: nil,
                force: force
            )
            async let catsTask = transactionsRepository.fetchCategories(force: force)
            let (accounts, loaded) = try await (accountsTask, txTask)
            accountsById = Dictionary(uniqueKeysWithValues: accounts.map { ($0.id, $0) })
            transactions = loaded.sorted { $0.date > $1.date }
            pluggyCategories = (try? await catsTask) ?? []
            csvURL = writeCSV(filteredTransactions)
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

    public func retry() async {
        await load(force: true)
    }

    public func accountName(for transaction: Transaction) -> String? {
        accountsById[transaction.accountId]?.name
    }

    public func clearFilters() {
        selectedAccountId = nil
        selectedKind = nil
        selectedCategory = nil
        selectedMonth = YearMonth(from: Date())
    }

    public func refreshCSV() {
        csvURL = writeCSV(filteredTransactions)
    }

    public func changeCategory(transactionId: String, option: LineItemCategoryOption) async {
        guard let transactionsRepository else { return }
        do {
            try await transactionsRepository.updateCategory(id: transactionId, categoryId: option.id)
            if let index = transactions.firstIndex(where: { $0.id == transactionId }) {
                transactions[index].category = option.label
                transactions[index].categoryId = option.id
            }
            csvURL = writeCSV(filteredTransactions)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func detail(for transaction: Transaction) -> LineItemDetail {
        LineItemDetail.from(transaction: transaction, accountName: accountName(for: transaction))
    }

    private func writeCSV(_ rows: [Transaction]) -> URL? {
        var lines = ["data,descricao,conta,categoria,tipo,valor"]
        for tx in rows {
            let desc = tx.description.replacingOccurrences(of: ",", with: " ")
            let account = accountName(for: tx) ?? tx.accountId
            lines.append("\(tx.date.isoString),\(desc),\(account),\(tx.category ?? ""),\(tx.kind.rawValue),\(tx.amount.amount)")
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("transacoes.csv")
        try? lines.joined(separator: "\n").data(using: .utf8)?.write(to: url)
        return url
    }
}
