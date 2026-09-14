import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct AccountsView: View {
    @State private var viewModel: AccountsViewModel
    @State private var showManualEditor = false
    private let onConnect: (() -> Void)?

    public init(repository: any AccountsRepository, onConnect: (() -> Void)? = nil) {
        _viewModel = State(initialValue: AccountsViewModel(repository: repository))
        self.onConnect = onConnect
    }

    public init() {
        _viewModel = State(initialValue: AccountsViewModel())
        self.onConnect = nil
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                BrandLoadingView()
            case .empty:
                EmptyState(
                    title: "Nenhuma conta",
                    message: "Conecte um banco ou cadastre uma conta manual.",
                    systemImage: "wallet.pass",
                    actionTitle: onConnect == nil ? nil : "Conectar banco",
                    action: onConnect
                )
            case .failed(let message):
                ErrorState(message: message) {
                    Task { await viewModel.retry() }
                }
            case .loaded:
                content
            }
        }
        .navigationTitle("Contas & Saldos")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showManualEditor = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(item: $viewModel.renameTarget) { _ in
            NavigationStack {
                Form {
                    TextField("Nome", text: $viewModel.renameText)
                }
                .navigationTitle("Renomear")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { viewModel.renameTarget = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Salvar") {
                            Task { await viewModel.saveRename() }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showManualEditor) {
            NavigationStack {
                Form {
                    TextField("Nome", text: $viewModel.draftName)
                    TextField("Instituição", text: $viewModel.draftInstitution)
                    TextField("Saldo / fatura", text: $viewModel.draftBalance)
                    Toggle("Cartão de crédito", isOn: $viewModel.draftIsCredit)
                }
                .navigationTitle("Conta manual")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { showManualEditor = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Salvar") {
                            Task {
                                await viewModel.saveManual()
                                showManualEditor = false
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        List(viewModel.accounts) { account in
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(account.name).font(.headline)
                    Text(account.institutionName ?? account.type.rawValue)
                        .font(.caption)
                        .foregroundStyle(FinancialColors.textSecondary)
                }
                Spacer()
                Text(account.balance.formatted())
                    .font(.body.weight(.semibold))
            }
            .contentShape(Rectangle())
            .onTapGesture { viewModel.beginRename(account) }
            .swipeActions {
                if account.connectorId == nil || account.type == .manual {
                    Button(role: .destructive) {
                        Task { await viewModel.deleteManual(account) }
                    } label: {
                        Label("Excluir", systemImage: "trash")
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { AccountsView() }
}
