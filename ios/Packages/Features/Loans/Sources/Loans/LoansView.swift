import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct LoansView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            case .empty:
                EmptyState(
                    title: "Sem empréstimos",
                    message: "Parcelas e saldos devedores aparecerão após sincronizar o Open Finance.",
                    systemImage: "building.columns"
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
        .meuFluxPageTitle("Empréstimos")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
    }

    private var content: some View {
        List {
            Section {
                LabeledContent("Saldo devedor", value: viewModel.outstandingTotal.formatted())
            }
            .cardEntrance(index: 0)
            ForEach(Array(viewModel.loans.enumerated()), id: \.element.id) { index, loan in
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
                .cardEntrance(index: index + 1)
                .padding(.vertical, 4)
            }
        }
    }
}

#Preview {
    NavigationStack { LoansView() }
}
