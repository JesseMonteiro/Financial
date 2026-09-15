import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct InvestmentsView: View {
    @State private var viewModel: InvestmentsViewModel

    public init(
        repository: any InvestmentsRepository,
        jointRepository: (any JointFinanceRepository)? = nil,
        hasJointLink: Bool = false
    ) {
        _viewModel = State(initialValue: InvestmentsViewModel(
            repository: repository,
            jointRepository: jointRepository,
            hasJointLink: hasJointLink
        ))
    }

    public init() {
        _viewModel = State(initialValue: InvestmentsViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .summaryList)
            case .empty:
                EmptyState(
                    title: "Sem investimentos",
                    message: "Posições aparecerão depois de conectar um banco com investimentos.",
                    systemImage: "chart.line.uptrend.xyaxis"
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .meuFluxPageTitle("Investimentos")
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.scope) { await viewModel.load() }
        .toolbar {
            if viewModel.hasJointLink {
                ToolbarItem(placement: .primaryAction) {
                    Picker("Escopo", selection: $viewModel.scope) {
                        ForEach(InvestmentsViewModel.Scope.allCases) { scope in
                            Text(scope.rawValue).tag(scope)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 220)
                }
            }
        }
    }

    private var content: some View {
        List {
            Section {
                LabeledContent("Total da carteira", value: viewModel.total.formatted())
                    .font(.headline)
            }
            if !viewModel.allocation.isEmpty {
                Section("Alocação") {
                    ForEach(viewModel.allocation, id: \.type) { row in
                        HStack {
                            Text(row.type)
                            Spacer()
                            Text(row.amount.formatted())
                                .foregroundStyle(MeuFluxColors.textSecondary)
                        }
                    }
                }
            }
            Section("Posições") {
                ForEach(viewModel.investments) { inv in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(inv.name).font(.headline)
                            Spacer()
                            Text(inv.balance.formatted()).font(.body.weight(.semibold))
                        }
                        Text([inv.type, inv.issuer, inv.ownerLabel].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { InvestmentsView() }
}
