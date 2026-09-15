import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct AgendaView: View {
    @State private var viewModel: AgendaViewModel
    @State private var selectedDetail: LineItemDetail?

    public init(
        repository: any AgendaRepository,
        togglePaid: (any ToggleManualExpensePaidUseCase)? = nil
    ) {
        _viewModel = State(initialValue: AgendaViewModel(repository: repository, togglePaid: togglePaid))
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
        .meuFluxPageTitle("Agenda")
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.selectedMonth.key) { await viewModel.load() }
        .sheet(item: $selectedDetail) { item in
            LineItemDetailSheet(
                item: item,
                onTogglePaid: {
                    if let agenda = viewModel.filtered.first(where: { $0.id == item.id })
                        ?? viewModel.items.first(where: { $0.id == item.id }) {
                        Task {
                            await viewModel.toggleCustomPaid(agenda)
                            selectedDetail = nil
                        }
                    }
                }
            )
        }
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
                Button {
                    selectedDetail = LineItemDetail.from(agenda: item)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title).font(.headline)
                            Text("\(item.date.formatted()) · \(item.kind.rawValue)")
                                .font(.caption)
                                .foregroundStyle(MeuFluxColors.textSecondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            if let amount = item.amount {
                                Text(amount.formatted())
                            }
                            Text(item.isCompleted ? "Pago" : "Pendente")
                                .font(.caption2)
                                .foregroundStyle(item.isCompleted ? MeuFluxColors.success : MeuFluxColors.warning)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
}

#Preview {
    NavigationStack { AgendaView() }
}
