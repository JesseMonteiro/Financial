import SwiftUI
import Charts
import MeuFluxDesignSystem
import MeuFluxDomain

public struct DashboardView: View {
    @Bindable var viewModel: DashboardViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showAllInsights = false
    @State private var selectedDetail: LineItemDetail?
    @State private var kpiSlideIndex = 0
    @State private var insightSlideIndex = 0
    @State private var purchaseSlideIndex = 0
    @State private var kpiAutoToken = 0
    @State private var insightAutoToken = 0

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
                LazyVStack(alignment: .leading, spacing: 24) {
                    homeTopBar
                    switch viewModel.state {
                    case .idle, .loading:
                        PageLoadingSkeleton(style: .dashboard, embedded: true)
                            .transition(.opacity.combined(with: .scale(scale: 0.98)))
                    case .empty:
                        emptyContent
                            .transition(.opacity)
                    case .failed(let message):
                        ErrorState(message: message) { Task { await viewModel.load(force: true) } }
                            .transition(.opacity)
                    case .loaded(let snap):
                        loadedContent(snap)
                            .transition(.opacity)
                    }
                }
                .animation(reduceMotion ? nil : MotionTokens.stateTransition, value: viewModel.state.stage)
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
            .cardEntrance(index: 0)
        EmptyState(
            title: "Nenhum dado ainda",
            message: "Conecte uma conta via Open Finance para ver patrimônio, gastos e insights.",
            systemImage: "chart.bar.doc.horizontal"
        )
        .cardEntrance(index: 1)
        if onConnect != nil {
            GradientCapsuleButton("Conectar Nova Conta", systemImage: "plus") {
                onConnect?()
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .cardEntrance(index: 2)
        }
    }

