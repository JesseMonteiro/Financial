import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct BudgetView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel: BudgetViewModel
    @State private var showEditor = false

    public init(
        repository: any BudgetRepository,
        transactions: (any TransactionsRepository)? = nil,
        mealBenefits: (any MealBenefitsRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil,
        accounts: (any AccountsRepository)? = nil,
        bills: (any BillsRepository)? = nil
    ) {
        _viewModel = State(initialValue: BudgetViewModel(
            repository: repository,
            transactions: transactions,
            mealBenefits: mealBenefits,
            purchaseCategories: purchaseCategories,
            accounts: accounts,
            bills: bills
        ))
    }

    public init() {
        _viewModel = State(initialValue: BudgetViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .summaryList)
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            case .empty:
                EmptyState(
                    title: "Sem orçamento",
                    message: "Defina uma meta por categoria (diária, semanal, quinzenal ou mensal).",
                    systemImage: "chart.pie",
                    actionTitle: "Adicionar meta",
                    action: { openCreate() }
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
        .meuFluxPageTitle("Orçamento")
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.selectedMonth.key) { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    openCreate()
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Adicionar meta")
            }
        }
        .sheet(isPresented: $showEditor, onDismiss: { viewModel.cancelEditor() }) {
            editorSheet
        }
        .alert(
            "Orçamento",
            isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }

    private var editorSheet: some View {
        NavigationStack {
            Form {
                if viewModel.isEditing {
                    LabeledContent("Categoria") {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(BudgetCategoryCatalog.label(forCategory: viewModel.draftCategory))
                                .font(.body.weight(.medium))
                            if BudgetCategoryCatalog.isSubcategory(viewModel.draftCategory),
                               let parent = BudgetCategoryCatalog.parentLabel(forSubcategory: viewModel.draftCategory) {
                                Text("Subcategoria de \(parent)")
                                    .font(.caption2)
                                    .foregroundStyle(MeuFluxColors.textMuted)
                            }
                        }
                    }
                } else {
                    Picker("Categoria", selection: $viewModel.draftCategory) {
                        ForEach(viewModel.categoryHierarchyGroups) { group in
                            Section(header: Text(group.parent.label)) {
                                if !viewModel.isCategoryTaken(group.parent.key) {
                                    HStack {
                                        Text("\(group.parent.label) (Todas as despesas)")
                                        Spacer()
                                        Text("Principal")
                                            .font(.system(size: 10, weight: .semibold))
                                            .foregroundStyle(MeuFluxColors.primary)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(MeuFluxColors.primary.opacity(0.12), in: Capsule())
                                    }
                                    .tag(group.parent.key)
                                }
                                ForEach(group.subcategories) { sub in
                                    HStack {
                                        Text("  ↳ \(sub.label)")
                                        Spacer()
                                        Text("Subcategoria")
                                            .font(.system(size: 10))
                                            .foregroundStyle(MeuFluxColors.textMuted)
                                    }
                                    .tag(sub.key)
                                }
                            }
                        }
                    }
                }
                Picker("Período", selection: $viewModel.draftPeriod) {
                    ForEach(BudgetPeriod.allCases) { period in
                        Text(period.title).tag(period)
                    }
                }
                TextField("Valor da meta (R$)", text: $viewModel.draftLimit)
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                Text("A verba diária, semanal e quinzenal acumula no mês e zera na virada. Compras de VA entram em supermercado e de VR em restaurantes.")
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
            .navigationTitle(viewModel.isEditing ? "Editar meta" : "Nova meta")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") {
                        viewModel.cancelEditor()
                        showEditor = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        Task {
                            await viewModel.saveDraft()
                            if viewModel.errorMessage == nil {
                                showEditor = false
                            }
                        }
                    }
                }
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                monthStrip
                    .cardEntrance(index: 0)
                kpiGrid
                    .cardEntrance(index: 1)
                categoriesSection
                    .cardEntrance(index: 2)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    private var monthStrip: some View {
        HStack {
            Button {
                viewModel.goToPreviousMonth()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)

            Spacer()

            Text(viewModel.selectedMonth.displayName())
                .font(.headline)

            Spacer()

            Button {
                viewModel.goToNextMonth()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(.plain)
            .disabled(!viewModel.canGoNext)
            .opacity(viewModel.canGoNext ? 1 : 0.35)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(MeuFluxColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var kpiGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MetricCard(
                title: "Gasto nas metas",
                value: viewModel.spentTotal.formatted(),
                subtitle: "\(viewModel.limits.count) \(viewModel.limits.count == 1 ? "categoria" : "categorias") com meta",
                tint: viewModel.isOverTotalAllowance ? MeuFluxColors.danger : MeuFluxColors.primary,
                systemImage: "cart",
                leadingAccent: true
            )
            MetricCard(
                title: "Verba liberada",
                value: viewModel.limitTotal.formatted(),
                subtitle: "Teto \(viewModel.monthCapTotal.formatted()) · \(viewModel.categoriesWithBudget) metas",
                tint: MeuFluxColors.info,
                systemImage: "banknote",
                leadingAccent: true
            )
            MetricCard(
                title: "Saldo do orçamento",
                value: viewModel.limitTotal.amount > 0
                    ? viewModel.budgetBalance.formatted()
                    : "—",
                subtitle: viewModel.limitTotal.amount > 0
                    ? (viewModel.isOverTotalAllowance ? "Verba excedida" : "Dentro da verba acumulada")
                    : "Defina metas nas categorias",
                tint: viewModel.limitTotal.amount > 0
                    ? (viewModel.isOverTotalAllowance ? MeuFluxColors.danger : MeuFluxColors.success)
                    : MeuFluxColors.textMuted,
                systemImage: "scale.3d",
                leadingAccent: true
            )
            MetricCard(
                title: "Categorias estouradas",
                value: "\(viewModel.overBudgetCount)",
                subtitle: "de \(viewModel.categoriesWithBudget) com limite",
                tint: viewModel.overBudgetCount > 0 ? MeuFluxColors.danger : MeuFluxColors.success,
                systemImage: "exclamationmark.triangle",
                leadingAccent: true
            )
        }
    }

    private var categoriesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Orçamento por categoria")
                        .font(.headline)
                    Text("Gasto contra a verba já liberada no mês.")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                }
                Spacer()
                Button {
                    openCreate()
                } label: {
                    Label("Meta", systemImage: "plus")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }

            if viewModel.limits.isEmpty {
                GlassCard {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "info.circle")
                            .foregroundStyle(MeuFluxColors.info)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Nenhuma meta de orçamento definida")
                                .font(.subheadline.weight(.semibold))
                            Text("Use + Meta para definir limites de gasto por categoria. A verba diária, semanal e quinzenal acumula no mês e zera na virada.")
                                .font(.caption)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }
                }
            } else {
                ForEach(viewModel.limits) { limit in
                    categoryRow(limit)
                }
            }
        }
    }

    @ViewBuilder
    private func categoryRow(_ limit: BudgetLimit) -> some View {
        let percent = utilizationPercent(limit)
        let isOver = limit.hasLimit && limit.spent.amount > limit.limit.amount
        let isNear = limit.hasLimit && !isOver && percent >= 75
        let barColor: Color = isOver
            ? MeuFluxColors.danger
            : (isNear ? MeuFluxColors.warning : MeuFluxColors.success)

        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 8) {
                    Button {
                        withAnimation {
                            viewModel.expandedCategory = viewModel.expandedCategory == limit.category ? nil : limit.category
                        }
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.textMuted)
                            .rotationEffect(.degrees(viewModel.expandedCategory == limit.category ? 180 : 0))
                    }
                    .buttonStyle(.plain)
                    .frame(width: 20, height: 20)
                    .padding(.top, 2)

                    Circle()
                        .fill(categoryTint(limit.category))
                        .frame(width: 10, height: 10)
                        .padding(.top, 5)

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(limit.displayLabel)
                                    .font(.subheadline.weight(.semibold))
                                    .lineLimit(2)
                                if limit.isSubcategory, let parent = limit.parentCategoryLabel {
                                    Text("Subcategoria de \(parent)")
                                        .font(.system(size: 11))
                                        .foregroundStyle(MeuFluxColors.textMuted)
                                }
                            }
                            Spacer(minLength: 8)
                            HStack(spacing: 2) {
                                Text(limit.spent.formatted())
                                    .font(.subheadline.weight(.bold).monospacedDigit())
                                    .foregroundStyle(isOver ? MeuFluxColors.danger : MeuFluxColors.textPrimary)
                                if limit.hasLimit {
                                    Text("/ \(limit.limit.formatted())")
                                        .font(.caption)
                                        .foregroundStyle(MeuFluxColors.textMuted)
                                }
                            }
                        }

                        WrappingHStack(spacing: 6, lineSpacing: 4) {
                            if limit.isSubcategory {
                                StatusBadge("Subcategoria", style: .info)
                            }
                            if isOver {
                                StatusBadge("Estourado", style: .danger)
                            } else if isNear {
                                StatusBadge("Atenção", style: .warning)
                            }
                            StatusBadge(
                                "\(limit.periodAmount.formatted())\(limit.period.unitLabel)",
                                style: .neutral
                            )
                        }
                    }
                }

                BudgetProgressBar(percent: min(100, percent), color: barColor)
                    .accessibilityLabel("\(percent) por cento da verba liberada")

                Text(progressCaption(limit: limit, percent: percent, isOver: isOver))
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textMuted)

                if limit.spentMeal.amount > 0 {
                    Text("\(limit.spentBank.formatted()) banco/cartão · \(limit.spentMeal.formatted()) VA/VR")
                        .font(.caption2)
                        .foregroundStyle(MeuFluxColors.textMuted)
                }

                if !limit.subcategories.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(limit.subcategories) { sub in
                                HStack(spacing: 4) {
                                    Text("\(sub.label):")
                                        .font(.system(size: 11))
                                        .foregroundStyle(MeuFluxColors.textMuted)
                                    Text(sub.spent.formatted())
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(MeuFluxColors.textPrimary)
                                }
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(MeuFluxColors.bgSecondary)
                                .cornerRadius(4)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 4)
                                        .stroke(MeuFluxColors.border, lineWidth: 1)
                                )
                            }
                        }
                    }
                }

                if viewModel.expandedCategory == limit.category {
                    Divider()
                        .padding(.vertical, 4)

                    let items = viewModel.transactionsByCategory[limit.category]
                        ?? viewModel.transactionsByCategory[limit.displayLabel]
                        ?? viewModel.transactionsByCategory[BudgetCategoryCatalog.resolveBudgetCategoryKey(limit.category)]
                        ?? []
                    let periodGroups = viewModel.groupedTransactions(for: limit.category, period: limit.period)
                    let showPeriodGroups = limit.period != .monthly && periodGroups.count > 1
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("TRANSAÇÕES (\(items.count))")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.textMuted)

                        if items.isEmpty {
                            Text("Nenhuma transação encontrada")
                                .font(.caption)
                                .foregroundStyle(MeuFluxColors.textMuted)
                                .padding(.vertical, 8)
                                .frame(maxWidth: .infinity, alignment: .center)
                        } else if showPeriodGroups {
                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(Array(periodGroups.enumerated()), id: \.element.id) { index, group in
                                    VStack(alignment: .leading, spacing: 6) {
                                        HStack {
                                            Text(group.label)
                                                .font(.system(size: 12, weight: .bold))
                                                .foregroundStyle(MeuFluxColors.textPrimary)
                                                .textCase(.uppercase)
                                                .tracking(0.5)
                                            Spacer()
                                            Text(group.total.formatted())
                                                .font(.system(size: 13, weight: .heavy))
                                                .foregroundStyle(index % 2 == 0 ? Color.blue : Color.green)
                                        }
                                        .padding(.bottom, 4)
                                        .overlay(
                                            Rectangle()
                                                .frame(height: 2)
                                                .foregroundStyle(MeuFluxColors.border),
                                            alignment: .bottom
                                        )
                                        .padding(.bottom, 2)
                                        
                                        ForEach(group.transactions) { item in
                                            transactionRow(item, limit: limit, isGrouped: true)
                                        }
                                    }
                                    .padding(12)
                                    .background(
                                        index % 2 == 0
                                            ? Color.blue.opacity(0.03)
                                            : Color.green.opacity(0.03)
                                    )
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(
                                                index % 2 == 0
                                                    ? Color.blue.opacity(0.1)
                                                    : Color.green.opacity(0.1),
                                                lineWidth: 1
                                            )
                                    )
                                }
                            }
                        } else {
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(items) { item in
                                    transactionRow(item, limit: limit)
                                }
                            }
                        }
                    }
                }

                HStack(spacing: 12) {
                    Button {
                        openEdit(limit)
                    } label: {
                        Label("Editar", systemImage: "pencil")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Button(role: .destructive) {
                        Task { await viewModel.delete(limit) }
                    } label: {
                        Label("Excluir", systemImage: "trash")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)

                    Spacer(minLength: 0)
                }
            }
        }
        .contextMenu {
            Button {
                openEdit(limit)
            } label: {
                Label("Editar meta", systemImage: "pencil")
            }
            Button(role: .destructive) {
                Task { await viewModel.delete(limit) }
            } label: {
                Label("Excluir meta", systemImage: "trash")
            }
        }
    }

    @ViewBuilder
    private func subCategoryBadge(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(MeuFluxColors.primary)
            .padding(.horizontal, 4)
            .padding(.vertical, 1)
            .background(MeuFluxColors.primary.opacity(0.08))
            .cornerRadius(3)
            .overlay(
                RoundedRectangle(cornerRadius: 3)
                    .stroke(MeuFluxColors.primary.opacity(0.2), lineWidth: 1)
            )
    }

    @ViewBuilder
    private func transactionRow(_ item: BudgetTransactionItem, limit: BudgetLimit, isGrouped: Bool = false) -> some View {
        let d = item.date
        let dateLabel = String(format: "%02d/%02d/%04d", d.day, d.month, d.year)
        let showSub = item.subCategoryLabel.map { !$0.isEmpty && $0 != limit.displayLabel } ?? false
        let bg = isGrouped ? MeuFluxColors.bgPrimary : MeuFluxColors.bgSecondary
        let strokeColor = isGrouped ? MeuFluxColors.border : Color.clear

        HStack(alignment: .center, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.description)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(dateLabel)
                        .font(.system(size: 10))
                        .foregroundStyle(MeuFluxColors.textMuted)
                    Text(item.accountName)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(MeuFluxColors.bgTertiary)
                        .cornerRadius(3)
                        .overlay(
                            RoundedRectangle(cornerRadius: 3)
                                .stroke(MeuFluxColors.border, lineWidth: 1)
                        )
                    if showSub, let sub = item.subCategoryLabel {
                        subCategoryBadge(sub)
                    }
                    if item.isMeal {
                        StatusBadge("VA/VR", style: .info)
                    }
                }
            }
            Spacer(minLength: 8)
            Text(item.amount.formatted())
                .font(.caption.weight(.bold).monospacedDigit())
                .foregroundStyle(MeuFluxColors.textPrimary)
        }
        .padding(8)
        .background(
            bg,
            in: RoundedRectangle(cornerRadius: 8, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(strokeColor, lineWidth: 1)
        )
    }

    private func openCreate() {
        viewModel.beginCreate()
        showEditor = true
    }

    private func openEdit(_ limit: BudgetLimit) {
        viewModel.beginSetLimit(limit)
        showEditor = true
    }

    private func utilizationPercent(_ limit: BudgetLimit) -> Int {
        guard limit.hasLimit, limit.limit.amount > 0 else { return 0 }
        let raw = NSDecimalNumber(decimal: limit.spent.amount / limit.limit.amount).doubleValue
        return Int(min(150, max(0, (raw * 100).rounded())))
    }

    private func progressCaption(limit: BudgetLimit, percent: Int, isOver: Bool) -> String {
        let period = limit.period.progressLabel(index: limit.periodIndex, count: limit.periodCount)
        if isOver {
            let excess = Money(amount: limit.spent.amount - limit.limit.amount)
            return "\(period) · \(percent)% da verba liberada · Excedeu em \(excess.formatted())"
        }
        let remain = Money(amount: max(0, limit.limit.amount - limit.spent.amount))
        return "\(period) · \(percent)% da verba liberada · Restam \(remain.formatted())"
    }

    private func categoryTint(_ category: String) -> Color {
        let palette: [Color] = [
            MeuFluxColors.primary,
            MeuFluxColors.info,
            MeuFluxColors.success,
            MeuFluxColors.warning,
            MeuFluxColors.danger,
        ]
        let hash = abs(category.hashValue)
        return palette[hash % palette.count]
    }
}

private struct BudgetProgressBar: View {
    let percent: Int
    let color: Color

    private var fraction: CGFloat {
        CGFloat(min(100, max(0, percent))) / 100
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(MeuFluxColors.border.opacity(0.65))
                Capsule()
                    .fill(color)
                    .frame(width: max(0, geometry.size.width * fraction))
            }
        }
        .frame(height: 9)
    }
}

#Preview {
    NavigationStack { BudgetView() }
}
