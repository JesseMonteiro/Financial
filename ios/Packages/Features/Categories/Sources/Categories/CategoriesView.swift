import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct CategoriesView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel: CategoriesViewModel
    @State private var showEditor = false

    public init(repository: any PurchaseCategoriesRepository) {
        _viewModel = State(initialValue: CategoriesViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: CategoriesViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .list)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            case .empty:
                EmptyState(
                    title: "Nenhuma categoria",
                    message: "Crie categorias para classificar compras e despesas manuais.",
                    systemImage: "tag",
                    actionTitle: "Nova categoria",
                    action: {
                        viewModel.beginCreate()
                        showEditor = true
                    }
                )
                .transition(.opacity)
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
                    .transition(.opacity)
            case .loaded:
                content
                    .transition(reduceMotion ? .opacity : .asymmetric(
                        insertion: .opacity.combined(with: .move(edge: .bottom).combined(with: .scale(scale: 0.98))),
                        removal: .opacity
                    ))
            }
        }
        .animation(MotionTokens.stateTransition, value: viewModel.state.stage)
        .meuFluxPageTitle("Categorias")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.beginCreate()
                    showEditor = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nova categoria")
            }
        }
        .sheet(isPresented: $showEditor) {
            NavigationStack {
                Form {
                    TextField("Nome", text: $viewModel.draftLabel)
                    Section("Cor") {
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 5), spacing: 12) {
                            ForEach(PurchaseCategoryCatalog.presetColors, id: \.self) { preset in
                                Circle()
                                    .fill(Color(hexString: preset) ?? MeuFluxColors.primary)
                                    .frame(width: 28, height: 28)
                                    .overlay {
                                        if viewModel.draftColor == preset {
                                            Circle().strokeBorder(MeuFluxColors.textPrimary, lineWidth: 2)
                                        }
                                    }
                                    .onTapGesture { viewModel.draftColor = preset }
                                    .accessibilityLabel("Cor \(preset)")
                            }
                        }
                    }
                    Section("Ícone") {
                        let tint = Color(hexString: viewModel.draftColor) ?? MeuFluxColors.primary
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 10) {
                            ForEach(CategoryIconCatalog.options) { option in
                                Image(systemName: option.systemImage)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(tint)
                                    .frame(width: 36, height: 36)
                                    .background(tint.opacity(0.14), in: Circle())
                                    .overlay {
                                        if viewModel.draftIcon == option.id {
                                            Circle()
                                                .strokeBorder(MeuFluxColors.textPrimary, lineWidth: 2)
                                        }
                                    }
                                    .onTapGesture { viewModel.draftIcon = option.id }
                                    .accessibilityLabel(option.label)
                                    .accessibilityAddTraits(viewModel.draftIcon == option.id ? .isSelected : [])
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .navigationTitle(viewModel.editingID == nil ? "Nova categoria" : "Editar categoria")
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
            ForEach(Array(viewModel.categories.enumerated()), id: \.element.id) { index, category in
                HStack(spacing: 12) {
                    let tint = Color(hexString: category.color ?? "#64748b") ?? MeuFluxColors.primary
                    Image(systemName: PurchaseCategoryCatalog.systemImage(for: category.key, in: [category]))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(tint)
                        .frame(width: 32, height: 32)
                        .background(tint.opacity(0.14), in: Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(category.label).font(.headline)
                        Text(category.key)
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                    Spacer()
                }
                .contentShape(Rectangle())
                .cardEntrance(index: index)
                .onTapGesture {
                    viewModel.beginEdit(category)
                    showEditor = true
                }
                .swipeActions {
                    Button(role: .destructive) {
                        Task { await viewModel.delete(category) }
                    } label: {
                        Label("Excluir", systemImage: "trash")
                    }
                    Button {
                        viewModel.beginEdit(category)
                        showEditor = true
                    } label: {
                        Label("Editar", systemImage: "pencil")
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { CategoriesView() }
}
