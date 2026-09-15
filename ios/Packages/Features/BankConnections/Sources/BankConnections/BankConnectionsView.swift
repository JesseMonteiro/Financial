import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct BankConnectionsView: View {
    @State private var viewModel: BankConnectionsViewModel
    @State private var pendingDelete: BankConnectionItem?

    public init(repository: any BankConnectionsRepository) {
        _viewModel = State(initialValue: BankConnectionsViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: BankConnectionsViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .list)
            case .empty:
                EmptyState(
                    title: "Nenhuma conexão",
                    message: "Conecte instituições via Open Finance (Pluggy).",
                    systemImage: "link",
                    actionTitle: "Conectar banco",
                    action: { Task { await viewModel.startConnect() } }
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .meuFluxPageTitle("Conexões Bancárias")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await viewModel.startConnect() }
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: Binding(
            get: { viewModel.connectToken != nil },
            set: { if !$0 { viewModel.connectToken = nil; viewModel.isConnecting = false } }
        )) {
            if let token = viewModel.connectToken {
                NavigationStack {
                    PluggyConnectView(connectToken: token) { itemId in
                        Task { await viewModel.finishConnect(itemId: itemId) }
                    }
                    .navigationTitle("Pluggy Connect")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Fechar") {
                                viewModel.connectToken = nil
                                viewModel.isConnecting = false
                            }
                        }
                    }
                }
            }
        }
        .confirmationDialog("Remover conexão?", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )) {
            Button("Remover", role: .destructive) {
                if let item = pendingDelete {
                    Task { await viewModel.delete(item) }
                }
                pendingDelete = nil
            }
            Button("Cancelar", role: .cancel) { pendingDelete = nil }
        }
    }

    private var content: some View {
        List {
            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.danger)
            }
            ForEach(viewModel.items) { item in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(item.institutionName).font(.headline)
                        Spacer()
                        Text(item.status)
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                    if let execution = item.executionStatus {
                        Text(execution)
                            .font(.caption2)
                            .foregroundStyle(MeuFluxColors.warning)
                    }
                    HStack {
                        Button("Sincronizar") {
                            Task { await viewModel.sync(item) }
                        }
                        .disabled(viewModel.syncingIDs.contains(item.id))
                        Spacer()
                        Button("Remover", role: .destructive) {
                            pendingDelete = item
                        }
                    }
                    .font(.caption)
                }
                .padding(.vertical, 4)
            }
        }
    }
}

#Preview {
    NavigationStack { BankConnectionsView() }
}
