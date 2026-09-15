import SwiftUI
import MeuFluxDomain

public struct LineItemDetailSheet: View {
    public var item: LineItemDetail
    public var isBusy: Bool
    public var categoryOptions: [LineItemCategoryOption]
    public var onTogglePaid: (() -> Void)?
    public var onEdit: (() -> Void)?
    public var onDelete: (() -> Void)?
    public var onCreateReceivable: (() -> Void)?
    public var onChangeCategory: ((LineItemCategoryOption) -> Void)?

    @State private var confirmDelete = false
    @State private var selectedCategoryId: String
    @State private var sheetHeight: CGFloat = 520

    public init(
        item: LineItemDetail,
        isBusy: Bool = false,
        categoryOptions: [LineItemCategoryOption] = [],
        onTogglePaid: (() -> Void)? = nil,
        onEdit: (() -> Void)? = nil,
        onDelete: (() -> Void)? = nil,
        onCreateReceivable: (() -> Void)? = nil,
        onChangeCategory: ((LineItemCategoryOption) -> Void)? = nil
    ) {
        self.item = item
        self.isBusy = isBusy
        self.categoryOptions = categoryOptions
        self.onTogglePaid = onTogglePaid
        self.onEdit = onEdit
        self.onDelete = onDelete
        self.onCreateReceivable = onCreateReceivable
        self.onChangeCategory = onChangeCategory
        _selectedCategoryId = State(initialValue: item.resolvedCategorySelection(in: categoryOptions))
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(item.kindTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MeuFluxColors.textMuted)
            hero
            if !item.badges.isEmpty {
                WrappingHStack(spacing: 6, lineSpacing: 4) {
                    ForEach(item.badges, id: \.self) { badge in
                        StatusBadge(badge, style: badgeStyle(badge))
                    }
                }
            }
            metadata
            categoryPicker
            actions
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
        .background {
            GeometryReader { proxy in
                MeuFluxColors.bgPrimary
                    .preference(key: SheetHeightPreference.self, value: proxy.size.height)
            }
        }
        .background(MeuFluxColors.bgPrimary)
        .overlay {
            if isBusy {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(.ultraThinMaterial)
            }
        }
        .confirmationDialog(
            "Excluir este lançamento?",
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button("Excluir", role: .destructive) { onDelete?() }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("“\(item.title)” será removido.")
        }
        .presentationDetents([.height(sheetHeight + Self.grabberAllowance)])
        .presentationDragIndicator(.visible)
        .presentationSizing(.fitted)
        .presentationBackground {
            MeuFluxColors.bgPrimary.ignoresSafeArea()
        }
        .onPreferenceChange(SheetHeightPreference.self) { height in
            guard height > 0, abs(height - sheetHeight) > 1 else { return }
            sheetHeight = height
        }
        .onChange(of: item.categorySelectionId) { _, _ in
            selectedCategoryId = item.resolvedCategorySelection(in: categoryOptions)
        }
        .onChange(of: categoryOptions) { _, newValue in
            selectedCategoryId = item.resolvedCategorySelection(in: newValue)
        }
    }

    private static let grabberAllowance: CGFloat = 24

    private var hero: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.title)
                .font(.title3.weight(.bold))
                .foregroundStyle(MeuFluxColors.textPrimary)
            Text("\(item.isCredit ? "+" : "-") \(item.amount.formatted())")
                .font(.title2.weight(.heavy).monospacedDigit())
                .foregroundStyle(item.isCredit ? MeuFluxColors.success : MeuFluxColors.danger)
            if let status = item.statusLabel {
                Text(status)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var metadata: some View {
        VStack(spacing: 0) {
            ForEach(Array(item.metadata.enumerated()), id: \.offset) { index, row in
                HStack {
                    Text(row.label)
                        .font(.subheadline)
                        .foregroundStyle(MeuFluxColors.textMuted)
                    Spacer()
                    Text(row.value)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                        .multilineTextAlignment(.trailing)
                }
                .padding(.vertical, 10)
                if index < item.metadata.count - 1 {
                    Divider().opacity(0.4)
                }
            }
        }
        .padding(.horizontal, 12)
        .background(MeuFluxColors.bgSecondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        }
    }

    @ViewBuilder
    private var categoryPicker: some View {
        if canChangeCategory {
            VStack(alignment: .leading, spacing: 8) {
                Text("Categoria")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textMuted)
                Picker("Categoria", selection: $selectedCategoryId) {
                    if !categoryOptions.contains(where: { $0.id == selectedCategoryId }) {
                        Text(item.category ?? "Selecionar").tag(selectedCategoryId)
                    }
                    ForEach(categoryOptions) { option in
                        Text(option.label).tag(option.id)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)
                .onChange(of: selectedCategoryId) { _, newValue in
                    guard let option = categoryOptions.first(where: { $0.id == newValue }),
                          newValue != item.resolvedCategorySelection(in: categoryOptions) else { return }
                    onChangeCategory?(option)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(MeuFluxColors.bgSecondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(MeuFluxColors.border, lineWidth: 1)
            }
        }
    }

    @ViewBuilder
    private var actions: some View {
        VStack(spacing: 8) {
            if item.capabilities.contains(.togglePaid), onTogglePaid != nil, !item.isPaid || item.kind == .manualExpense {
                Button(item.paidActionTitle) { onTogglePaid?() }
                    .buttonStyle(.borderedProminent)
                    .tint(item.kind == .receivable ? MeuFluxColors.success : MeuFluxColors.primary)
                    .frame(maxWidth: .infinity)
                    .disabled(item.kind == .receivable && item.isPaid)
            }
            if item.capabilities.contains(.createReceivable), onCreateReceivable != nil {
                Button("Criar valor a receber") { onCreateReceivable?() }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
            }
            if item.capabilities.contains(.edit), onEdit != nil {
                Button("Editar") { onEdit?() }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
            }
            if item.capabilities.contains(.delete), onDelete != nil {
                Button("Excluir", role: .destructive) { confirmDelete = true }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 4)
    }

    private var canChangeCategory: Bool {
        item.capabilities.contains(.changeCategory)
            && onChangeCategory != nil
            && !categoryOptions.isEmpty
    }

    private func badgeStyle(_ badge: String) -> StatusBadge.Style {
        let folded = badge.lowercased()
        if folded.contains("paga") || folded.contains("recebido") || folded.contains("liquidado") {
            return .success
        }
        if folded.contains("pendente") || folded.contains("aberto") || folded.contains("agendado") {
            return .warning
        }
        if folded.contains("projetada") {
            return .info
        }
        return .neutral
    }
}

private struct SheetHeightPreference: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}
