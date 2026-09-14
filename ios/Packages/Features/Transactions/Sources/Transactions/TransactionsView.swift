import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct TransactionsView: View {
    @State private var viewModel: TransactionsViewModel
    @State private var showFilters = false

    public init(
        transactions: any TransactionsRepository,
        accounts: any AccountsRepository
    ) {
        _viewModel = State(
            initialValue: TransactionsViewModel(
                transactionsRepository: transactions,
                accountsRepository: accounts
            )
        )
    }

    public init() {
        _viewModel = State(initialValue: TransactionsViewModel())
    }

    public var body: some View {
        PageChrome {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    BrandLoadingView()
                case .empty:
                    EmptyState(
                        title: "Sem transações",
                        message: "As movimentações sincronizadas das suas contas aparecem aqui.",
                        systemImage: "arrow.left.arrow.right"
                    )
                case .failed(let message):
                    ErrorState(message: message) {
                        Task { await viewModel.retry() }
                    }
                case .loaded:
                    content
                }
            }
        }
        .navigationTitle("Transações")
        .searchable(text: $viewModel.searchText, prompt: "Buscar descrição ou categoria")
        .refreshable { await viewModel.load(force: true) }
        .task(id: "\(viewModel.selectedMonth?.key ?? "all")-\(viewModel.selectedAccountId ?? "all")") {
            await viewModel.load()
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showFilters = true } label: { Image(systemName: "line.3.horizontal.decrease.circle") }
            }
            if let url = viewModel.csvURL {
                ToolbarItem(placement: .secondaryAction) {
                    ShareLink("Exportar CSV", item: url)
                }
            }
        }
        .sheet(isPresented: $showFilters) {
            NavigationStack {
                Form {
                    Picker("Mês", selection: $viewModel.selectedMonth) {
                        Text("Todos").tag(Optional<YearMonth>.none)
                        ForEach((-6...1).map { YearMonth(from: Date()).adding(months: $0) }, id: \.key) { month in
                            Text(month.displayName()).tag(Optional(month))
                        }
                    }
                    Picker("Conta", selection: $viewModel.selectedAccountId) {
                        Text("Todas").tag(Optional<String>.none)
                        ForEach(viewModel.accounts) { account in
                            Text(account.name).tag(Optional(account.id))
                        }
                    }
                    Picker("Tipo", selection: $viewModel.selectedKind) {
                        Text("Todos").tag(Optional<TransactionKind>.none)
                        Text("Saída").tag(Optional(TransactionKind.debit))
                        Text("Entrada").tag(Optional(TransactionKind.credit))
                    }
                    Picker("Categoria", selection: $viewModel.selectedCategory) {
                        Text("Todas").tag(Optional<String>.none)
                        ForEach(viewModel.categories, id: \.self) { category in
                            Text(category).tag(Optional(category))
                        }
                    }
                }
                .navigationTitle("Filtros")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Limpar") { viewModel.clearFilters() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Aplicar") {
                            viewModel.refreshCSV()
                            showFilters = false
                            Task { await viewModel.load(force: true) }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        let rows = viewModel.filteredTransactions
        if rows.isEmpty {
            EmptyState(
                title: "Nenhuma transação encontrada",
                message: "Ajuste a busca ou os filtros.",
                systemImage: "magnifyingglass"
            )
        } else {
            List {
                Section {
                    ForEach(rows) { tx in
                        TransactionRow(
                            title: tx.description,
                            subtitle: [
                                tx.date.formatted(),
                                viewModel.accountName(for: tx)
                            ]
                            .compactMap { $0 }
                            .joined(separator: " · "),
                            amountText: tx.amount.formatted(),
                            isCredit: tx.kind == .credit,
                            badge: tx.category,
                            isPending: tx.isPending
                        )
                        .listRowBackground(FinancialColors.bgSecondary)
                    }
                } header: {
                    Text("\(rows.count) lançamentos")
                }
            }
            #if os(iOS)
            .listStyle(.insetGrouped)
            #else
            .listStyle(.inset)
            #endif
            .scrollContentBackground(.hidden)
        }
    }
}

#Preview {
    NavigationStack { TransactionsView() }
}
