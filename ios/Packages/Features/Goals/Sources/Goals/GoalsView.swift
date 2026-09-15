import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct GoalsView: View {
    @State private var viewModel: GoalsViewModel
    @State private var showEditor = false

    public init(repository: any GoalsRepository) {
        _viewModel = State(initialValue: GoalsViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: GoalsViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .list)
            case .empty:
                EmptyState(
                    title: "Nenhuma meta",
                    message: "Crie metas financeiras para acompanhar o progresso.",
                    systemImage: "target",
                    actionTitle: "Nova meta",
                    action: { showEditor = true }
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .meuFluxPageTitle("Metas")
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
                    TextField("Nome", text: $viewModel.draftName)
                    TextField("Valor alvo", text: $viewModel.draftTarget)
                    TextField("Já guardado", text: $viewModel.draftCurrent)
                    DatePicker("Prazo", selection: $viewModel.draftDeadline, displayedComponents: .date)
                }
                .navigationTitle("Nova meta")
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
            ForEach(viewModel.goals) { goal in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(goal.name).font(.headline)
                        Spacer()
                        Text(goal.current.formatted())
                    }
                    ProgressView(value: NSDecimalNumber(decimal: min(1, max(0, goal.progress))).doubleValue)
                    HStack {
                        Text("Meta \(goal.target.formatted())")
                        Spacer()
                        if let deadline = goal.deadline {
                            Text(deadline.formatted())
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textSecondary)
                }
                .swipeActions {
                    Button(role: .destructive) {
                        Task { await viewModel.delete(goal) }
                    } label: {
                        Label("Excluir", systemImage: "trash")
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { GoalsView() }
}
