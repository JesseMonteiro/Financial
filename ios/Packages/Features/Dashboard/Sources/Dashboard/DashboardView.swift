import SwiftUI
import Charts
import MeuFluxDesignSystem
import MeuFluxDomain

public struct DashboardView: View {
    @Bindable var viewModel: DashboardViewModel
    @State private var showAllInsights = false
    @State private var selectedDetail: LineItemDetail?

    private let accountName: String
    private let accountEmail: String
    private let onConnect: (() -> Void)?
    private let onSignOut: (() -> Void)?
    private let onTransactions: (() -> Void)?
    private let onCreditCards: (() -> Void)?
    private let onInvestments: (() -> Void)?
    private let onAgenda: (() -> Void)?
    private let onBudget: (() -> Void)?

    public init(
        viewModel: DashboardViewModel,
        accountName: String = "",
        accountEmail: String = "",
        onConnect: (() -> Void)? = nil,
        onSignOut: (() -> Void)? = nil,
        onTransactions: (() -> Void)? = nil,
        onCreditCards: (() -> Void)? = nil,
        onInvestments: (() -> Void)? = nil,
        onAgenda: (() -> Void)? = nil,
        onBudget: (() -> Void)? = nil
    ) {
        self.viewModel = viewModel
        self.accountName = accountName
        self.accountEmail = accountEmail
        self.onConnect = onConnect
        self.onSignOut = onSignOut
        self.onTransactions = onTransactions
        self.onCreditCards = onCreditCards
        self.onInvestments = onInvestments
        self.onAgenda = onAgenda
        self.onBudget = onBudget
    }

    public init(
        loadDashboard: any LoadDashboardUseCase,
        transactions: (any TransactionsRepository)? = nil,
        accountName: String = "",
        accountEmail: String = "",
        onConnect: (() -> Void)? = nil,
        onSignOut: (() -> Void)? = nil,
        onTransactions: (() -> Void)? = nil,
        onCreditCards: (() -> Void)? = nil,
        onInvestments: (() -> Void)? = nil,
        onAgenda: (() -> Void)? = nil,
        onBudget: (() -> Void)? = nil
    ) {
        self.init(
            viewModel: DashboardViewModel(
                loadDashboard: loadDashboard,
                transactions: transactions
            ),
            accountName: accountName,
            accountEmail: accountEmail,
            onConnect: onConnect,
            onSignOut: onSignOut,
            onTransactions: onTransactions,
            onCreditCards: onCreditCards,
            onInvestments: onInvestments,
            onAgenda: onAgenda,
            onBudget: onBudget
        )
    }

    public init() {
        self.init(loadDashboard: StubLoadDashboard())
    }

