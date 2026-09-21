import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct SubscriptionsView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel: SubscriptionsViewModel

    public init(repository: any SubscriptionsRepository) {
        _viewModel = State(initialValue: SubscriptionsViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: SubscriptionsViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .summaryList)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            case .empty:
                EmptyState(
                    title: "Sem assinaturas",
                    message: "Recorrências detectadas nas transações e despesas manuais aparecem aqui.",
                    systemImage: "arrow.triangle.2.circlepath"
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
        .meuFluxPageTitle("Assinaturas")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
    }

    private var content: some View {
        List {
            Section {
                LabeledContent("Estimativa mensal", value: viewModel.monthlyTotal.formatted())
            }
            .cardEntrance(index: 0)
            ForEach(Array(viewModel.subscriptions.enumerated()), id: \.element.id) { index, sub in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(sub.name).font(.headline)
                        Text([sub.category, sub.billingDay.map { "Dia \($0)" }].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                    Spacer()
                    Text(sub.amount.formatted())
                }
                .cardEntrance(index: index + 1)
            }
        }
    }
}

#Preview {
    NavigationStack { SubscriptionsView() }
}
