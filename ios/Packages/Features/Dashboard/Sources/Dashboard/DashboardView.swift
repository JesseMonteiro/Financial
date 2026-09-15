import SwiftUI
import Charts
import MeuFluxDesignSystem
import MeuFluxDomain

public struct DashboardView: View {
    @State private var viewModel: DashboardViewModel
    @State private var showAssistant = false
    @State private var selectedDetail: LineItemDetail?

    private let onConnect: (() -> Void)?
    private let onTransactions: (() -> Void)?
    private let onCreditCards: (() -> Void)?
    private let onInvestments: (() -> Void)?
    private let onAgenda: (() -> Void)?
    private let onBudget: (() -> Void)?

    public init(
        loadDashboard: any LoadDashboardUseCase,
        transactions: (any TransactionsRepository)? = nil,
        onConnect: (() -> Void)? = nil,
        onTransactions: (() -> Void)? = nil,
        onCreditCards: (() -> Void)? = nil,
        onInvestments: (() -> Void)? = nil,
        onAgenda: (() -> Void)? = nil,
        onBudget: (() -> Void)? = nil
    ) {
        _viewModel = State(wrappedValue: DashboardViewModel(
            loadDashboard: loadDashboard,
            transactions: transactions
        ))
        self.onConnect = onConnect
        self.onTransactions = onTransactions
        self.onCreditCards = onCreditCards
        self.onInvestments = onInvestments
        self.onAgenda = onAgenda
        self.onBudget = onBudget
    }

    public init() {
        self.init(loadDashboard: StubLoadDashboard())
    }

