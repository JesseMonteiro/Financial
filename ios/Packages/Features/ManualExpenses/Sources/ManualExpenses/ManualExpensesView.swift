import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct ManualExpensesView: View {
    @State private var viewModel: ManualExpensesViewModel
    @State private var showEditor = false

    public init(
        repository: any ManualExpensesRepository,
        accounts: (any AccountsRepository)? = nil
    ) {
        _viewModel = State(initialValue: ManualExpensesViewModel(repository: repository, accounts: accounts))
    }

    public init() {
        _viewModel = State(initialValue: ManualExpensesViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                BrandLoadingView()
            case .empty:
                EmptyState(
                    title: "Sem despesas manuais",
                    message: "Lance gastos que não vieram do Open Finance.",
                    systemImage: "plus.circle",
                    actionTitle: "Nova despesa",
                    action: { showEditor = true }
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .navigationTitle("Despesas Manuais")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showEditor = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showEditor) {
            NavigationStack {
                Form {
                    TextField("Descrição", text: $viewModel.draftDescription)
                    TextField("Valor", text: $viewModel.draftAmount)
                    TextField("Categoria", text: $viewModel.draftCategory)
                    DatePicker("Data", selection: $viewModel.draftDate, displayedComponents: .date)
                    Toggle("Recorrente", isOn: $viewModel.draftRecurring)
                    if !viewModel.accounts.isEmpty {
                        Picker("Conta", selection: $viewModel.draftAccountId) {
                            Text("Nenhuma").tag(Optional<String>.none)
                            ForEach(viewModel.accounts) { account in
                                Text(account.name).tag(Optional(account.id))
                            }
                        }
                    }
                }
                .navigationTitle("Nova despesa")
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
                LabeledContent("Em aberto", value: viewModel.unpaidTotal.formatted())
            }
            ForEach(viewModel.expenses) { expense in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(expense.description).font(.headline)
                        Text("\(expense.date.formatted()) · \(expense.category ?? "Outros")")
                            .font(.caption)
                            .foregroundStyle(FinancialColors.textSecondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text(expense.amount.formatted())
                        Text(expense.isPaid ? "Pago" : "Pendente")
                            .font(.caption2)
                            .foregroundStyle(expense.isPaid ? FinancialColors.success : FinancialColors.warning)
                    }
                }
                .swipeActions(edge: .leading) {
                    Button {
                        Task { await viewModel.togglePaid(expense) }
                    } label: {
                        Label(expense.isPaid ? "Reabrir" : "Pago", systemImage: "checkmark")
                    }
                    .tint(FinancialColors.success)
                }
                .swipeActions {
                    Button(role: .destructive) {
                        Task { await viewModel.delete(expense) }
                    } label: {
                        Label("Excluir", systemImage: "trash")
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { ManualExpensesView() }
}
