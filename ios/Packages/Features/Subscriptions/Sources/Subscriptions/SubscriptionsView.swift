import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct SubscriptionsView: View {
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
            case .empty:
                EmptyState(
                    title: "Sem assinaturas",
                    message: "Recorrências detectadas nas transações e despesas manuais aparecem aqui.",
                    systemImage: "arrow.triangle.2.circlepath"
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .meuFluxPageTitle("Assinaturas")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
    }

    private var content: some View {
        List {
            Section {
                LabeledContent("Estimativa mensal", value: viewModel.monthlyTotal.formatted())
            }
            ForEach(viewModel.subscriptions) { sub in
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
            }
        }
    }
}

#Preview {
    NavigationStack { SubscriptionsView() }
}
