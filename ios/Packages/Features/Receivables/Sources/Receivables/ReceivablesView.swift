import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct ReceivablesView: View {
    @State private var viewModel: ReceivablesViewModel
    @State private var showEditor = false

    public init(repository: any ReceivablesRepository) {
        _viewModel = State(initialValue: ReceivablesViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: ReceivablesViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                BrandLoadingView()
            case .empty:
                EmptyState(
                    title: "Nada a receber",
                    message: "Registre valores pendentes de clientes ou parceiros.",
                    systemImage: "hand.raised",
                    actionTitle: "Novo recebível",
                    action: { showEditor = true }
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .navigationTitle("Valores a Receber")
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
                    TextField("Pessoa", text: $viewModel.draftPerson)
                    TextField("Descrição", text: $viewModel.draftDescription)
                    TextField("Valor total", text: $viewModel.draftAmount)
                    TextField("Parcelas", text: $viewModel.draftInstallments)
                }
                .navigationTitle("Novo recebível")
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
                LabeledContent("Em aberto", value: viewModel.totalOpen.formatted())
            }
            ForEach(viewModel.grouped, id: \.person) { group in
                Section(group.person) {
                    ForEach(group.items) { item in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(item.description).font(.headline)
                                Spacer()
                                Text(item.amount.formatted())
                            }
                            Text("\(item.paidInstallments)/\(item.installments) parcelas")
                                .font(.caption)
                                .foregroundStyle(FinancialColors.textSecondary)
                        }
                        .swipeActions(edge: .leading) {
                            if !item.isReceived {
                                Button {
                                    Task { await viewModel.markReceived(item) }
                                } label: {
                                    Label("Recebido", systemImage: "checkmark")
                                }
                                .tint(FinancialColors.success)
                            }
                        }
                        .swipeActions {
                            Button(role: .destructive) {
                                Task { await viewModel.delete(item) }
                            } label: {
                                Label("Excluir", systemImage: "trash")
                            }
                        }
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { ReceivablesView() }
}
