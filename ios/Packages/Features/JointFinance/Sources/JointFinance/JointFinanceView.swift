import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct JointFinanceView: View {
    @State private var viewModel: JointFinanceViewModel
    private let onOpenSettings: (() -> Void)?

    public init(
        repository: any JointFinanceRepository,
        investments: (any InvestmentsRepository)? = nil,
        toggleManualExpensePaid: any ToggleManualExpensePaidUseCase = StubToggleManualExpensePaid(),
        onOpenSettings: (() -> Void)? = nil
    ) {
        _viewModel = State(wrappedValue: JointFinanceViewModel(
            repository: repository,
            investments: investments,
            toggleManualExpensePaid: toggleManualExpensePaid
        ))
        self.onOpenSettings = onOpenSettings
    }

    public init() {
        self.init(repository: StubJointFinanceRepository())
    }

    public var body: some View {
        PageChrome {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    BrandLoadingView()
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
        .navigationTitle("Conta conjunta")
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.selectedMonth.key) { await viewModel.load() }
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
                .tint(FinancialColors.primary)
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
                monthSelector(detail)
                kpiGrid(detail)
                utilizationCard(detail)
                salariesCard(snapshot)
                if !detail.creditCards.isEmpty { billsCard(detail) }
                if !detail.automaticDebits.isEmpty { debitsCard(detail) }
                if !detail.manualExpenses.isEmpty { manualsCard(detail) }
                if !detail.receivables.isEmpty { receivablesCard(detail) }
                investmentsCard()
            }
            .padding()
        }
    }

    private func header(_ snapshot: JointMomentSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Momento Financeiro consolidado")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FinancialColors.textPrimary)
            Text(
                snapshot.members.map(\.displayName).joined(separator: " · ")
            )
            .font(.caption)
            .foregroundStyle(FinancialColors.textMuted)
        }
    }

    private func monthSelector(_ detail: FinancialMomentDetail) -> some View {
        GlassCard {
            VStack(spacing: 12) {
                if viewModel.selectedMonth != YearMonth(from: Date()) {
                    HStack {
                        Spacer()
                        Button("Mês atual") { viewModel.selectCurrentMonth() }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                    }
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
            }
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
                valueColor: FinancialColors.success,
                accent: FinancialColors.success
            )
            JointKPICard(
                title: "Saídas",
                value: detail.totals.expenses.formatted(),
                subtitle: "\(detail.manualExpenses.items.count) manuais",
                valueColor: FinancialColors.danger,
                accent: FinancialColors.danger
            )
            JointKPICard(
                title: "A pagar",
                value: detail.totals.accountsPayable.formatted(),
                subtitle: payableClear ? "Nada pendente" :
                    "\(detail.creditCards.unpaidBills.count) fat. · \(detail.automaticDebits.unpaidItems.count) déb.",
                valueColor: payableClear ? FinancialColors.success : FinancialColors.warning,
                accent: payableClear ? FinancialColors.success : FinancialColors.warning
            )
            JointKPICard(
                title: "Saldo",
                value: (netOk ? "+" : "") + detail.totals.netBalance.formatted(),
                subtitle: netOk ? "Superávit" : "Déficit",
                valueColor: netOk ? FinancialColors.success : FinancialColors.danger,
                accent: netOk ? FinancialColors.success : FinancialColors.danger
            )
        }
        .background(FinancialColors.border)
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
                        .foregroundStyle(FinancialColors.textMuted)
                    Spacer()
                    Text("\(percent)%\(over ? " estourado" : "")")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(over ? FinancialColors.danger : FinancialColors.textSecondary)
                }
                JointProgressBar(percent: percent, color: over ? FinancialColors.danger : FinancialColors.primary)
                Text("Despesas consomem \(percent)% das entradas combinadas.")
                    .font(.caption2)
                    .foregroundStyle(FinancialColors.textMuted)
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
                            .foregroundStyle(FinancialColors.textPrimary)
                        HStack {
                            TextField("0,00", text: Binding(
                                get: { viewModel.salaryInputs[member.id] ?? "" },
                                set: { viewModel.salaryInputs[member.id] = $0 }
                            ))
                            .keyboardType(.decimalPad)
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
                            .tint(FinancialColors.primary)
                            .disabled(viewModel.savingMemberIds.contains(member.id))
                        }
                    }
                }
            }
        }
    }

    private func billsCard(_ detail: FinancialMomentDetail) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(
                    "Faturas de cartão",
                    subtitle: "Total \(detail.creditCards.total.formatted())"
                )
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(detail.creditCards.bills) { bill in
                            VStack(alignment: .leading, spacing: 6) {
                                CreditCardFaceView(
                                    name: bill.cardName,
                                    lastFour: bill.lastFour,
                                    amountLabel: bill.amount.formatted(),
                                    institutionName: bill.institutionName,
                                    marketingName: bill.marketingName,
                                    connectorName: bill.connectorName,
                                    iconKey: bill.iconKey,
                                    cardFaceURL: bill.cardFaceURL,
                                    status: bill.isPaid ? .paid : .due,
                                    ownerLabel: bill.ownerLabel
                                )
                                .frame(width: 160, height: 100)
                            }
                        }
                    }
                }
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
                                .foregroundStyle(FinancialColors.textMuted)
                        }
                        Spacer()
                        Text(item.amount.formatted())
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(item.isPending ? FinancialColors.warning : FinancialColors.textPrimary)
                    }
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
                                    .foregroundStyle(FinancialColors.textMuted)
                                if let owner = item.ownerLabel {
                                    Text("· \(owner)")
                                        .font(.caption)
                                        .foregroundStyle(FinancialColors.textMuted)
                                }
                            }
                        }
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
                                .foregroundStyle(FinancialColors.textMuted)
                            if let owner = item.ownerLabel {
                                Text(owner)
                                    .font(.caption2)
                                    .foregroundStyle(FinancialColors.textMuted)
                            }
                        }
                        Spacer()
                        Text(item.amount.formatted())
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(item.isPaid ? FinancialColors.success : FinancialColors.textPrimary)
                    }
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
                            .foregroundStyle(FinancialColors.textSecondary)
                    } else {
                        ForEach(viewModel.jointInvestments) { inv in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(inv.name)
                                    if let owner = inv.ownerLabel {
                                        Text(owner)
                                            .font(.caption)
                                            .foregroundStyle(FinancialColors.textSecondary)
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
        return status.isPositive ? FinancialColors.success : FinancialColors.danger
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 2) {
                Text(monthName)
                    .font(.caption.weight(isSelected ? .bold : .semibold))
                    .foregroundStyle(tone ?? FinancialColors.textPrimary)
                Text("\(month.year)\(isCurrent ? " • Atual" : "")")
                    .font(.system(size: 10))
                    .foregroundStyle(FinancialColors.textMuted)
                if let status {
                    Text(status.isPositive ? "+\(status.net.formatted())" : status.net.formatted())
                        .font(.system(size: 10, weight: .bold).monospacedDigit())
                        .foregroundStyle(tone ?? FinancialColors.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
            .frame(minWidth: 120)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                    .fill(tone?.opacity(isSelected ? 0.15 : 0.05) ?? FinancialColors.tertiaryBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                    .strokeBorder(tone?.opacity(isSelected ? 1 : 0.35) ?? FinancialColors.border, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
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
                    .foregroundStyle(FinancialColors.textMuted)
                Text(value)
                    .font(.subheadline.weight(.heavy).monospacedDigit())
                    .foregroundStyle(valueColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(FinancialColors.textSecondary)
                    .lineLimit(2)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.white.opacity(0.95))
    }
}

private struct JointProgressBar: View {
    let percent: Int
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(FinancialColors.border.opacity(0.65))
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
                .foregroundStyle(checked ? FinancialColors.success : FinancialColors.textSecondary)
                .font(.system(size: 18))
        }
        .disabled(busy)
        .opacity(busy ? 0.6 : 1)
    }
}

#Preview {
    NavigationStack { JointFinanceView() }
}
