import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct ReportsView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            case .empty:
                EmptyState(
                    title: "Sem relatório",
                    message: "Conecte contas para ver categorias, fluxo e tendências.",
                    systemImage: "chart.bar.xaxis"
                )
                .transition(.opacity)
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
                    .transition(.opacity)
            case .loaded:
                content
                    .transition(.opacity)
            }
        }
        .animation(reduceMotion ? nil : MotionTokens.stateTransition, value: viewModel.state.stage)
        .meuFluxPageTitle("Relatórios")
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
            .cardEntrance(index: 0)
            Section("Resumo") {
                LabeledContent("Receitas", value: viewModel.incomeTotal.formatted())
                LabeledContent("Despesas", value: viewModel.expenseTotal.formatted())
            }
            .cardEntrance(index: 1)
            Section("Por categoria") {
                ForEach(viewModel.byCategory, id: \.name) { row in
                    HStack {
                        Text(row.name)
                        Spacer()
                        Text(row.amount.formatted())
                    }
                }
            }
            .cardEntrance(index: 2)
        }
    }
}

#Preview {
    NavigationStack { ReportsView() }
}
