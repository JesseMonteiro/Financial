import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct NotificationHubSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: NotificationHubViewModel
    @State private var showConfirmDeleteAllIgnored = false
    private let onOpenReview: ((String) -> Void)?
    
    public init(
        importer: any NotificationImporting,
        onOpenReview: ((String) -> Void)? = nil
    ) {
        self._viewModel = State(initialValue: NotificationHubViewModel(importer: importer))
        self.onOpenReview = onOpenReview
    }
    
    public var body: some View {
        NavigationStack {
            ZStack {
                MeuFluxColors.bgSecondary.ignoresSafeArea()
                
                VStack(spacing: 0) {
                    filterScrollView
                    
                    Group {
                        switch viewModel.state {
                        case .idle, .loading:
                            PageLoadingSkeleton(style: .list)
                        case .empty:
                            EmptyState(
                                title: "Nenhuma Notificação",
                                message: "Você ainda não recebeu notificações de compras.",
                                systemImage: "bell.slash"
                            )
                        case .failed(let error):
                            ErrorState(message: error) {
                                Task { await viewModel.load() }
                            }
                        case .loaded:
                            recordsList
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("Central de Notificações")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .primaryAction) {
                    HStack(spacing: 12) {
                        if viewModel.selectedFilter == .ignored && !viewModel.filteredRecords.isEmpty {
                            Button(role: .destructive) {
                                showConfirmDeleteAllIgnored = true
                            } label: {
                                Text("Limpar Todas")
                                    .font(.subheadline.weight(.medium))
                                    .foregroundColor(MeuFluxColors.danger)
                            }
                        }

                        Button(action: {
                            Task { await viewModel.load() }
                        }) {
                            Image(systemName: "arrow.clockwise")
                                .foregroundColor(MeuFluxColors.primary)
                        }
                    }
                }
            }
            .confirmationDialog(
                "Excluir todas as notificações ignoradas?",
                isPresented: $showConfirmDeleteAllIgnored,
                titleVisibility: .visible
            ) {
                Button("Excluir Todas", role: .destructive) {
                    Task { await viewModel.deleteAllIgnored() }
                }
                Button("Cancelar", role: .cancel) {}
            } message: {
                Text("Esta ação removerá permanentemente as notificações ignoradas da lista.")
            }
            .task {
                await viewModel.load()
            }
        }
    }
    
    private var filterScrollView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(NotificationHubFilter.allCases) { filter in
                    filterButton(for: filter)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(MeuFluxColors.bgSecondary)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(MeuFluxColors.border)
                .opacity(0.5),
            alignment: .bottom
        )
    }
    
    private func filterButton(for filter: NotificationHubFilter) -> some View {
        let isSelected = viewModel.selectedFilter == filter
        let count: Int = {
            switch filter {
            case .all: return viewModel.counts.all
            case .imported: return viewModel.counts.imported
            case .ignored: return viewModel.counts.ignored
            case .pending: return viewModel.counts.pending
            }
        }()
        
        return Button(action: {
            withAnimation(MotionTokens.stateTransition) {
                viewModel.selectedFilter = filter
            }
        }) {
            HStack(spacing: 6) {
                Text(filter.rawValue)
                if count > 0 {
                    Text("\(count)")
                        .font(.caption.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(isSelected ? MeuFluxColors.bgSecondary : MeuFluxColors.primary.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
            .font(.subheadline.weight(isSelected ? .semibold : .medium))
            .foregroundColor(isSelected ? MeuFluxColors.bgSecondary : MeuFluxColors.textSecondary)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .frame(minHeight: 44)
            .background(
                Capsule()
                    .fill(isSelected ? MeuFluxColors.primary : Color.clear)
            )
            .overlay(
                Capsule()
                    .strokeBorder(isSelected ? Color.clear : MeuFluxColors.border, lineWidth: 1)
            )
        }
    }
    
    private var recordsList: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                if viewModel.filteredRecords.isEmpty {
                    EmptyState(
                        title: "Nenhum resultado",
                        message: "Não há notificações para este filtro.",
                        systemImage: "line.3.horizontal.decrease.circle"
                    )
                    .padding(.top, 40)
                } else {
                    ForEach(Array(viewModel.filteredRecords.enumerated()), id: \.element.id) { index, record in
                        NotificationRecordCard(
                            record: record,
                            isBusy: viewModel.busyRecordId == record.id,
                            onUndo: {
                                Task { await viewModel.undoImport(record) }
                            },
                            onReview: {
                                onOpenReview?(record.id)
                            },
                            onCreate: {
                                onOpenReview?(record.id)
                            },
                            onDelete: {
                                Task { await viewModel.deleteRecord(record) }
                            },
                            onIgnore: {
                                Task { await viewModel.ignoreRecord(record) }
                            }
                        )
                        .cardEntrance(index: index)
                    }
                }
            }
            .padding(16)
        }
    }
}

fileprivate struct NotificationRecordCard: View {
    let record: NotificationImportRecord
    let isBusy: Bool
    let onUndo: () -> Void
    let onReview: () -> Void
    let onCreate: () -> Void
    let onDelete: () -> Void
    let onIgnore: () -> Void
    
    @State private var isExpanded = false
    
    private var relativeTimeFormatter: RelativeDateTimeFormatter {
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateTimeStyle = .named
        return formatter
    }
    
    var body: some View {
        GlassCard(padding: 0) {
            VStack(alignment: .leading, spacing: 12) {
                // Header
                HStack {
                    if let parsed = record.parsed {
                        HStack(spacing: 6) {
                            Image(systemName: parsed.source.systemImage)
                            Text(parsed.source.displayName)
                        }
                        .font(.caption.weight(.medium))
                        .foregroundColor(MeuFluxColors.textSecondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(FrostedFill(cornerRadius: 6))
                    }
                    
                    Spacer()
                    
                    Text(relativeTimeFormatter.localizedString(for: record.createdAt, relativeTo: Date()))
                        .font(.caption)
                        .foregroundColor(MeuFluxColors.textMuted)
                }
                
                // Status Badge
                statusBadge
                
                // Main Info
                if let parsed = record.parsed {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(parsed.displayMerchant)
                            .font(.headline)
                            .foregroundColor(MeuFluxColors.textPrimary)
                        
                        Text(parsed.amount.formatted())
                            .font(.title3.bold())
                            .foregroundColor(MeuFluxColors.textPrimary)
                        
                        if let category = parsed.suggestedCategory {
                            Text(category)
                                .font(.footnote)
                                .foregroundColor(MeuFluxColors.textSecondary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(MeuFluxColors.border.opacity(0.3))
                                .clipShape(Capsule())
                        }
                    }
                } else {
                    Text("Dados não reconhecidos")
                        .font(.headline)
                        .foregroundColor(MeuFluxColors.textSecondary)
                        .italic()
                }
                
                // Expandable Raw Text
                DisclosureGroup(isExpanded: $isExpanded) {
                    Text(record.parsed?.combinedText ?? "Sem dados brutos")
                        .font(.caption)
                        .foregroundColor(MeuFluxColors.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(MeuFluxColors.bgSecondary)
                        .cornerRadius(8)
                        .padding(.top, 8)
                } label: {
                    Text("Ver texto original")
                        .font(.caption)
                        .foregroundColor(MeuFluxColors.primary)
                }
                .accentColor(MeuFluxColors.primary)
                
                Divider().background(MeuFluxColors.border)
                
                // Action Buttons
                actionsView
            }
            .padding(16)
        }
        .overlay(
            isBusy ? Color.black.opacity(0.1).cornerRadius(16) : nil
        )
        .overlay(
            isBusy ? ProgressView() : nil
        )
    }
    
    @ViewBuilder
    private var statusBadge: some View {
        let (text, color): (String, Color) = {
            switch record.status {
            case .imported:
                return ("Importada", MeuFluxColors.success)
            case .ignored:
                return ("Ignorada", MeuFluxColors.textMuted)
            case .skippedOpenFinance:
                return ("Pulada (Open Finance)", MeuFluxColors.textMuted)
            case .reconciledOpenFinance:
                return ("Reconciliada via Open Finance", MeuFluxColors.info)
            case .needsReview, .needsDestination, .queued:
                return ("Pendente", .orange) // Fallback color since not defined
            case .undone:
                return ("Desfeita", MeuFluxColors.textMuted)
            case .parseFailed:
                return ("Erro", MeuFluxColors.danger)
            }
        }()
        
        Text(text)
            .font(.caption.bold())
            .foregroundColor(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.1))
            .clipShape(Capsule())
    }
    
    @ViewBuilder
    private var actionsView: some View {
        HStack {
            switch record.status {
            case .imported:
                Button(role: .destructive, action: onUndo) {
                    Text("Desfazer")
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.bordered)
                .disabled(isBusy)
                
            case .ignored, .skippedOpenFinance:
                HStack(spacing: 8) {
                    Button(role: .destructive, action: onDelete) {
                        Label("Excluir", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(MeuFluxColors.danger)
                    .disabled(isBusy)
                    
                    Button(action: onCreate) {
                        Text("Criar Transação")
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isBusy)
                }
                
            case .needsReview, .needsDestination:
                HStack(spacing: 8) {
                    Button(action: onIgnore) {
                        Text("Ignorar")
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(MeuFluxColors.textSecondary)
                    .disabled(isBusy)
                    
                    Button(action: onReview) {
                        Text("Revisar")
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isBusy)
                }
                
            case .reconciledOpenFinance:
                HStack(spacing: 8) {
                    Text("Reconciliada via Open Finance")
                        .font(.caption)
                        .foregroundColor(MeuFluxColors.info)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    
                    Button(role: .destructive, action: onDelete) {
                        Label("Excluir", systemImage: "trash")
                            .frame(minHeight: 44)
                    }
                    .buttonStyle(.bordered)
                    .tint(MeuFluxColors.danger)
                    .disabled(isBusy)
                }
                
            default:
                Button(role: .destructive, action: onDelete) {
                    Label("Excluir", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44)
                }
                .buttonStyle(.bordered)
                .tint(MeuFluxColors.danger)
                .disabled(isBusy)
            }
        }
    }
}