    public var body: some View {
        PageChrome {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch viewModel.state {
                    case .idle, .loading:
                        PageLoadingSkeleton(style: .dashboard, embedded: true)
                    case .empty:
                        EmptyState(
                            title: "Nenhum dado ainda",
                            message: "Conecte uma conta via Open Finance para ver patrimônio, gastos e insights.",
                            systemImage: "chart.bar.doc.horizontal"
                        )
                        if onConnect != nil {
                            Button {
                                onConnect?()
                            } label: {
                                Label("Conectar Nova Conta", systemImage: "plus")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(MeuFluxColors.primary)
                        }
                    case .failed(let message):
                        ErrorState(message: message) { Task { await viewModel.load(force: true) } }
                    case .loaded(let snap):
                        loadedContent(snap)
                    }
                }
                .meuFluxPageGutter()
            }
        }
        .meuFluxPageTitle("Início")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showAssistant = true
                } label: {
                    Label("Assistente", systemImage: "sparkles")
                }
            }
        }
        .sheet(isPresented: $showAssistant) {
            NavigationStack {
                MeuFluxAssistantView()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Fechar") { showAssistant = false }
                        }
                    }
            }
        }
        .sheet(item: $selectedDetail) { item in
            LineItemDetailSheet(
                item: item,
                categoryOptions: viewModel.categoryOptions,
                onChangeCategory: { option in
                    Task {
                        await viewModel.changeCategory(id: item.sourceId, option: option)
                        selectedDetail = item.applyingCategory(option: option)
                    }
                }
            )
        }
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
    }

    // MARK: - Loaded

    @ViewBuilder
    private func loadedContent(_ snap: DashboardSnapshot) -> some View {
        header(displayName: snap.displayName)
        siriHint

        if !CalculationVersion.matches(snap.calculationVersion) {
            Text("Versão de cálculo desatualizada (\(snap.calculationVersion ?? "—")). Atualize o app.")
                .font(.caption)
                .foregroundStyle(MeuFluxColors.danger)
        }

        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            kpiCard(
                title: "Patrimônio Líquido",
                value: snap.summary.netWorth.formatted(),
                subtitle: "Ativos \(snap.summary.totalAssets.formatted()) · Dívidas -\(snap.summary.creditDebt.formatted())",
                valueColor: snap.summary.netWorth.amount >= 0 ? MeuFluxColors.textPrimary : MeuFluxColors.danger,
                icon: "sparkles",
                iconTint: MeuFluxColors.primary,
                iconBg: MeuFluxColors.primary.opacity(0.12)
            ) {
                SparklineChart(
                    values: snap.netWorthSeries.map(\.value),
                    color: MeuFluxColors.primary
                )
            }

            kpiCard(
                title: "Saldo em Contas",
                value: snap.summary.bankBalance.formatted(),
                subtitle: bankSubtitle(snap),
                valueColor: MeuFluxColors.textPrimary,
                icon: "wallet.pass.fill",
                iconTint: MeuFluxColors.success,
                iconBg: MeuFluxColors.success.opacity(0.12)
            ) {
                SparklineChart(
                    values: snap.incomeExpenseSeries.map(\.net),
                    color: MeuFluxColors.success
                )
            }

            kpiCard(
                title: "Taxa de Poupança",
                value: savingsRateText(snap.cashflow.savingsRate),
                subtitle: "Líquido do mês: \(snap.cashflow.net.formatted())",
                valueColor: (snap.cashflow.savingsRate ?? 0) >= 0 ? MeuFluxColors.success : MeuFluxColors.danger,
                icon: "percent",
                iconTint: MeuFluxColors.info,
                iconBg: MeuFluxColors.info.opacity(0.12)
            ) {
                SparklineChart(
                    values: snap.incomeExpenseSeries.map(\.net),
                    color: MeuFluxColors.info
                )
            }

            kpiCard(
                title: "Gastos vs Mês Ant.",
                value: momText(snap.monthOverMonth.expenseDeltaPct),
                subtitle: "Este mês \(snap.cashflow.expense.formatted()) · ant. \(snap.monthOverMonth.previousExpense.formatted())",
                valueColor: snap.monthOverMonth.expenseDeltaPct > 0 ? MeuFluxColors.danger : MeuFluxColors.success,
                icon: "chart.bar.fill",
                iconTint: MeuFluxColors.danger,
                iconBg: MeuFluxColors.danger.opacity(0.12)
            ) {
                SparklineChart(
                    values: snap.incomeExpenseSeries.map(\.despesa),
                    color: MeuFluxColors.danger
                )
            }
        }

        if !snap.insights.isEmpty || snap.weeklyRecap.total.amount > 0 {
            insightsAndRecap(snap)
        }

        if !snap.netWorthSeries.isEmpty {
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader("Evolução Patrimonial", subtitle: "Reconstruída a partir do fluxo mensal")
                    Chart(snap.netWorthSeries) { point in
                        AreaMark(
                            x: .value("Mês", point.month),
                            y: .value("Patrimônio", point.value)
                        )
                        .foregroundStyle(MeuFluxColors.primary.opacity(0.18))
                        LineMark(
                            x: .value("Mês", point.month),
                            y: .value("Patrimônio", point.value)
                        )
                        .foregroundStyle(MeuFluxColors.primary)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                    }
                    .frame(height: 180)
                    .chartYAxis {
                        AxisMarks(position: .leading) { _ in
                            AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            AxisValueLabel()
                                .font(.caption2)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }
                    .chartXAxis {
                        AxisMarks { _ in
                            AxisValueLabel()
                                .font(.caption2)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }
                }
            }
        }

        if !snap.categoryExpenses.isEmpty {
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader("Gastos por Categoria", subtitle: "Mês atual")
                    Chart(snap.categoryExpenses) { cat in
                        BarMark(
                            x: .value("Valor", cat.value),
                            y: .value("Categoria", cat.name)
                        )
                        .foregroundStyle(color(from: cat.colorHex) ?? MeuFluxColors.primary)
                    }
                    .frame(height: CGFloat(max(140, snap.categoryExpenses.count * 28)))
                    .chartXAxis {
                        AxisMarks { _ in
                            AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            AxisValueLabel()
                                .font(.caption2)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }
                    .chartYAxis {
                        AxisMarks { _ in
                            AxisValueLabel()
                                .font(.caption2)
                                .foregroundStyle(MeuFluxColors.textSecondary)
                        }
                    }
                }
            }
        }

        if !snap.incomeExpenseSeries.isEmpty {
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader("Fluxo de Caixa", subtitle: "Receitas vs despesas")
                    Chart {
                        ForEach(snap.incomeExpenseSeries) { point in
                            BarMark(
                                x: .value("Mês", point.month),
                                y: .value("Receita", point.receita)
                            )
                            .foregroundStyle(MeuFluxColors.success)
                            .position(by: .value("Tipo", "Receita"))

                            BarMark(
                                x: .value("Mês", point.month),
                                y: .value("Despesa", point.despesa)
                            )
                            .foregroundStyle(MeuFluxColors.danger)
                            .position(by: .value("Tipo", "Despesa"))
                        }
                    }
                    .frame(height: 180)
                    .chartLegend(.hidden)
                    .chartXAxis {
                        AxisMarks { _ in
                            AxisValueLabel()
                                .font(.caption2)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }
                    .chartYAxis {
                        AxisMarks { _ in
                            AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [4]))
                            AxisValueLabel()
                                .font(.caption2)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }
                }
            }
        }

        recentTransactionsSection(snap)

        if !snap.budgetCategories.isEmpty {
            budgetSection(snap)
        }

        footerLinks(snap)
    }

    // MARK: - Sections

    private func header(displayName: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Olá, \(displayName)!")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                Text("Visão consolidada das suas contas sincronizadas via Open Finance.")
                    .font(.subheadline)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
            Spacer(minLength: 8)
            if onConnect != nil {
                Button {
                    onConnect?()
                } label: {
                    Label("Conectar", systemImage: "plus")
                        .font(.caption.weight(.semibold))
                }
                .buttonStyle(.borderedProminent)
                .tint(MeuFluxColors.primary)
                .controlSize(.small)
            }
        }
    }

    private var siriHint: some View {
        let name = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
            ?? Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String
            ?? "MeuFlux"
        return Label("Siri: “Qual meu saldo no \(name)?”", systemImage: "mic.fill")
            .font(.caption)
            .foregroundStyle(MeuFluxColors.textMuted)
    }

    private func insightsAndRecap(_ snap: DashboardSnapshot) -> some View {
        VStack(spacing: 12) {
            if !snap.insights.isEmpty {
                GlassCard {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeader("Insights", subtitle: "O que mudou nas suas finanças")
                        ForEach(snap.insights) { insight in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(insight.text)
                                    .font(.subheadline)
                                    .foregroundStyle(MeuFluxColors.textPrimary)
                                if insight.generatedOnDevice {
                                    Text("Gerado no iPhone")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(MeuFluxColors.textMuted)
                                }
                            }
                            .padding(.vertical, 10)
                            .padding(.horizontal, 12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(MeuFluxColors.bgTertiary)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(insightBorder(insight.type))
                                    .frame(width: 3)
                            }
                        }
                    }
                }
            }

            GlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader("Recap da Semana", subtitle: "Últimos 7 dias")
                    Text("GASTOS")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textMuted)
                    Text(snap.weeklyRecap.total.formatted())
                        .font(.title3.weight(.bold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                    Text(momText(snap.weeklyRecap.deltaPct) + " vs semana anterior")
                        .font(.caption)
                        .foregroundStyle(
                            snap.weeklyRecap.deltaPct > 0 ? MeuFluxColors.danger : MeuFluxColors.success
                        )
                    if let name = snap.weeklyRecap.topCategoryName,
                       let value = snap.weeklyRecap.topCategoryValue {
                        Text("Maior categoria: \(name) · \(value.formatted())")
                            .font(.subheadline)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                    Text("\(snap.summary.creditCount) cartão(ões) · fatura aberta \(snap.summary.openBillsTotal.formatted())")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                    if onAgenda != nil {
                        Button {
                            onAgenda?()
                        } label: {
                            Text("Ver agenda de contas →")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MeuFluxColors.primary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func recentTransactionsSection(_ snap: DashboardSnapshot) -> some View {
        GlassCard(padding: 12) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    SectionHeader(
                        "Últimas Transações",
                        subtitle: "Sincronizadas via Open Finance"
                    )
                    Spacer()
                    if onTransactions != nil {
                        Button {
                            onTransactions?()
                        } label: {
                            Text("Ver todas →")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MeuFluxColors.primary)
                        }
                        .buttonStyle(.plain)
                    }
                }

                if snap.recentTransactions.isEmpty {
                    Text("Nenhuma transação recente encontrada.")
                        .font(.subheadline)
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                } else {
                    ForEach(snap.recentTransactions) { tx in
                        TransactionRow(
                            title: tx.description,
                            subtitle: "\(LineItemDetail.translatedCategory(tx.category)) • \(tx.dateRelative)",
                            amountText: tx.isCredit
                                ? "+ \(tx.amount.formatted())"
                                : "- \(tx.amount.formatted())",
                            isCredit: tx.isCredit,
                            badge: nil,
                            isPending: tx.isPending,
                            action: { selectedDetail = LineItemDetail.from(dashboard: tx) }
                        )
                        if tx.id != snap.recentTransactions.last?.id {
                            Divider().opacity(0.35)
                        }
                    }
                }
            }
        }
    }

    private func budgetSection(_ snap: DashboardSnapshot) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    SectionHeader("Resumo do Orçamento", subtitle: "Gastos do mês por categoria")
                    Spacer()
                    if onBudget != nil {
                        Button {
                            onBudget?()
                        } label: {
                            Text("Gerenciar →")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MeuFluxColors.primary)
                        }
                        .buttonStyle(.plain)
                    }
                }

                ForEach(snap.budgetCategories) { budget in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(budget.category)
                                .font(.caption.weight(.bold))
                                .foregroundStyle(MeuFluxColors.textPrimary)
                            Spacer()
                            Text("\(budget.spent.formatted()) / \(budget.limit.formatted())")
                                .font(.caption)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                        Text("\(budget.percent)% da verba liberada")
                            .font(.caption2)
                            .foregroundStyle(MeuFluxColors.textMuted)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(MeuFluxColors.bgTertiary)
                                Capsule()
                                    .fill(color(from: budget.colorHex) ?? MeuFluxColors.primary)
                                    .frame(width: geo.size.width * CGFloat(budget.percent) / 100)
                            }
                        }
                        .frame(height: 8)
                    }
                    .padding(10)
                    .background(MeuFluxColors.bgTertiary)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
    }

    private func footerLinks(_ snap: DashboardSnapshot) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            GlassCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("INVESTIMENTOS")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.textMuted)
                        Spacer()
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .foregroundStyle(MeuFluxColors.info)
                    }
                    Text(snap.summary.investmentTotal.formatted())
                        .font(.title3.weight(.bold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                    if onInvestments != nil {
                        Button {
                            onInvestments?()
                        } label: {
                            Text("Ver carteira →")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MeuFluxColors.primary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            GlassCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("SALDO DEVEDOR")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.textMuted)
                        Spacer()
                        Image(systemName: "creditcard.fill")
                            .foregroundStyle(MeuFluxColors.danger)
                    }
                    Text(snap.summary.creditDebt.formatted())
                        .font(.title3.weight(.bold))
                        .foregroundStyle(MeuFluxColors.danger)
                    if onCreditCards != nil {
                        Button {
                            onCreditCards?()
                        } label: {
                            Text("Ver cartões →")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MeuFluxColors.primary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - KPI helpers

    private func kpiCard<Chart: View>(
        title: String,
        value: String,
        subtitle: String,
        valueColor: Color,
        icon: String,
        iconTint: Color,
        iconBg: Color,
        @ViewBuilder chart: () -> Chart
    ) -> some View {
        GlassCard(padding: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Text(title.uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .lineLimit(2)
                    Spacer(minLength: 4)
                    Image(systemName: icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(iconTint)
                        .padding(6)
                        .background(iconBg)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                Text(value)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(valueColor)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .lineLimit(2)
                chart()
                    .frame(height: 36)
            }
        }
    }

    private func bankSubtitle(_ snap: DashboardSnapshot) -> String {
        let n = snap.summary.bankCount
        var text = "\(n) \(n == 1 ? "conta bancária" : "contas bancárias")"
        if snap.summary.reservedBalance.amount > 0 {
            text += " · caixinhas \(snap.summary.reservedBalance.formatted())"
        }
        return text
    }

    private func savingsRateText(_ rate: Double?) -> String {
        guard let rate else { return "—" }
        return String(format: "%.0f%%", rate)
    }

    private func momText(_ pct: Double) -> String {
        let sign = pct > 0 ? "+" : ""
        return String(format: "%@%.0f%%", sign, pct)
    }

    private func insightBorder(_ type: String) -> Color {
        switch type {
        case "positive": return MeuFluxColors.success
        case "warning": return MeuFluxColors.danger
        default: return MeuFluxColors.info
        }
    }

    private func color(from hexString: String) -> Color? {
        var clean = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.hasPrefix("#") { clean = String(clean.dropFirst()) }
        guard let value = UInt32(clean, radix: 16) else { return nil }
        return Color(hex: value)
    }
}

// MARK: - Sparkline

private struct SparklineChart: View {
    let values: [Double]
    let color: Color

    var body: some View {
        if values.count < 2 {
            Color.clear
        } else {
            Chart(Array(values.enumerated()), id: \.offset) { item in
                AreaMark(
                    x: .value("i", item.offset),
                    y: .value("v", item.element)
                )
                .foregroundStyle(color.opacity(0.15))
                LineMark(
                    x: .value("i", item.offset),
                    y: .value("v", item.element)
                )
                .foregroundStyle(color)
                .lineStyle(StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .chartLegend(.hidden)
        }
    }
}

#Preview { NavigationStack { DashboardView() } }
