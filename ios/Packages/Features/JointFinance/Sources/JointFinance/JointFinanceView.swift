import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct JointFinanceView: View {
    @State private var viewModel: JointFinanceViewModel
    @State private var selectedDetail: LineItemDetail?
    private let onOpenSettings: (() -> Void)?
    private let onOpenMealVouchers: (() -> Void)?
    private let onOpenManualExpenses: (() -> Void)?
    private let onOpenReceivables: (() -> Void)?

    public init(
        repository: any JointFinanceRepository,
        investments: (any InvestmentsRepository)? = nil,
        toggleManualExpensePaid: any ToggleManualExpensePaidUseCase = StubToggleManualExpensePaid(),
        manuals: (any ManualExpensesRepository)? = nil,
        receivables: (any ReceivablesRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil,
        onOpenSettings: (() -> Void)? = nil,
        onOpenMealVouchers: (() -> Void)? = nil,
        onOpenManualExpenses: (() -> Void)? = nil,
        onOpenReceivables: (() -> Void)? = nil
    ) {
        _viewModel = State(wrappedValue: JointFinanceViewModel(
            repository: repository,
            investments: investments,
            toggleManualExpensePaid: toggleManualExpensePaid,
            manuals: manuals,
            receivables: receivables,
            purchaseCategories: purchaseCategories
        ))
        self.onOpenSettings = onOpenSettings
        self.onOpenMealVouchers = onOpenMealVouchers
        self.onOpenManualExpenses = onOpenManualExpenses
        self.onOpenReceivables = onOpenReceivables
    }

    public init() {
        self.init(repository: StubJointFinanceRepository())
    }

    public var body: some View {
        PageChrome {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    PageLoadingSkeleton(style: .moment)
                case .inactive:
                    inactiveView
                case .failed(let message):
                    ErrorState(message: message) {
                        Task { await viewModel.retry() }
                    }
                case .loaded(let snapshot):
                    content(snapshot)
                }
            }
        }
        .meuFluxPageTitle("Conta conjunta")
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.selectedMonth.key) { await viewModel.load() }
        .sheet(item: $selectedDetail) { item in
            LineItemDetailSheet(
                item: item,
                isBusy: viewModel.pendingManualIds.contains(item.sourceId),
                categoryOptions: item.kind == .manualExpense
                    ? LineItemCategoryOption.manualOptions(viewModel.purchaseCategories)
                    : [],
                onTogglePaid: {
                    Task {
                        if item.kind == .manualExpense {
                            await viewModel.toggleManualPaid(expenseId: item.sourceId, isPaid: !item.isPaid)
                        } else if item.kind == .receivable {
                            await viewModel.markReceivablePaid(id: item.sourceId, installmentNumber: item.installmentNumber)
                        }
                        selectedDetail = nil
                    }
                },
                onEdit: {
                    selectedDetail = nil
                    if item.kind == .manualExpense {
                        onOpenManualExpenses?()
                    } else if item.kind == .receivable {
                        onOpenReceivables?()
                    }
                },
                onDelete: {
                    Task {
                        if item.kind == .manualExpense {
                            await viewModel.deleteManual(id: item.sourceId)
                        } else if item.kind == .receivable {
                            await viewModel.deleteReceivable(id: item.sourceId)
                        }
                        selectedDetail = nil
                    }
                },
                onChangeCategory: item.kind == .manualExpense ? { option in
                    Task {
                        await viewModel.updateManualCategory(id: item.sourceId, category: option.id)
                        selectedDetail = item.applyingCategory(option: option)
                    }
                } : nil
            )
        }
    }

    private var inactiveView: some View {
        VStack(spacing: 16) {
            EmptyState(
                title: "Nenhuma conta conjunta ativa",
                message: "Vá em Configurações, gere um código e compartilhe com a outra pessoa — ou aceite o código dela.",
                systemImage: "person.2"
            )
            if onOpenSettings != nil {
                Button {
                    onOpenSettings?()
                } label: {
                    Label("Abrir Configurações", systemImage: "gearshape")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(MeuFluxColors.primary)
                .padding(.horizontal)
            }
        }
        .padding()
    }

    @ViewBuilder
    private func content(_ snapshot: JointMomentSnapshot) -> some View {
        let detail = snapshot.detail
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header(snapshot)
                    .padding(.horizontal, PageLayout.gutter)

                monthSelector(detail)

                VStack(alignment: .leading, spacing: 16) {
                    kpiGrid(detail)
                    utilizationCard(detail)
                    mealBenefitsCards(detail)
                    salariesCard(snapshot)
                    if !detail.creditCards.isEmpty { billsCard(detail) }
                    if !detail.automaticDebits.isEmpty { debitsCard(detail) }
                    if !detail.manualExpenses.isEmpty { manualsCard(detail) }
                    if !detail.receivables.isEmpty { receivablesCard(detail) }
                    investmentsCard()
                }
                .padding(.horizontal, PageLayout.gutter)
            }
            .padding(.top, PageLayout.contentTop)
            .padding(.bottom, PageLayout.gutter)
        }
    }

    private func header(_ snapshot: JointMomentSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Momento Financeiro consolidado")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(MeuFluxColors.textPrimary)
            Text(
                snapshot.members.map(\.displayName).joined(separator: " · ")
            )
            .font(.caption)
            .foregroundStyle(MeuFluxColors.textMuted)
        }
    }

    private func monthSelector(_ detail: FinancialMomentDetail) -> some View {
        VStack(spacing: 12) {
            if viewModel.selectedMonth != YearMonth(from: Date()) {
                HStack {
                    Spacer()
                    Button("Mês atual") { viewModel.selectCurrentMonth() }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
                .padding(.horizontal, PageLayout.gutter)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                ScrollViewReader { proxy in
                    HStack(spacing: 8) {
                        ForEach(Array(viewModel.monthOptions.enumerated()), id: \.offset) { index, month in
                            JointMonthChip(
                                month: month,
                                status: detail.monthsStatus[month.key]
                                    ?? (month == detail.selectedMonth ? detail.status : nil),
                                isSelected: index == viewModel.selectedMonthIndex,
                                isCurrent: month == YearMonth(from: Date())
                            ) {
                                viewModel.selectMonth(at: index)
                            }
                            .id(index)
                        }
                    }
                    .onAppear { proxy.scrollTo(viewModel.selectedMonthIndex, anchor: .center) }
                    .onChange(of: viewModel.selectedMonthIndex) { _, newValue in
                        withAnimation(.easeInOut(duration: 0.25)) {
                            proxy.scrollTo(newValue, anchor: .center)
                        }
                    }
                }
            }
            .accessibilityLabel("Seletor de período")
        }
    }

    private func kpiGrid(_ detail: FinancialMomentDetail) -> some View {
        let payableClear = detail.totals.accountsPayable.isZero
        let netOk = detail.totals.netBalance.amount >= 0
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 1), GridItem(.flexible(), spacing: 1)], spacing: 1) {
            JointKPICard(
                title: "Entradas",
                value: detail.totals.income.formatted(),
                subtitle: "Salários + \(detail.receivables.items.count) reembolsos",
                valueColor: MeuFluxColors.success,
                accent: MeuFluxColors.success
            )
            JointKPICard(
                title: "Saídas",
                value: detail.totals.expenses.formatted(),
                subtitle: "\(detail.manualExpenses.items.count) manuais",
                valueColor: MeuFluxColors.danger,
                accent: MeuFluxColors.danger
            )
            JointKPICard(
                title: "A pagar",
                value: detail.totals.accountsPayable.formatted(),
                subtitle: payableClear ? "Nada pendente" :
                    "\(detail.creditCards.unpaidBills.count) fat. · \(detail.automaticDebits.unpaidItems.count) déb.",
                valueColor: payableClear ? MeuFluxColors.success : MeuFluxColors.warning,
                accent: payableClear ? MeuFluxColors.success : MeuFluxColors.warning
            )
            JointKPICard(
                title: "Saldo",
                value: (netOk ? "+" : "") + detail.totals.netBalance.formatted(),
                subtitle: netOk ? "Superávit" : "Déficit",
                valueColor: netOk ? MeuFluxColors.success : MeuFluxColors.danger,
                accent: netOk ? MeuFluxColors.success : MeuFluxColors.danger
            )
        }
        .background(MeuFluxColors.border)
        .clipShape(RoundedRectangle(cornerRadius: Radius().lg, style: .continuous))
    }

    private func utilizationCard(_ detail: FinancialMomentDetail) -> some View {
        let percent = detail.totals.utilizationPercent
        let over = detail.totals.isOverBudget
        return GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Utilização")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textMuted)
                    Spacer()
                    Text("\(percent)%\(over ? " estourado" : "")")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(over ? MeuFluxColors.danger : MeuFluxColors.textSecondary)
                }
                JointProgressBar(percent: percent, color: over ? MeuFluxColors.danger : MeuFluxColors.primary)
                Text("Despesas consomem \(percent)% das entradas combinadas.")
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
        }
    }

    @ViewBuilder
    private func mealBenefitsCards(_ detail: FinancialMomentDetail) -> some View {
        if !detail.mealBenefits.isEmpty {
            ForEach(detail.mealBenefits.items) { item in
                GlassCard(title: item.kind.title, subtitle: item.label) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Saldo")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(MeuFluxColors.textMuted)
                                Text(item.remaining.formatted())
                                    .font(.title2.weight(.bold))
                            }
                            Spacer()
                            Image(systemName: "fork.knife")
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                        Text("Crédito dia \(item.creditDay) · gasto no mês \(item.monthSpent.formatted())")
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textMuted)
                        if let owner = item.ownerLabel, !owner.isEmpty {
                            Text(owner)
                                .font(.caption2)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                        if onOpenMealVouchers != nil {
                            Button("Gerenciar VA/VR") {
                                onOpenMealVouchers?()
                            }
                            .font(.caption.weight(.semibold))
                        }
                    }
                }
            }
        }
    }

    private func salariesCard(_ snapshot: JointMomentSnapshot) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Salários", subtitle: "Por membro · \(viewModel.selectedMonth.displayName())")
                ForEach(snapshot.members) { member in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(member.displayName)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.textPrimary)
                        HStack {
                            TextField("0,00", text: Binding(
                                get: { viewModel.salaryInputs[member.id] ?? "" },
                                set: { viewModel.salaryInputs[member.id] = $0 }
                            ))
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .textFieldStyle(.roundedBorder)
                            Button {
                                Task { await viewModel.saveSalary(for: member.id) }
                            } label: {
                                if viewModel.savingMemberIds.contains(member.id) {
                                    ProgressView()
                                } else {
                                    Text("Definir")
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(MeuFluxColors.primary)
                            .disabled(viewModel.savingMemberIds.contains(member.id))
                        }
                    }
                }
            }
        }
    }

    private func billsCard(_ detail: FinancialMomentDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Faturas de Cartão de Crédito")
                .font(.headline)
                .fontWeight(.semibold)
                .foregroundStyle(MeuFluxColors.textPrimary)

            if detail.creditCards.isEmpty {
                Text("Nenhuma fatura de cartão vencendo neste mês.")
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(detail.creditCards.bills) { bill in
                            CreditCardFaceView(
                                name: bill.cardName,
                                lastFour: bill.lastFour,
                                amountLabel: bill.amount.formatted(),
                                institutionName: bill.institutionName,
                                marketingName: bill.marketingName.isEmpty ? bill.cardName : bill.marketingName,
                                connectorName: bill.connectorName,
                                iconKey: bill.iconKey,
                                cardFaceURL: bill.cardFaceURL,
                                selected: false,
                                status: bill.isPaid ? .paid : .due,
                                ownerLabel: bill.ownerLabel
                            )
                        }
                    }
                    .padding(.vertical, 4)
                    // Rest position aligns with page gutter; scroll can still reach screen edges.
                    .padding(.horizontal, PageLayout.gutter)
                }
                .padding(.horizontal, -PageLayout.gutter)
                .frame(maxWidth: .infinity)
                .frame(height: CreditCardFaceMetrics.size.height + 8)

                HStack {
                    Text("Total Faturas")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(MeuFluxColors.textPrimary)
                    Spacer()
                    Text(detail.creditCards.total.formatted())
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundStyle(MeuFluxColors.danger)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                        .fill(MeuFluxColors.card)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                        .strokeBorder(MeuFluxColors.border, lineWidth: 1)
                )
            }
        }
    }

    private func debitsCard(_ detail: FinancialMomentDetail) -> some View {
        GlassCard(padding: 12) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("Débitos automáticos", subtitle: detail.automaticDebits.total.formatted())
                ForEach(detail.automaticDebits.items) { item in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.description)
                                .font(.subheadline.weight(.semibold))
                            Text("\(item.accountName) · \(item.date)")
                                .font(.caption)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                        Spacer()
                        Text(item.amount.formatted())
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(item.isPending ? MeuFluxColors.warning : MeuFluxColors.textPrimary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { selectedDetail = LineItemDetail.from(debit: item) }
                    if item.id != detail.automaticDebits.items.last?.id {
                        Divider().opacity(0.35)
                    }
                }
            }
        }
    }

    private func manualsCard(_ detail: FinancialMomentDetail) -> some View {
        GlassCard(padding: 12) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("Despesas manuais", subtitle: detail.manualExpenses.total.formatted())
                ForEach(detail.manualExpenses.items) { item in
                    HStack(alignment: .center, spacing: 10) {
                        JointPaidCheckbox(
                            checked: item.isPaid,
                            busy: viewModel.pendingManualIds.contains(item.id)
                        ) { isPaid in
                            Task { await viewModel.toggleManualPaid(expenseId: item.id, isPaid: isPaid) }
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.description)
                                .font(.subheadline.weight(.semibold))
                                .strikethrough(item.isPaid)
                            HStack(spacing: 6) {
                                Text(item.date)
                                    .font(.caption)
                                    .foregroundStyle(MeuFluxColors.textMuted)
                                if let owner = item.ownerLabel {
                                    Text("· \(owner)")
                                        .font(.caption)
                                        .foregroundStyle(MeuFluxColors.textMuted)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                        .onTapGesture { selectedDetail = LineItemDetail.from(momentExpense: item) }
                        Spacer()
                        Text(item.amount.formatted())
                            .font(.subheadline.weight(.bold))
                    }
                    if item.id != detail.manualExpenses.items.last?.id {
                        Divider().opacity(0.35)
                    }
                }
            }
        }
    }

    private func receivablesCard(_ detail: FinancialMomentDetail) -> some View {
        GlassCard(padding: 12) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("Recebíveis", subtitle: detail.receivables.total.formatted())
                ForEach(detail.receivables.items) { item in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.personName)
                                .font(.subheadline.weight(.semibold))
                            Text("\(item.description) · \(item.installmentNumber)/\(item.totalInstallments)")
                                .font(.caption)
                                .foregroundStyle(MeuFluxColors.textMuted)
                            if let owner = item.ownerLabel {
                                Text(owner)
                                    .font(.caption2)
                                    .foregroundStyle(MeuFluxColors.textMuted)
                            }
                        }
                        Spacer()
                        Text(item.amount.formatted())
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(item.isPaid ? MeuFluxColors.success : MeuFluxColors.textPrimary)
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { selectedDetail = LineItemDetail.from(momentReceivable: item) }
                    if item.id != detail.receivables.items.last?.id {
                        Divider().opacity(0.35)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func investmentsCard() -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Investimentos conjuntos")
                        .font(.headline)
                    Spacer()
                    Button(viewModel.showJointInvestments ? "Ocultar" : "Mostrar") {
                        Task { await viewModel.loadJointInvestments() }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                if viewModel.showJointInvestments {
                    if viewModel.jointInvestments.isEmpty {
                        Text("Nenhuma posição conjunta.")
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    } else {
                        ForEach(viewModel.jointInvestments) { inv in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(inv.name)
                                    if let owner = inv.ownerLabel {
                                        Text(owner)
                                            .font(.caption)
                                            .foregroundStyle(MeuFluxColors.textSecondary)
                                    }
                                }
                                Spacer()
                                Text(inv.balance.formatted())
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct StubJointFinanceRepository: JointFinanceRepository {
    func fetchLink(force: Bool) async throws -> JointLink? {
        _ = force
        return nil
    }
    func fetchMoment(month: YearMonth, force: Bool) async throws -> JointMomentSnapshot {
        _ = force
        throw FinancialError.notFound(entity: "JointMoment", id: month.key)
    }
    func saveMemberSalary(userId: String, month: YearMonth, amount: Money) async throws {}
    func createInvite() async throws -> String { "000000" }
    func acceptInvite(token: String) async throws {}
    func unlink() async throws {}
}

// MARK: - Local UI helpers

private struct JointMonthChip: View {
    let month: YearMonth
    let status: MonthStatus?
    let isSelected: Bool
    let isCurrent: Bool
    let onTap: () -> Void

    private var monthName: String {
        var comps = DateComponents()
        comps.year = month.year
        comps.month = month.month
        comps.day = 1
        let cal = Calendar(identifier: .gregorian)
        guard let date = cal.date(from: comps) else { return month.key }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.setLocalizedDateFormatFromTemplate("MMMM")
        return formatter.string(from: date).capitalized
    }

    private var tone: Color? {
        guard let status else { return nil }
        return status.isPositive ? MeuFluxColors.success : MeuFluxColors.danger
    }

    private var netLabel: String? {
        guard let status else { return nil }
        let formatted = status.net.formatted()
        return status.isPositive ? "+\(formatted)" : formatted
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 2) {
                Text(monthName)
                    .font(.caption.weight(isSelected ? .bold : .semibold))
                    .foregroundStyle(tone ?? MeuFluxColors.textPrimary)
                Text(verbatim: "\(month.year)\(isCurrent ? " • Atual" : "")")
                    .font(.system(size: 10))
                    .foregroundStyle(MeuFluxColors.textMuted)
                if let netLabel {
                    Text(netLabel)
                        .font(.system(size: 10, weight: .bold).monospacedDigit())
                        .foregroundStyle(tone ?? MeuFluxColors.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
            .frame(minWidth: 120)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                    .fill(chipFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                    .strokeBorder(chipBorder, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(monthName) \(month.year)")
        .accessibilityValue(netLabel ?? "")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var chipFill: Color {
        guard let tone else { return MeuFluxColors.tertiaryBackground }
        return tone.opacity(isSelected ? 0.15 : 0.05)
    }

    private var chipBorder: Color {
        guard let tone else { return MeuFluxColors.border }
        return tone.opacity(isSelected ? 1 : 0.35)
    }
}

private struct JointKPICard: View {
    let title: String
    let value: String
    let subtitle: String
    let valueColor: Color
    let accent: Color

    var body: some View {
        HStack(spacing: 0) {
            Rectangle().fill(accent).frame(width: 3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(MeuFluxColors.textMuted)
                Text(value)
                    .font(.subheadline.weight(.heavy).monospacedDigit())
                    .foregroundStyle(valueColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textSecondary)
                    .lineLimit(2)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(MeuFluxColors.card)
    }
}

private struct JointProgressBar: View {
    let percent: Int
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(MeuFluxColors.border.opacity(0.65))
                Capsule()
                    .fill(color)
                    .frame(width: max(0, geometry.size.width * CGFloat(min(100, max(0, percent))) / 100))
            }
        }
        .frame(height: 10)
    }
}

private struct JointPaidCheckbox: View {
    let checked: Bool
    let busy: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        Button {
            onToggle(!checked)
        } label: {
            Image(systemName: checked ? "checkmark.square.fill" : "square")
                .foregroundStyle(checked ? MeuFluxColors.success : MeuFluxColors.textSecondary)
                .font(.system(size: 18))
        }
        .disabled(busy)
        .opacity(busy ? 0.6 : 1)
    }
}

#Preview {
    NavigationStack { JointFinanceView() }
}
