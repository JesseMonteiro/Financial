import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct ManualExpensesView: View {
    @State private var viewModel: ManualExpensesViewModel
    @State private var showEditor = false
    @State private var selectedDetail: LineItemDetail?

    public init(
        repository: any ManualExpensesRepository,
        accounts: (any AccountsRepository)? = nil,
        togglePaid: (any ToggleManualExpensePaidUseCase)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil
    ) {
        _viewModel = State(initialValue: ManualExpensesViewModel(
            repository: repository,
            accounts: accounts,
            togglePaid: togglePaid,
            purchaseCategories: purchaseCategories
        ))
    }

    public init() {
        _viewModel = State(initialValue: ManualExpensesViewModel())
    }

    public var body: some View {
        PageChrome {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    PageLoadingSkeleton(style: .list)
                case .empty:
                    emptyContent
                case .failed(let message):
                    ErrorState(message: message) { Task { await viewModel.retry() } }
                case .loaded:
                    content
                }
            }
        }
        .meuFluxPageTitle("Despesas Manuais")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.resetDraft()
                    showEditor = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Nova despesa")
            }
        }
        .sheet(isPresented: $showEditor) {
            editorSheet
        }
        .sheet(item: $selectedDetail) { item in
            LineItemDetailSheet(
                item: item,
                categoryOptions: LineItemCategoryOption.manualOptions(viewModel.purchaseCategories),
                onTogglePaid: {
                    guard let expense = viewModel.expense(id: item.sourceId) else { return }
                    Task {
                        await viewModel.setPaid(expense, isPaid: !expense.isPaid)
                        selectedDetail = nil
                    }
                },
                onEdit: {
                    if let group = viewModel.group(containingExpenseID: item.sourceId) {
                        viewModel.beginEdit(group)
                        selectedDetail = nil
                        showEditor = true
                    }
                },
                onDelete: {
                    if let group = viewModel.group(containingExpenseID: item.sourceId) {
                        viewModel.pendingDelete = group
                        selectedDetail = nil
                    }
                },
                onChangeCategory: { option in
                    Task {
                        await viewModel.updateCategory(expenseId: item.sourceId, category: option.id)
                        selectedDetail = item.applyingCategory(option: option)
                    }
                }
            )
        }
        .confirmationDialog(
            "Excluir despesa?",
            isPresented: Binding(
                get: { viewModel.pendingDelete != nil },
                set: { if !$0 { viewModel.pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Excluir", role: .destructive) {
                if let group = viewModel.pendingDelete {
                    Task { await viewModel.deleteGroup(group) }
                }
            }
            Button("Cancelar", role: .cancel) {
                viewModel.pendingDelete = nil
            }
        } message: {
            if let group = viewModel.pendingDelete {
                Text(
                    group.isSeries
                        ? "Excluir toda a série “\(group.description)”?"
                        : "Excluir “\(group.description)”?"
                )
            }
        }
    }

    // MARK: - Empty / Content

    private var emptyContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                EmptyState(
                    title: "Sem despesas manuais",
                    message: "Cadastre gastos em dinheiro, boleto ou que não passam pelo Open Finance.",
                    systemImage: "plus.circle",
                    actionTitle: "Nova despesa",
                    action: {
                        viewModel.resetDraft()
                        showEditor = true
                    }
                )
            }
            .meuFluxPageGutter()
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(MeuFluxColors.danger)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(MeuFluxColors.dangerBackground, in: RoundedRectangle(cornerRadius: Radius().md, style: .continuous))
                }

                summaryCard
                registeredCard
            }
            .meuFluxPageGutter()
        }
    }

    private var header: some View {
        Text("Cadastre e gerencie despesas em dinheiro, boleto ou que não passam pelo Open Finance.")
            .font(.subheadline)
            .foregroundStyle(MeuFluxColors.textMuted)
    }

    private var summaryCard: some View {
        GlassCard {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Em aberto")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                    Text(viewModel.unpaidTotal.formatted())
                        .font(.title3.weight(.bold).monospacedDigit())
                        .foregroundStyle(MeuFluxColors.danger)
                }
                Spacer()
                Text("\(viewModel.groups.count) despesa(s)")
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
        }
    }

    private var registeredCard: some View {
        GlassCard(
            title: "Despesas Cadastradas",
            subtitle: "Edite a despesa completa pelo lápis. Expanda as parcelas para alterar o valor de um mês ou marcar como pago."
        ) {
            VStack(spacing: 10) {
                ForEach(viewModel.groups) { group in
                    groupRow(group)
                }
            }
            .padding(.top, 4)
        }
    }

    // MARK: - Group rows

    private func groupRow(_ group: ManualExpenseGroup) -> some View {
        let expanded = viewModel.expandedGroupIDs.contains(group.id)

        return VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                if group.isSeries {
                    Button {
                        viewModel.toggleExpanded(group.id)
                    } label: {
                        Image(systemName: expanded ? "chevron.down" : "chevron.right")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.textMuted)
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(expanded ? "Recolher parcelas" : "Expandir parcelas")
                } else {
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.title2)
                        .foregroundStyle(MeuFluxColors.danger)
                        .frame(width: 36, height: 36)
                        .background(MeuFluxColors.dangerBackground, in: Circle())
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text(group.description)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    WrappingHStack(spacing: 6, lineSpacing: 4) {
                        categoryBadge(group.category)
                        if group.isRecurring {
                            StatusBadge(
                                group.isContinuous
                                    ? "Mensal Recorrente"
                                    : "\(group.installmentsCount) parcelas",
                                style: group.isContinuous ? .info : .warning
                            )
                        }
                        if group.isSeries {
                            StatusBadge(
                                "\(group.paidCount)/\(group.installmentsCount) pagas",
                                style: group.paidCount == group.installmentsCount ? .success : .neutral
                            )
                        }
                        if group.hasVariedAmounts {
                            StatusBadge("Valores variados", style: .warning)
                        }
                    }

                    Label("Começa em \(group.startDate.formatted(template: "d MMM yyyy"))", systemImage: "calendar")
                        .font(.caption2)
                        .foregroundStyle(MeuFluxColors.textMuted)
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    if let expense = group.sample {
                        openExpense(expense)
                    }
                }

                VStack(alignment: .trailing, spacing: 8) {
                    if !group.isSeries, let single = group.sample {
                        paidToggle(single)
                    }

                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(group.hasVariedAmounts ? "a partir de " : "")\(group.displayAmount.formatted())")
                            .font(.subheadline.weight(.bold).monospacedDigit())
                            .foregroundStyle(MeuFluxColors.danger)
                        if group.isRecurring {
                            Text(group.hasVariedAmounts ? "valores por mês" : "por ocorrência")
                                .font(.system(size: 10))
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }

                    HStack(spacing: 10) {
                        Button {
                            viewModel.beginEdit(group)
                            showEditor = true
                        } label: {
                            Image(systemName: "pencil")
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Editar despesa")

                        Button {
                            viewModel.pendingDelete = group
                        } label: {
                            Image(systemName: "trash")
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Excluir despesa")
                    }
                }
            }
            .padding(12)

            if group.isSeries && expanded {
                VStack(spacing: 6) {
                    ForEach(Array(group.installments.enumerated()), id: \.element.id) { index, installment in
                        installmentRow(installment, index: index, total: group.installmentsCount, continuous: group.isContinuous)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
                .padding(.top, 4)
                .background(MeuFluxColors.bgSecondary)
            }
        }
        .background(MeuFluxColors.bgTertiary)
        .clipShape(RoundedRectangle(cornerRadius: Radius().md, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        }
    }

    private func installmentRow(
        _ installment: ManualExpense,
        index: Int,
        total: Int,
        continuous: Bool
    ) -> some View {
        let editing = viewModel.editingAmountID == installment.id

        return HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(continuous ? "Ocorrência \(index + 1)" : "Parcela \(index + 1)/\(total)")
                    .font(.caption.weight(.semibold))
                    .strikethrough(installment.isPaid)
                    .foregroundStyle(MeuFluxColors.textPrimary)
                Text("Vence \(installment.date.formatted(template: "d MMM yyyy"))")
                    .font(.system(size: 10))
                    .foregroundStyle(MeuFluxColors.textMuted)
            }

            Spacer(minLength: 8)

            if editing {
                HStack(spacing: 6) {
                    TextField("Valor", text: $viewModel.editingAmountDraft)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 88)
                    Button {
                        Task { await viewModel.saveAmountEdit() }
                    } label: {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(MeuFluxColors.success)
                    }
                    .buttonStyle(.plain)
                    Button {
                        viewModel.cancelAmountEdit()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(MeuFluxColors.textMuted)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                Text(installment.amount.formatted())
                    .font(.caption.weight(.bold).monospacedDigit())
                    .foregroundStyle(MeuFluxColors.danger)
                Button {
                    viewModel.beginAmountEdit(installment)
                } label: {
                    Image(systemName: "pencil")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                }
                .buttonStyle(.plain)
                paidToggle(installment)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            installment.isPaid ? MeuFluxColors.successBackground : MeuFluxColors.bgTertiary,
            in: RoundedRectangle(cornerRadius: Radius().sm, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: Radius().sm, style: .continuous)
                .strokeBorder(
                    installment.isPaid ? MeuFluxColors.success.opacity(0.35) : MeuFluxColors.border,
                    lineWidth: 1
                )
        }
        .opacity(installment.isPaid ? 0.92 : 1)
        .contentShape(Rectangle())
        .onTapGesture {
            openExpense(installment)
        }
    }

    private func openExpense(_ expense: ManualExpense) {
        selectedDetail = LineItemDetail.from(
            expense: expense,
            accountName: viewModel.accountLabel(for: expense)
        )
    }

    private func paidToggle(_ expense: ManualExpense) -> some View {
        Toggle(
            "",
            isOn: Binding(
                get: { expense.isPaid },
                set: { newValue in
                    Task { await viewModel.setPaid(expense, isPaid: newValue) }
                }
            )
        )
        .labelsHidden()
        .tint(MeuFluxColors.success)
        .accessibilityLabel(expense.isPaid ? "Marcado como pago" : "Marcar como pago")
    }

    private func categoryBadge(_ category: String?) -> some View {
        let label = ManualExpenseCategory.label(for: category, categories: viewModel.purchaseCategories)
        let token = ManualExpenseCategory(rawValue: category ?? "")?.tint ?? .primary
        let tint = PurchaseCategoryCatalog.color(for: category, in: viewModel.purchaseCategories)
            .flatMap { Color(hexString: $0) } ?? color(for: token)
        return Text(label)
            .font(.system(size: 10, weight: .semibold))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .foregroundStyle(tint)
            .background(tint.opacity(0.12), in: Capsule())
    }

    private func color(for token: ColorToken) -> Color {
        switch token {
        case .orange: return Color(hex: 0xF97316)
        case .purple: return Color(hex: 0x8B5CF6)
        case .sky: return Color(hex: 0x0EA5E9)
        case .pink: return Color(hex: 0xEC4899)
        case .green: return MeuFluxColors.success
        case .yellow: return Color(hex: 0xEAB308)
        case .slate: return MeuFluxColors.textSecondary
        case .primary: return MeuFluxColors.primary
        }
    }

    // MARK: - Editor

    private var editorSheet: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Descrição", text: $viewModel.draftDescription)
                    TextField("Valor total (R$)", text: $viewModel.draftAmount)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                    if let preview = viewModel.splitPreview {
                        Text(
                            preview.lastDiffers
                                ? "\(preview.count) parcelas de \(preview.per.formatted()) · última \(preview.last.formatted())"
                                : "\(preview.count) parcelas de \(preview.per.formatted())"
                        )
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                    }
                }

                Section {
                    Picker("Categoria", selection: $viewModel.draftCategoryKey) {
                        ForEach(viewModel.categoryOptions) { category in
                            Text(category.label).tag(category.key)
                        }
                    }
                    DatePicker("Data da primeira ocorrência", selection: $viewModel.draftDate, displayedComponents: .date)
                }

                Section {
                    Toggle("Despesa recorrente ou parcelada?", isOn: $viewModel.draftRecurring)
                    if viewModel.draftRecurring {
                        Picker("Tipo", selection: $viewModel.draftContinuous) {
                            Text("Parcelas fixas").tag(false)
                            Text("Recorrência contínua").tag(true)
                        }
                        .pickerStyle(.segmented)

                        Picker("Frequência", selection: $viewModel.draftFrequency) {
                            ForEach(ManualFrequency.allCases) { frequency in
                                Text(frequency.label).tag(frequency)
                            }
                        }

                        if !viewModel.draftContinuous {
                            TextField("Número de parcelas", text: $viewModel.draftOccurrences)
                                #if os(iOS)
                                .keyboardType(.numberPad)
                                #endif
                        } else {
                            Text("Gera recorrência contínua automaticamente nos orçamentos.")
                                .font(.caption)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }
                }

                Section("Conta ou cartão") {
                    Picker("Conta", selection: $viewModel.draftAccountId) {
                        Text("Sem conta").tag(Optional<String>.none)
                        ForEach(viewModel.manualAccounts) { account in
                            Text("\(account.name)\(account.isCreditCard ? " · Cartão" : " · Conta")")
                                .tag(Optional(account.id))
                        }
                    }
                }
            }
            .navigationTitle(viewModel.editingGroupID == nil ? "Nova Despesa" : "Editar Despesa")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") {
                        viewModel.resetDraft()
                        showEditor = false
                    }
                    .disabled(viewModel.isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(viewModel.editingGroupID == nil ? "Salvar" : "Salvar Alterações") {
                        Task {
                            if await viewModel.saveDraft() {
                                showEditor = false
                            }
                        }
                    }
                    .disabled(viewModel.isSaving)
                }
            }
        }
    }
}

#Preview {
    NavigationStack { ManualExpensesView() }
}

private extension Color {
    init?(hexString: String) {
        var value = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let int = UInt64(value, radix: 16) else { return nil }
        self.init(hex: UInt32(int))
    }
}
