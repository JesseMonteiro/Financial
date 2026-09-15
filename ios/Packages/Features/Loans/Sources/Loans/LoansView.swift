import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct LoansView: View {
    @State private var viewModel: LoansViewModel

    public init(repository: any LoansRepository) {
        _viewModel = State(initialValue: LoansViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: LoansViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .summaryList)
            case .empty:
                EmptyState(
                    title: "Sem empréstimos",
                    message: "Parcelas e saldos devedores aparecerão após sincronizar o Open Finance.",
                    systemImage: "building.columns"
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .meuFluxPageTitle("Empréstimos")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
    }

    private var content: some View {
        List {
            Section {
                LabeledContent("Saldo devedor", value: viewModel.outstandingTotal.formatted())
            }
            ForEach(viewModel.loans) { loan in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(loan.name).font(.headline)
                        Spacer()
                        Text(loan.outstandingBalance.formatted())
                            .font(.body.weight(.semibold))
                    }
                    ProgressView(value: viewModel.progress(for: loan))
                    HStack {
                        if let installment = loan.installmentAmount {
                            Text("Parcela \(installment.formatted())")
                        }
                        Spacer()
                        if let due = loan.nextDueDate {
                            Text("Vence \(due.formatted())")
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textSecondary)
                }
                .padding(.vertical, 4)
            }
        }
    }
}

#Preview {
    NavigationStack { LoansView() }
}
