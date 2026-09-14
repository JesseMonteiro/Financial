import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct ReportsView: View {
    @State private var viewModel: ReportsViewModel

    public init(repository: any ReportsRepository) {
        _viewModel = State(initialValue: ReportsViewModel(reports: repository))
    }

    public init() {
        _viewModel = State(initialValue: ReportsViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .dashboard)
            case .empty:
                EmptyState(
                    title: "Sem relatório",
                    message: "Conecte contas para ver categorias, fluxo e tendências.",
                    systemImage: "chart.bar.xaxis"
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .financialPageTitle("Relatórios")
        .refreshable { await viewModel.load(force: true) }
        .task(id: "\(viewModel.months.rawValue)-\(viewModel.accountId ?? "all")") {
            await viewModel.load()
        }
        .toolbar {
            if let url = viewModel.csvURL {
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: url) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
    }

    private var content: some View {
        List {
            Section("Período") {
                Picker("Janela", selection: $viewModel.months) {
                    ForEach(ReportsViewModel.Window.allCases) { window in
                        Text(window.title).tag(window)
                    }
                }
                .pickerStyle(.segmented)
                if !viewModel.accounts.isEmpty {
                    Picker("Conta", selection: $viewModel.accountId) {
                        Text("Todas").tag(Optional<String>.none)
                        ForEach(viewModel.accounts) { account in
                            Text(account.name).tag(Optional(account.id))
                        }
                    }
                }
            }
            Section("Resumo") {
                LabeledContent("Receitas", value: viewModel.incomeTotal.formatted())
                LabeledContent("Despesas", value: viewModel.expenseTotal.formatted())
            }
            Section("Por categoria") {
                ForEach(viewModel.byCategory, id: \.name) { row in
                    HStack {
                        Text(row.name)
                        Spacer()
                        Text(row.amount.formatted())
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { ReportsView() }
}
