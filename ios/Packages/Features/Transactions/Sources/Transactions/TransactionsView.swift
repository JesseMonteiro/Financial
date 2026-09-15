import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct TransactionsView: View {
    @State private var viewModel: TransactionsViewModel
    @State private var showFilters = false
    @State private var selectedDetail: LineItemDetail?

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
                    PageLoadingSkeleton(style: .list)
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
        .meuFluxPageTitle("Transações")
        .searchable(text: $viewModel.searchText, prompt: "Buscar descrição ou categoria")
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.selectedAccountId ?? "all") {
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
                        }
                    }
                }
            }
        }
        .sheet(item: $selectedDetail) { item in
            LineItemDetailSheet(
                item: item,
                categoryOptions: viewModel.categoryOptions,
                onChangeCategory: { option in
                    Task {
                        await viewModel.changeCategory(transactionId: item.sourceId, option: option)
                        selectedDetail = item.applyingCategory(option: option)
                    }
                }
            )
        }
    }

    @ViewBuilder
    private var content: some View {
        let rows = viewModel.filteredTransactions
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if rows.isEmpty {
                    EmptyState(
                        title: "Nenhuma transação encontrada",
                        message: "Ajuste a busca ou os filtros.",
                        systemImage: "magnifyingglass"
                    )
                } else {
                    GlassCard {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("\(rows.count) lançamentos")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MeuFluxColors.textMuted)
                                .padding(.bottom, 8)
                            ForEach(Array(rows.enumerated()), id: \.element.id) { index, tx in
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
                                    badge: tx.category.map(LineItemDetail.translatedCategory),
                                    isPending: tx.isPending,
                                    action: {
                                        selectedDetail = viewModel.detail(for: tx)
                                    }
                                )
                                if index < rows.count - 1 {
                                    Divider().opacity(0.35)
                                }
                            }
                        }
                    }
                }
            }
            .meuFluxPageGutter()
        }
    }
}

#Preview {
    NavigationStack { TransactionsView() }
}