    public var body: some View {
        PageChrome {
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: 24) {
                    homeTopBar
                    switch viewModel.state {
                    case .idle, .loading:
                        PageLoadingSkeleton(style: .dashboard, embedded: true)
                    case .empty:
                        emptyContent
                    case .failed(let message):
                        ErrorState(message: message) { Task { await viewModel.load(force: true) } }
                    case .loaded(let snap):
                        loadedContent(snap)
                    }
                }
                .meuFluxPageGutter()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
            .scrollClipDisabled()
        }
        #if os(iOS)
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .sheet(isPresented: $showAllInsights) {
            NavigationStack {
                insightsList(viewModel.loadedSnapshot?.insights ?? [])
                    .meuFluxPageTitle("Insights")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Fechar") { showAllInsights = false }
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

    private var homeTopBar: some View {
        HStack(spacing: 8) {
            BrandWordmark(size: 26)
            ProBadge()
            Spacer(minLength: 8)
            ProfileAccountMenu(
                displayName: menuDisplayName,
                email: accountEmail,
                onSignOut: onSignOut
            )
        }
        .accessibilityElement(children: .contain)
        .zIndex(2)
    }

    private var menuDisplayName: String {
        if let snap = viewModel.loadedSnapshot {
            let name = snap.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            let generic = name.isEmpty || ["usuário", "usuario", "você", "voce"].contains(name.lowercased())
            if !generic { return name }
        }
        let fallback = accountName.trimmingCharacters(in: .whitespacesAndNewlines)
        return fallback.isEmpty ? "Usuário" : fallback
    }

    @ViewBuilder
    private var emptyContent: some View {
        homeHero(displayName: "você")
        EmptyState(
            title: "Nenhum dado ainda",
            message: "Conecte uma conta via Open Finance para ver patrimônio, gastos e insights.",
            systemImage: "chart.bar.doc.horizontal"
        )
        if onConnect != nil {
            GradientCapsuleButton("Conectar Nova Conta", systemImage: "plus") {
                onConnect?()
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
    }

    @ViewBuilder
    private func loadedContent(_ snap: DashboardSnapshot) -> some View {
        homeHero(displayName: snap.displayName)

        if !CalculationVersion.matches(snap.calculationVersion) {
            Text("Versão de cálculo desatualizada (\(snap.calculationVersion ?? "—")). Atualize o app.")
                .font(.caption)
                .foregroundStyle(MeuFluxColors.danger)
        }

        kpiGrid(snap)
        dailyFlowCard

        if !snap.insights.isEmpty {
            insightsStream(snap.insights)
        }

        netWorthChart(snap)
        categoryChart(snap)
        cashflowChart(snap)
        recentTransactionsSection(snap)
        if !snap.budgetCategories.isEmpty {
            budgetSection(snap)
        }
        footerLinks(snap)
    }

    private func homeHero(displayName: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Olá, \(displayName)!")
                    .font(.system(size: 20, weight: .bold))
                    .tracking(-0.3)
                    .foregroundStyle(MeuFluxColors.textPrimary)
                Text("Visão consolidada das suas contas sincronizadas via Open Finance.")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
            Spacer(minLength: 8)
            if onConnect != nil {
                GradientCapsuleButton("Conectar") {
                    onConnect?()
                }
            }
        }
    }

    private func kpiGrid(_ snap: DashboardSnapshot) -> some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(minimum: 0), spacing: 12),
                GridItem(.flexible(minimum: 0), spacing: 12)
            ],
            spacing: 12
        ) {
            kpiCard(
                title: "Patrimônio Líquido",
                value: snap.summary.netWorth.formatted(),
                subtitle: "Ativos \(snap.summary.totalAssets.formatted()) · Dívidas -\(snap.summary.creditDebt.formatted())",
                valueColor: snap.summary.netWorth.amount >= 0 ? MeuFluxColors.textPrimary : MeuFluxColors.danger,
                icon: "chevron.backward",
                iconTint: MeuFluxColors.primary
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
                iconTint: MeuFluxColors.success
            ) {
                SparklineChart(
                    values: snap.incomeExpenseSeries.map(\.net),
                    color: MeuFluxColors.success
                )
            }

            kpiCard(
                title: "Taxa Poupança",
                value: savingsRateText(snap.cashflow.savingsRate),
                subtitle: "Líquido do mês: \(snap.cashflow.net.formatted())",
                valueColor: (snap.cashflow.savingsRate ?? 0) >= 0 ? MeuFluxColors.success : MeuFluxColors.danger,
                icon: "percent",
                iconTint: MeuFluxColors.info
            ) {
                SparklineChart(
                    values: snap.incomeExpenseSeries.map(\.net),
                    color: MeuFluxColors.info
                )
            }

            kpiCard(
                title: "Gastos vs Mês A...",
                value: momText(snap.monthOverMonth.expenseDeltaPct),
                subtitle: "Este mês \(snap.cashflow.expense.formatted()) · ant. \(snap.monthOverMonth.previousExpense.formatted())",
                valueColor: snap.monthOverMonth.expenseDeltaPct > 0 ? MeuFluxColors.danger : MeuFluxColors.success,
                icon: "chart.bar.fill",
                iconTint: snap.monthOverMonth.expenseDeltaPct > 0 ? MeuFluxColors.danger : MeuFluxColors.success
            ) {
                SparklineChart(
                    values: snap.incomeExpenseSeries.map(\.despesa),
                    color: MeuFluxColors.danger
                )
            }
        }
    }

    private var dailyFlowCard: some View {
        GlassCard(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(MeuFluxColors.primary)
                                .frame(width: 8, height: 8)
                                .shadow(color: MeuFluxColors.primary.opacity(0.5), radius: 4)
                            Text("Fluxo Diário")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundStyle(MeuFluxColors.textPrimary)
                        }
                        Text("Curva de pagamentos por período")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(MeuFluxColors.textMuted)
                    }
                    Spacer()
                    rangePicker
                }

                if !viewModel.visibleDailySpend.isEmpty {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(Money(amount: viewModel.largestPurchaseAmount).formatted())
                                .font(.system(size: 24, weight: .bold).monospacedDigit())
                                .tracking(-0.4)
                                .foregroundStyle(MeuFluxColors.textPrimary)
                            Text(largestPurchaseLabel(viewModel.largestPurchase))
                                .font(.caption.weight(.medium))
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("MÉDIA DIÁRIA")
                                .font(.system(size: 10, weight: .bold))
                                .tracking(0.6)
                                .foregroundStyle(MeuFluxColors.textMuted)
                            Text(Money(amount: viewModel.dailyAverage).formatted())
                                .font(.subheadline.weight(.bold).monospacedDigit())
                                .foregroundStyle(MeuFluxColors.textPrimary)
                        }
                    }
                }

                DailyFlowChart(
                    points: viewModel.visibleDailySpend,
                    average: viewModel.dailyAverage,
                    selectedDay: viewModel.selectedDay
                ) { day in
                    viewModel.select(day: day)
                }
            }
        }
    }

    private var rangePicker: some View {
        HStack(spacing: 0) {
            ForEach(DailyFlowRange.allCases) { range in
                Button {
                    viewModel.dailyRange = range
                } label: {
                    Text(range.label)
                        .font(.system(size: 11, weight: .semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .foregroundStyle(
                            viewModel.dailyRange == range ? MeuFluxColors.primary : MeuFluxColors.textMuted
                        )
                        .background {
                            if viewModel.dailyRange == range {
                                Capsule().fill(MeuFluxColors.bgSecondary)
                                    .shadow(color: MeuFluxColors.cardShadowSecondary, radius: 2, y: 1)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(MeuFluxColors.bgTertiary.opacity(0.9), in: Capsule())
        .overlay(Capsule().strokeBorder(MeuFluxColors.border.opacity(0.6), lineWidth: 1))
        .accessibilityLabel("Período do fluxo diário")
    }

    private func netWorthChart(_ snap: DashboardSnapshot) -> some View {
        Group {
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
                            .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 180)
                        .clipped()
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
        }
    }

    private func categoryChart(_ snap: DashboardSnapshot) -> some View {
        Group {
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
                            .cornerRadius(6)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: CGFloat(max(140, snap.categoryExpenses.count * 28)))
                        .clipped()
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
        }
    }

    private func cashflowChart(_ snap: DashboardSnapshot) -> some View {
        Group {
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
                                .cornerRadius(6)

                                BarMark(
                                    x: .value("Mês", point.month),
                                    y: .value("Despesa", point.despesa)
                                )
                                .foregroundStyle(MeuFluxColors.danger)
                                .position(by: .value("Tipo", "Despesa"))
                                .cornerRadius(6)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 180)
                        .clipped()
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
        }
    }

    private func recentTransactionsSection(_ snap: DashboardSnapshot) -> some View {
        GlassCard(padding: 14) {
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
                                .font(.caption.monospacedDigit())
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
                                    .frame(width: geo.size.width * CGFloat(min(budget.percent, 100)) / 100)
                            }
                        }
                        .frame(height: 8)
                    }
                    .padding(10)
                    .background(MeuFluxColors.bgTertiary.opacity(0.7))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
    }

    private func footerLinks(_ snap: DashboardSnapshot) -> some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(minimum: 0), spacing: 12),
                GridItem(.flexible(minimum: 0), spacing: 12)
            ],
            spacing: 12
        ) {
            GlassCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("INVESTIMENTOS")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(0.5)
                            .foregroundStyle(MeuFluxColors.textMuted)
                        Spacer()
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .foregroundStyle(MeuFluxColors.info)
                    }
                    Text(snap.summary.investmentTotal.formatted())
                        .font(.title3.weight(.bold).monospacedDigit())
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
                            .font(.system(size: 11, weight: .bold))
                            .tracking(0.5)
                            .foregroundStyle(MeuFluxColors.textMuted)
                        Spacer()
                        Image(systemName: "creditcard.fill")
                            .foregroundStyle(MeuFluxColors.danger)
                    }
                    Text(snap.summary.creditDebt.formatted())
                        .font(.title3.weight(.bold).monospacedDigit())
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
                    if onAgenda != nil {
                        Button {
                            onAgenda?()
                        } label: {
                            Text("Ver agenda →")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(MeuFluxColors.primary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func color(from hexString: String) -> Color? {
        var clean = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.hasPrefix("#") { clean = String(clean.dropFirst()) }
        guard let value = UInt32(clean, radix: 16) else { return nil }
        return Color(hex: value)
    }

    private func insightsStream(_ insights: [DashboardInsight]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Insights")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                    Text("O que mudou nas suas finanças")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(MeuFluxColors.textMuted)
                }
                Spacer()
                if !insights.isEmpty {
                    Button {
                        showAllInsights = true
                    } label: {
                        HStack(spacing: 2) {
                            Text("Ver Todos")
                                .font(.caption.weight(.semibold))
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(MeuFluxColors.primary)
                    }
                    .buttonStyle(.plain)
                }
            }

            let preview = Array(insights.prefix(3))
            ForEach(Array(preview.enumerated()), id: \.element.id) { index, insight in
                insightCard(insight, truncated: index == 2 && insights.count > 2)
            }
        }
    }

    private func insightsList(_ insights: [DashboardInsight]) -> some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(insights) { insight in
                    insightCard(insight, truncated: false)
                }
            }
            .meuFluxPageGutter()
        }
        .background(MeuFluxColors.bgPrimary)
    }

    private func insightCard(_ insight: DashboardInsight, truncated: Bool) -> some View {
        let accent = insightBorder(insight.type)
        let footer = insightFooter(insight)
        return GlassCard(padding: 16) {
            VStack(alignment: .leading, spacing: 8) {
                insightLabel(insight.text, accent: accent, truncated: truncated)
                HStack(spacing: 6) {
                    Image(systemName: footer.icon)
                        .font(.system(size: 12, weight: .medium))
                    Text(footer.label)
                        .font(.caption.weight(.medium))
                }
                .foregroundStyle(footer.tint)
            }
            .padding(.leading, 6)
        }
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(
                topLeadingRadius: Radius().xxl,
                bottomLeadingRadius: Radius().xxl,
                bottomTrailingRadius: 0,
                topTrailingRadius: 0,
                style: .continuous
            )
            .fill(
                LinearGradient(
                    colors: [accent, accent.opacity(0.5)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .frame(width: 4)
        }
        .opacity(truncated ? 0.9 : 1)
    }

    private func kpiCard<Chart: View>(
        title: String,
        value: String,
        subtitle: String,
        valueColor: Color,
        icon: String,
        iconTint: Color,
        @ViewBuilder chart: () -> Chart
    ) -> some View {
        GlassCard(padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Text(title.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .lineLimit(2)
                    Spacer(minLength: 4)
                    Image(systemName: icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(iconTint)
                        .frame(width: 28, height: 28)
                        .background(iconTint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                .strokeBorder(iconTint.opacity(0.18), lineWidth: 1)
                        )
                }
                Text(value)
                    .font(.system(size: 20, weight: .bold).monospacedDigit())
                    .tracking(-0.3)
                    .foregroundStyle(valueColor)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .lineLimit(2)
                chart()
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .clipped()
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

    private func insightFooter(_ insight: DashboardInsight) -> (icon: String, label: String, tint: Color) {
        if insight.generatedOnDevice {
            return ("iphone", "Gerado no iPhone", MeuFluxColors.textMuted)
        }
        if insight.type == "positive" {
            return ("chart.line.downtrend.xyaxis", "Economia identificada", MeuFluxColors.success)
        }
        return ("cart.fill", "Classificação automática", MeuFluxColors.textMuted)
    }

    private func largestPurchaseLabel(_ point: DailySpendPoint?) -> String {
        guard let point else { return "Maior compra do período" }
        if point.isToday {
            return "Maior compra · Hoje"
        }
        return "Maior compra · \(point.day.formatted(template: "d MMMM"))"
    }

    private func insightLabel(_ text: String, accent: Color, truncated: Bool) -> some View {
        Text(highlightedInsight(text, accent: accent))
            .lineLimit(truncated ? 1 : nil)
    }

    private func highlightedInsight(_ text: String, accent: Color) -> AttributedString {
        var attributed = AttributedString(text)
        attributed.font = .subheadline.weight(.medium)
        attributed.foregroundColor = MeuFluxColors.textPrimary
        let ns = text as NSString
        guard let regex = try? NSRegularExpression(pattern: #"[+\-]?\d+%"#) else { return attributed }
        for match in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            guard let stringRange = Range(match.range, in: text),
                  let start = AttributedString.Index(stringRange.lowerBound, within: attributed),
                  let end = AttributedString.Index(stringRange.upperBound, within: attributed) else { continue }
            attributed[start..<end].font = .subheadline.weight(.bold)
            attributed[start..<end].foregroundColor = accent
        }
        return attributed
    }
}

private extension DashboardViewModel {
    var loadedSnapshot: DashboardSnapshot? {
        if case .loaded(let snap) = state { return snap }
        return nil
    }
}

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
                .interpolationMethod(.catmullRom)
                .foregroundStyle(
                    LinearGradient(
                        colors: [color.opacity(0.30), color.opacity(0)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                LineMark(
                    x: .value("i", item.offset),
                    y: .value("v", item.element)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(color)
                .lineStyle(StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .chartLegend(.hidden)
            .frame(maxWidth: .infinity)
            .clipped()
        }
    }
}

#Preview("Light") { NavigationStack { DashboardView() } }
#Preview("Dark") {
    NavigationStack { DashboardView() }
        .preferredColorScheme(.dark)
}
