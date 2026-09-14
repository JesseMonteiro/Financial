import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct AgendaView: View {
    @State private var viewModel: AgendaViewModel

    public init(repository: any AgendaRepository) {
        _viewModel = State(initialValue: AgendaViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: AgendaViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .summaryList)
            case .empty:
                EmptyState(
                    title: "Agenda vazia",
                    message: "Vencimentos de faturas, empréstimos e despesas do mês.",
                    systemImage: "calendar"
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .financialPageTitle("Agenda")
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.selectedMonth.key) { await viewModel.load() }
    }

    private var content: some View {
        List {
            Section {
                LabeledContent("Em aberto", value: viewModel.openTotal.formatted())
                Picker("Filtro", selection: $viewModel.filter) {
                    ForEach(AgendaViewModel.Filter.allCases) { filter in
                        Text(filter.rawValue).tag(filter)
                    }
                }
                .pickerStyle(.segmented)
            }
            ForEach(viewModel.filtered) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title).font(.headline)
                        Text("\(item.date.formatted()) · \(item.kind.rawValue)")
                            .font(.caption)
                            .foregroundStyle(FinancialColors.textSecondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        if let amount = item.amount {
                            Text(amount.formatted())
                        }
                        Text(item.isCompleted ? "Pago" : "Pendente")
                            .font(.caption2)
                            .foregroundStyle(item.isCompleted ? FinancialColors.success : FinancialColors.warning)
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { AgendaView() }
}
