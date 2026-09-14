import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct BudgetView: View {
    @State private var viewModel: BudgetViewModel
    @State private var showEditor = false

    public init(
        repository: any BudgetRepository,
        transactions: (any TransactionsRepository)? = nil
    ) {
        _viewModel = State(initialValue: BudgetViewModel(repository: repository, transactions: transactions))
    }

    public init() {
        _viewModel = State(initialValue: BudgetViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                BrandLoadingView()
            case .empty:
                EmptyState(
                    title: "Sem orçamento",
                    message: "Defina limites por categoria para acompanhar o mês.",
                    systemImage: "chart.pie",
                    actionTitle: "Adicionar categoria",
                    action: { showEditor = true }
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .navigationTitle("Orçamento")
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.selectedMonth.key) { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showEditor = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showEditor) {
            NavigationStack {
                Form {
                    TextField("Categoria", text: $viewModel.draftCategory)
                    TextField("Limite (R$)", text: $viewModel.draftLimit)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                }
                .navigationTitle("Nova categoria")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { showEditor = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Salvar") {
                            Task {
                                await viewModel.saveDraft()
                                showEditor = false
                            }
                        }
                    }
                }
            }
        }
    }

    private var content: some View {
        List {
            Section {
                LabeledContent("Gasto", value: viewModel.spentTotal.formatted())
                LabeledContent("Limite", value: viewModel.limitTotal.formatted())
            }
            Section("Categorias") {
                ForEach(viewModel.limits) { limit in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(limit.category)
                            Spacer()
                            Text("\(limit.spent.formatted()) / \(limit.limit.formatted())")
                                .font(.caption)
                                .foregroundStyle(FinancialColors.textSecondary)
                        }
                        ProgressView(value: NSDecimalNumber(decimal: min(1, max(0, limit.utilization))).doubleValue)
                    }
                    .swipeActions {
                        Button(role: .destructive) {
                            Task { await viewModel.delete(limit) }
                        } label: {
                            Label("Excluir", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { BudgetView() }
}