    @ViewBuilder
    private func loadedContent(_ snap: DashboardSnapshot) -> some View {
        homeHero(displayName: snap.displayName)
            .cardEntrance(index: 0)

        if !CalculationVersion.matches(snap.calculationVersion) {
            Text("Versão de cálculo desatualizada (\(snap.calculationVersion ?? "—")). Atualize o app.")
                .font(.caption)
                .foregroundStyle(MeuFluxColors.danger)
        }

        summaryCarousels(snap)
            .cardEntrance(index: 1)
        creditPurchasesCarousel
            .cardEntrance(index: 2)
        dailyFlowCard
            .cardEntrance(index: 3)

        netWorthChart(snap)
            .cardEntrance(index: 4)
        categoryChart(snap)
            .cardEntrance(index: 5)
        cashflowChart(snap)
            .cardEntrance(index: 6)
        recentTransactionsSection(snap)
            .cardEntrance(index: 7)
        if !snap.budgetCategories.isEmpty {
            budgetSection(snap)
                .cardEntrance(index: 8)
        }
        footerLinks(snap)
            .cardEntrance(index: 9)
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

    private func summaryCarousels(_ snap: DashboardSnapshot) -> some View {
        HStack(alignment: .top, spacing: 12) {
            insightsCarouselCard(snap.insights)
                .frame(maxWidth: .infinity)
            kpiCarouselCard(snap)
                .frame(maxWidth: .infinity)
        }
    }

    private func kpiCarouselCard(_ snap: DashboardSnapshot) -> some View {
        let slides = kpiSlides(snap)
        let count = slides.count

        return GlassCard(padding: 12) {
            TabView(selection: $kpiSlideIndex) {
                ForEach(Array(slides.enumerated()), id: \.offset) { offset, slide in
                    kpiSlideContent(slide)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        .tag(offset)
                }
            }
            .pageTabViewStyleNever()
        }
        .aspectRatio(1, contentMode: .fit)
        .task(id: "\(kpiAutoToken)-\(count)-\(reduceMotion)") {
            await runAutoAdvance(enabled: !reduceMotion && count > 1) {
                withAnimation(reduceMotion ? nil : MotionTokens.easeOutFast) {
                    kpiSlideIndex = (clampedIndex(kpiSlideIndex, count: count) + 1) % count
                }
            }
        }
        .onChange(of: kpiSlideIndex) { _, _ in
            kpiAutoToken &+= 1
        }
        .onChange(of: count) { _, newCount in
            kpiSlideIndex = clampedIndex(kpiSlideIndex, count: newCount)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Indicadores financeiros")
        .accessibilityValue(slides[clampedIndex(kpiSlideIndex, count: count)].title)
        .accessibilityAdjustableAction { direction in
            guard count > 0 else { return }
            switch direction {
            case .increment:
                kpiSlideIndex = (clampedIndex(kpiSlideIndex, count: count) + 1) % count
            case .decrement:
                kpiSlideIndex = (clampedIndex(kpiSlideIndex, count: count) - 1 + count) % count
            @unknown default: break
            }
        }
    }

    private func insightsCarouselCard(_ insights: [DashboardInsight]) -> some View {
        let hasInsights = !insights.isEmpty
        let activeInsight = hasInsights ? insights[clampedIndex(insightSlideIndex, count: insights.count)] : nil
        let accent = activeInsight.map { insightBorder($0.type) } ?? MeuFluxColors.info
        let shape = RoundedRectangle(cornerRadius: Radius().xxl, style: .continuous)

        return VStack(alignment: .leading, spacing: 0) {
            if hasInsights {
                TabView(selection: $insightSlideIndex) {
                    ForEach(Array(insights.enumerated()), id: \.element.id) { offset, insight in
                        insightSlideContent(insight)
                            .tag(offset)
                    }
                }
                .pageTabViewStyleNever()
            } else {
                emptyInsightSlide
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background {
            ZStack {
                FrostedFill(cornerRadius: Radius().xxl)
                if hasInsights {
                    shape.fill(
                        LinearGradient(
                            colors: [accent.opacity(0.24), accent.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                }
            }
        }
        .overlay {
            shape.strokeBorder(hasInsights ? accent.opacity(0.38) : MeuFluxColors.border, lineWidth: 1)
        }
        .overlay(alignment: .top) {
            shape
                .strokeBorder(
                    LinearGradient(
                        colors: [Color.white.opacity(0.28), Color.white.opacity(0)],
                        startPoint: .top,
                        endPoint: .center
                    ),
                    lineWidth: 1
                )
                .allowsHitTesting(false)
        }
        .clipShape(shape)
        .shadow(
            color: hasInsights ? accent.opacity(0.20) : MeuFluxColors.cardShadow,
            radius: 16,
            y: 8
        )
        .shadow(color: MeuFluxColors.cardShadowSecondary, radius: 8, y: 3)
        .aspectRatio(1, contentMode: .fit)
        .animation(.smooth(duration: 0.35), value: insightSlideIndex)
        .task(id: "\(insightAutoToken)-\(insights.count)-\(reduceMotion)") {
            await runAutoAdvance(enabled: !reduceMotion && insights.count > 1) {
                withAnimation(reduceMotion ? nil : MotionTokens.easeOutFast) {
                    insightSlideIndex = (clampedIndex(insightSlideIndex, count: insights.count) + 1) % insights.count
                }
            }
        }
        .onChange(of: insightSlideIndex) { _, _ in
            insightAutoToken &+= 1
        }
        .onChange(of: insights.count) { _, newCount in
            insightSlideIndex = clampedIndex(insightSlideIndex, count: max(newCount, 1))
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Insights")
        .accessibilityValue(
            hasInsights
                ? insights[clampedIndex(insightSlideIndex, count: insights.count)].text
                : "Sem insights"
        )
        .accessibilityAdjustableAction { direction in
            guard hasInsights else { return }
            let count = insights.count
            switch direction {
            case .increment:
                insightSlideIndex = (clampedIndex(insightSlideIndex, count: count) + 1) % count
            case .decrement:
                insightSlideIndex = (clampedIndex(insightSlideIndex, count: count) - 1 + count) % count
            @unknown default: break
            }
        }
    }

    @ViewBuilder
    private var creditPurchasesCarousel: some View {
        let purchases = viewModel.recentCreditPurchases
        if !purchases.isEmpty {
            GlassCard(padding: 0) {
                TabView(selection: $purchaseSlideIndex) {
                    ForEach(Array(purchases.enumerated()), id: \.element.id) { offset, purchase in
                        creditPurchaseSlide(purchase)
                            .tag(offset)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedDetail = LineItemDetail.from(dashboard: purchase)
                            }
                    }
                }
                .pageTabViewStyleNever()
                .frame(height: 76)
            }
            .onChange(of: purchases.count) { _, newCount in
                purchaseSlideIndex = clampedIndex(purchaseSlideIndex, count: max(newCount, 1))
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Últimas compras no cartão")
            .accessibilityValue(purchases[clampedIndex(purchaseSlideIndex, count: purchases.count)].description)
            .accessibilityAdjustableAction { direction in
                let count = purchases.count
                guard count > 0 else { return }
                switch direction {
                case .increment:
                    purchaseSlideIndex = (clampedIndex(purchaseSlideIndex, count: count) + 1) % count
                case .decrement:
                    purchaseSlideIndex = (clampedIndex(purchaseSlideIndex, count: count) - 1 + count) % count
                @unknown default: break
                }
            }
        }
    }

    private func creditPurchaseSlide(_ purchase: DashboardRecentTransaction) -> some View {
        let category = LineItemDetail.translatedCategory(purchase.category)
        let cardLabel = purchase.accountName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let subtitleParts = [category, purchase.dateRelative, cardLabel].compactMap { part -> String? in
            guard let part, !part.isEmpty else { return nil }
            return part
        }

        let merchantMatch = MerchantLogoCatalog.match(text: purchase.description)

        return HStack(spacing: 12) {
            if let merchant = merchantMatch {
                MerchantLogoView(entry: merchant, size: 36)
            } else {
                let tint = purchaseTint(purchase.category)
                Image(systemName: PurchaseCategoryCatalog.systemImage(for: purchase.category, in: viewModel.purchaseCategories))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 36, height: 36)
                    .background(tint.opacity(0.12), in: Circle())
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("Últimas compras")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .lineLimit(1)
                Text(purchase.description)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .allowsTightening(true)
                Text(subtitleParts.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .allowsTightening(true)
            }

            Spacer(minLength: 8)

            Text("- \(purchase.amount.formatted())")
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(MeuFluxColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .allowsTightening(true)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func purchaseTint(_ category: String) -> Color {
        if let hex = PurchaseCategoryCatalog.color(for: category, in: viewModel.purchaseCategories),
           let color = Color(hexString: hex) {
            return color
        }
        return MeuFluxColors.danger
    }

    @ViewBuilder
    private func kpiSlideContent(_ slide: KPISlide) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 4) {
                Text(slide.title.uppercased())
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                    .allowsTightening(true)
                    .truncationMode(.tail)
                Spacer(minLength: 4)
                Image(systemName: slide.icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(slide.iconTint)
                    .frame(width: 24, height: 24)
                    .background(slide.iconTint.opacity(0.12), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6, style: .continuous)
                            .strokeBorder(slide.iconTint.opacity(0.18), lineWidth: 1)
                    )
            }
            Text(slide.value)
                .font(.system(size: 19, weight: .bold).monospacedDigit())
                .tracking(-0.3)
                .foregroundStyle(slide.valueColor)
                .lineLimit(1)
                .minimumScaleFactor(0.55)
                .allowsTightening(true)
                .truncationMode(.tail)
            Text(slide.subtitle)
                .font(.system(size: 10.5, weight: .medium))
                .lineSpacing(2)
                .foregroundStyle(MeuFluxColors.textMuted)
                .lineLimit(2)
                .minimumScaleFactor(0.72)
                .allowsTightening(true)
                .truncationMode(.tail)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 2)
            SparklineChart(values: slide.sparkline, color: slide.iconTint)
                .frame(maxWidth: .infinity)
                .frame(height: 32)
                .clipped()
        }
    }

    private struct InsightTypography {
        let fontSize: CGFloat
        let lineSpacing: CGFloat
        let maxLines: Int
        let minScale: CGFloat
    }

    private func optimalInsightTypography(for text: String) -> InsightTypography {
        let count = text.count
        switch count {
        case ..<45:
            return InsightTypography(fontSize: 16.5, lineSpacing: 4.0, maxLines: 4, minScale: 0.85)
        case 45..<75:
            return InsightTypography(fontSize: 15.0, lineSpacing: 3.5, maxLines: 4, minScale: 0.80)
        case 75..<110:
            return InsightTypography(fontSize: 13.5, lineSpacing: 2.5, maxLines: 5, minScale: 0.75)
        case 110..<150:
            return InsightTypography(fontSize: 12.5, lineSpacing: 2.0, maxLines: 6, minScale: 0.72)
        default:
            return InsightTypography(fontSize: 11.5, lineSpacing: 1.5, maxLines: 6, minScale: 0.70)
        }
    }

    private func insightSlideContent(_ insight: DashboardInsight) -> some View {
        let accent = insightBorder(insight.type)
        let footer = insightFooter(insight)
        let typography = optimalInsightTypography(for: insight.text)

        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 6) {
                Text("INSIGHTS")
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 4)
                Button {
                    showAllInsights = true
                } label: {
                    Text("Todos")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(accent)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(MeuFluxColors.bgSecondary.opacity(0.72), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Ver todos os insights")
            }

            Spacer(minLength: 6)

            tintedInsightLabel(insight.text, accent: accent, typography: typography)
                .lineLimit(typography.maxLines)
                .minimumScaleFactor(typography.minScale)
                .allowsTightening(true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Spacer(minLength: 8)

            HStack(spacing: 5) {
                Image(systemName: footer.icon)
                    .font(.system(size: 11, weight: .medium))
                Text(footer.label)
                    .font(.system(size: 10.5, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .allowsTightening(true)
                    .truncationMode(.tail)
                Spacer(minLength: 0)
            }
            .foregroundStyle(MeuFluxColors.textPrimary.opacity(0.72))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func tintedInsightLabel(_ text: String, accent: Color, typography: InsightTypography) -> some View {
        Text(tintedHighlightedInsight(text, accent: accent, fontSize: typography.fontSize))
            .lineSpacing(typography.lineSpacing)
    }

    private func tintedHighlightedInsight(_ text: String, accent: Color, fontSize: CGFloat) -> AttributedString {
        var attributed = AttributedString(text)
        attributed.font = .system(size: fontSize, weight: .semibold)
        attributed.foregroundColor = MeuFluxColors.textPrimary
        let ns = text as NSString
        guard let regex = try? NSRegularExpression(pattern: #"[+\-]?\d+%"#) else { return attributed }
        for match in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
            guard let stringRange = Range(match.range, in: text),
                  let start = AttributedString.Index(stringRange.lowerBound, within: attributed),
                  let end = AttributedString.Index(stringRange.upperBound, within: attributed) else { continue }
            attributed[start..<end].font = .system(size: fontSize, weight: .bold)
            attributed[start..<end].foregroundColor = accent
        }
        return attributed
    }

    private var emptyInsightSlide: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("INSIGHTS")
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(MeuFluxColors.textMuted)
                .lineLimit(1)
            Spacer(minLength: 6)
            Text("Ainda sem insights")
                .font(.system(size: 15.5, weight: .bold))
                .foregroundStyle(MeuFluxColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .allowsTightening(true)
                .truncationMode(.tail)
            Spacer(minLength: 4)
            Text("Conecte contas e sincronize para ver o que mudou nas suas finanças.")
                .font(.system(size: 12, weight: .medium))
                .lineSpacing(2)
                .foregroundStyle(MeuFluxColors.textMuted)
                .lineLimit(4)
                .minimumScaleFactor(0.8)
                .allowsTightening(true)
                .truncationMode(.tail)
            Spacer(minLength: 6)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private struct KPISlide: Identifiable {
        let id: String
        let title: String
        let value: String
        let subtitle: String
        let valueColor: Color
        let icon: String
        let iconTint: Color
        let sparkline: [Double]
    }

    private func kpiSlides(_ snap: DashboardSnapshot) -> [KPISlide] {
        [
            KPISlide(
                id: "net-worth",
                title: "Patrimônio Líquido",
                value: snap.summary.netWorth.formatted(),
                subtitle: "Ativos: \(snap.summary.totalAssets.formatted())\nDívidas: -\(snap.summary.creditDebt.formatted())",
                valueColor: snap.summary.netWorth.amount >= 0 ? MeuFluxColors.textPrimary : MeuFluxColors.danger,
                icon: "chart.line.uptrend.xyaxis",
                iconTint: MeuFluxColors.primary,
                sparkline: snap.netWorthSeries.map(\.value)
            ),
            KPISlide(
                id: "bank-balance",
                title: "Saldo em Contas",
                value: snap.summary.bankBalance.formatted(),
                subtitle: bankSubtitle(snap),
                valueColor: MeuFluxColors.textPrimary,
                icon: "wallet.pass.fill",
                iconTint: MeuFluxColors.success,
                sparkline: snap.incomeExpenseSeries.map(\.net)
            ),
            KPISlide(
                id: "savings-rate",
                title: "Taxa Poupança",
                value: savingsRateText(snap.cashflow.savingsRate),
                subtitle: "Líquido: \(snap.cashflow.net.formatted())\nReceitas: \(snap.cashflow.income.formatted())",
                valueColor: (snap.cashflow.savingsRate ?? 0) >= 0 ? MeuFluxColors.success : MeuFluxColors.danger,
                icon: "percent",
                iconTint: MeuFluxColors.info,
                sparkline: snap.incomeExpenseSeries.map(\.net)
            ),
            KPISlide(
                id: "mom-expense",
                title: "Gastos vs Mês Ant.",
                value: momText(snap.monthOverMonth.expenseDeltaPct),
                subtitle: "Este mês: \(snap.cashflow.expense.formatted())\nMês ant.: \(snap.monthOverMonth.previousExpense.formatted())",
                valueColor: snap.monthOverMonth.expenseDeltaPct > 0 ? MeuFluxColors.danger : MeuFluxColors.success,
                icon: "chart.bar.fill",
                iconTint: snap.monthOverMonth.expenseDeltaPct > 0 ? MeuFluxColors.danger : MeuFluxColors.success,
                sparkline: snap.incomeExpenseSeries.map(\.despesa)
            )
        ]
    }

    private func clampedIndex(_ index: Int, count: Int) -> Int {
        guard count > 0 else { return 0 }
        return min(max(index, 0), count - 1)
    }

    private func runAutoAdvance(
        enabled: Bool,
        advance: @MainActor () -> Void
    ) async {
        guard enabled else { return }
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            advance()
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
                        dailyFlowSelectionHeader
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("MÉDIA DIÁRIA")
                                .font(.system(size: 10, weight: .bold))
                                .tracking(0.6)
                                .foregroundStyle(MeuFluxColors.textMuted)
                                .lineLimit(1)
                            Text(Money(amount: viewModel.dailyAverage).formatted())
                                .font(.subheadline.weight(.bold).monospacedDigit())
                                .foregroundStyle(MeuFluxColors.textPrimary)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                                .allowsTightening(true)
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
                            categoryKey: tx.category,
                            purchaseCategories: viewModel.purchaseCategories,
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
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                                .allowsTightening(true)
                            Spacer()
                            Text("\(budget.spent.formatted()) / \(budget.limit.formatted())")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(MeuFluxColors.textMuted)
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                                .allowsTightening(true)
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
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Spacer()
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .foregroundStyle(MeuFluxColors.info)
                    }
                    Text(snap.summary.investmentTotal.formatted())
                        .font(.title3.weight(.bold).monospacedDigit())
                        .foregroundStyle(MeuFluxColors.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)
                        .allowsTightening(true)
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
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                        Spacer()
                        Image(systemName: "creditcard.fill")
                            .foregroundStyle(MeuFluxColors.danger)
                    }
                    Text(snap.summary.creditDebt.formatted())
                        .font(.title3.weight(.bold).monospacedDigit())
                        .foregroundStyle(MeuFluxColors.danger)
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)
                        .allowsTightening(true)
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

    private func bankSubtitle(_ snap: DashboardSnapshot) -> String {
        let n = snap.summary.bankCount
        let countText = "\(n) \(n == 1 ? "conta bancária" : "contas bancárias")"
        if snap.summary.reservedBalance.amount > 0 {
            return "\(countText)\nCaixinhas: \(snap.summary.reservedBalance.formatted())"
        }
        return "\(countText)\nTotal disponível"
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

    private var dailyFlowSelectionHeader: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(Money(amount: viewModel.displayedDailyAmount).formatted())
                    .font(.system(size: 24, weight: .bold).monospacedDigit())
                    .tracking(-0.4)
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .allowsTightening(true)

                if viewModel.isDaySelected {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            viewModel.clearSelection()
                        }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(MeuFluxColors.textMuted.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Limpar seleção do gráfico")
                }
            }

            if let purchase = viewModel.displayedDailyPurchase {
                Button {
                    selectedDetail = LineItemDetail.from(dashboard: purchase)
                } label: {
                    dailyPurchaseDetailRow(purchase)
                }
                .buttonStyle(.plain)
            } else if let selectedPoint = viewModel.selectedPoint {
                if selectedPoint.amount == 0 {
                    Text("Sem gastos · \(dateFormatted(selectedPoint.day))")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .lineLimit(1)
                } else {
                    Text("Gasto total do dia · \(dateFormatted(selectedPoint.day))")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .lineLimit(1)
                }
            } else {
                Text(largestPurchaseLabel(viewModel.largestPurchase))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .allowsTightening(true)
            }
        }
    }

    private func dailyPurchaseDetailRow(_ purchase: DashboardRecentTransaction) -> some View {
        let category = LineItemDetail.translatedCategory(purchase.category)
        let merchantMatch = MerchantLogoCatalog.match(text: purchase.description)
        let subtitle: String = {
            if viewModel.isDaySelected {
                var parts = [category]
                if let selectedPoint = viewModel.selectedPoint, selectedPoint.purchases.count > 1 {
                    parts.append("+\(selectedPoint.purchases.count - 1)")
                }
                if let acc = purchase.accountName, !acc.isEmpty {
                    parts.append(acc)
                }
                return parts.joined(separator: " · ")
            } else {
                let dayStr = purchase.dateRelative.isEmpty ? purchase.date : purchase.dateRelative
                return "Maior compra · \(dayStr)"
            }
        }()

        return HStack(spacing: 8) {
            if let merchant = merchantMatch {
                MerchantLogoView(entry: merchant, size: 22)
            } else {
                let tint = purchaseTint(purchase.category)
                Image(systemName: PurchaseCategoryCatalog.systemImage(for: purchase.category, in: viewModel.purchaseCategories))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 22, height: 22)
                    .background(tint.opacity(0.14), in: Circle())
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(purchase.description)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .allowsTightening(true)

                Text(subtitle)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .allowsTightening(true)
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(MeuFluxColors.textMuted.opacity(0.6))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(MeuFluxColors.bgTertiary.opacity(0.6), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .contentShape(Rectangle())
    }

    private func dateFormatted(_ day: InstantDate) -> String {
        if day.isToday { return "Hoje" }
        return day.formatted(template: "d MMM")
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
            .lineLimit(truncated ? 2 : nil)
            .minimumScaleFactor(0.85)
            .allowsTightening(true)
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

private extension View {
    @ViewBuilder
    func pageTabViewStyleNever() -> some View {
        #if os(iOS)
        self.tabViewStyle(.page(indexDisplayMode: .never))
        #else
        self.tabViewStyle(.automatic)
        #endif
    }
}
