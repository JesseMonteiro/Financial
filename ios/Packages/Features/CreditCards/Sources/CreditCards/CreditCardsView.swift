import SwiftUI
import Charts
import UniformTypeIdentifiers
import MeuFluxDesignSystem
import MeuFluxDomain

public struct CreditCardsView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel: CreditCardsViewModel
    @State private var showPurchase = false
    @State private var showImporter = false
    @State private var selectedLine: CreditBillLine?
    @State private var showCreateReceivable = false
    @State private var receivablePerson = ""
    /// Blocks scrollPosition → selection while the strip settles after load / programmatic jumps
    /// (same idea as web `ignoreBillScrollRef` — prevents latching onto the first chip).
    @State private var ignoreCardScrollSelection = true
    @State private var ignoreBillScrollSelection = true
    /// Local scroll anchors — updated after layout so the strip centres on the preferred item
    /// instead of sticking to the leading edge on first appear.
    @State private var cardScrollPosition: String?
    @State private var billScrollPosition: String?
    private let onReceivables: (() -> Void)?

    public init(
        repository: any CreditCardsRepository,
        manuals: (any ManualExpensesRepository)? = nil,
        parseBill: (any ParseBillUseCase)? = nil,
        receivables: (any ReceivablesRepository)? = nil,
        transactions: (any TransactionsRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil,
        onReceivables: (() -> Void)? = nil
    ) {
        _viewModel = State(initialValue: CreditCardsViewModel(
            repository: repository,
            manuals: manuals,
            parseBill: parseBill,
            receivables: receivables,
            transactions: transactions,
            purchaseCategories: purchaseCategories
        ))
        self.onReceivables = onReceivables
    }

    public init() {
        _viewModel = State(initialValue: CreditCardsViewModel())
        self.onReceivables = nil
    }

    public var body: some View {
        PageChrome {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    PageLoadingSkeleton(style: .creditCards)
                        .transition(.opacity.combined(with: .scale(scale: 0.98)))
                case .empty:
                    EmptyState(
                        title: "Nenhum cartão",
                        message: "Conecte cartões de crédito em Conexões Bancárias.",
                        systemImage: "creditcard"
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
        }
        .meuFluxPageTitle("Cartões de Crédito")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button("Compra manual") { showPurchase = true }
                    Button("Importar fatura PDF") { showImporter = true }
                    if onReceivables != nil {
                        Button("Valores a receber") { onReceivables?() }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.pdf]) { result in
            if case .success(let url) = result {
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                if let data = try? Data(contentsOf: url) {
                    Task { await viewModel.parsePDF(data: data) }
                }
            }
        }
        .sheet(isPresented: $showPurchase) {
            NavigationStack {
                Form {
                    TextField("Descrição", text: $viewModel.purchaseDescription)
                    TextField("Valor", text: $viewModel.purchaseAmount)
                    DatePicker("Data", selection: $viewModel.purchaseDate, displayedComponents: .date)
                }
                .navigationTitle("Compra no cartão")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { showPurchase = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Salvar") {
                            Task {
                                await viewModel.addPurchase()
                                showPurchase = false
                            }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: Binding(
            get: { viewModel.parsedBill != nil },
            set: { if !$0 { viewModel.parsedBill = nil } }
        )) {
            NavigationStack {
                List {
                    if let bill = viewModel.parsedBill {
                        Section("Fatura") {
                            LabeledContent("Total", value: bill.totalAmount.formatted())
                            if let due = bill.dueDate {
                                LabeledContent("Vencimento", value: due.formatted())
                            }
                        }
                        Section("Compras") {
                            ForEach(bill.purchases) { purchase in
                                Toggle(isOn: Binding(
                                    get: { viewModel.includedPurchaseIDs.contains(purchase.id) },
                                    set: { on in
                                        if on { viewModel.includedPurchaseIDs.insert(purchase.id) }
                                        else { viewModel.includedPurchaseIDs.remove(purchase.id) }
                                    }
                                )) {
                                    VStack(alignment: .leading) {
                                        Text(purchase.description)
                                        Text(purchase.amount.formatted())
                                            .font(.caption)
                                            .foregroundStyle(MeuFluxColors.textSecondary)
                                    }
                                }
                            }
                        }
                    }
                }
                .navigationTitle("Revisar fatura")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { viewModel.parsedBill = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Importar") {
                            Task { await viewModel.confirmParsedPurchases() }
                        }
                    }
                }
            }
        }
        .sheet(item: $selectedLine) { line in
            let detail = LineItemDetail.from(
                billLine: renamedLine(line),
                canCreateReceivable: viewModel.canCreateReceivable(for: line)
            )
            LineItemDetailSheet(
                item: detail,
                categoryOptions: viewModel.categoryOptions,
                onCreateReceivable: {
                    receivablePerson = ""
                    showCreateReceivable = true
                },
                onChangeCategory: { option in
                    Task {
                        await viewModel.changeCategory(id: detail.sourceId, option: option)
                        if var line = selectedLine, line.id == detail.sourceId {
                            line.category = option.label
                            line.categoryId = option.id
                            selectedLine = line
                        }
                    }
                }
            )
        }
        .sheet(isPresented: $showCreateReceivable) {
            NavigationStack {
                Form {
                    TextField("Nome da pessoa", text: $receivablePerson)
                    if let line = selectedLine {
                        LabeledContent("Valor", value: line.amount.formatted())
                        LabeledContent("Compra", value: line.description)
                    }
                }
                .navigationTitle("Valor a receber")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { showCreateReceivable = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Salvar") {
                            Task {
                                if let line = selectedLine {
                                    await viewModel.createReceivable(from: line, person: receivablePerson)
                                }
                                showCreateReceivable = false
                                selectedLine = nil
                            }
                        }
                        .disabled(receivablePerson.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .presentationDetents([.medium])
        }
    }

    private func renamedLine(_ line: CreditBillLine) -> CreditBillLine {
        var copy = line
        copy.accountName = viewModel.cardDisplayName(for: line)
        return copy
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                    .cardEntrance(index: 0)
                cardCarousel
                    .cardEntrance(index: 1)
                kpiGrid
                    .cardEntrance(index: 2)
                billStrip
                    .cardEntrance(index: 3)
                if !viewModel.period.bills.isEmpty {
                    evolutionChart
                        .cardEntrance(index: 4)
                }
                statement
                    .cardEntrance(index: 5)
            }
            .meuFluxPageGutter()
            .containerRelativeFrame(.horizontal)
        }
        .contentMargins(.horizontal, 0, for: .scrollContent)
        .contentMargins(.horizontal, 0, for: .scrollIndicators)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            if viewModel.isAllCards {
                Text("Soma consolidada de \(viewModel.cards.count) cartões")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
            } else if let card = viewModel.selectedCard {
                Text(faceStyle(for: card).productLabel)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                Text("Final \(card.lastFour)")
                    .font(.subheadline)
                    .foregroundStyle(MeuFluxColors.textSecondary)
            }
        }
    }

    private func faceStyle(for card: CreditCardSummary) -> CardFaceStyle {
        CardFaceCatalog.style(
            iconKey: card.iconKey,
            name: card.name,
            institution: card.institutionName,
            marketingName: card.marketingName,
            connectorName: card.connectorName
        )
    }

    // IDs used as scroll-position anchors for the card strip.
    private var allCardsScrollId: String { CreditCardsScreen.allCardsId }

    private var cardCarousel: some View {
        VStack(spacing: 10) {
            GeometryReader { geo in
                let cardWidth: CGFloat = CreditCardFaceMetrics.size.width
                // Side inset via contentMargins (not HStack padding) so viewAligned
                // snaps one card at a time and can reach the first / last target.
                let sideInset = max(0, (geo.size.width - cardWidth) / 2)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        CreditAllCardsChip(
                            count: viewModel.cards.count,
                            totalLabel: viewModel.screen?.outstandingTotal.formatted() ?? Money.zero.formatted(),
                            selected: viewModel.isAllCards
                        ) {
                            selectCardProgrammatically(allCardsScrollId)
                        }
                        .focusEffectDisabled()
                        .id(allCardsScrollId)

                        ForEach(viewModel.cards) { card in
                            Button {
                                selectCardProgrammatically(card.id)
                            } label: {
                                CreditCardFaceView(
                                    name: card.name,
                                    lastFour: card.lastFour,
                                    amountLabel: card.openTotal.formatted(),
                                    institutionName: card.institutionName,
                                    marketingName: card.marketingName,
                                    connectorName: card.connectorName,
                                    iconKey: card.iconKey,
                                    cardFaceURL: card.cardFaceURL,
                                    selected: viewModel.selectedCardId == card.id
                                )
                            }
                            .buttonStyle(.plain)
                            .focusEffectDisabled()
                            .id(card.id)
                        }
                    }
                    .scrollTargetLayout()
                }
                .contentMargins(.horizontal, sideInset, for: .scrollContent)
                .scrollTargetBehavior(.viewAligned(limitBehavior: .always))
                .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
                .scrollPosition(
                    id: Binding(
                        get: { cardScrollPosition ?? viewModel.selectedCardId },
                        set: { newId in
                            guard !ignoreCardScrollSelection else { return }
                            cardScrollPosition = newId
                            if let id = newId, id != viewModel.selectedCardId {
                                selectCardFromScroll(id)
                            }
                        }
                    ),
                    anchor: .center
                )
                .contentMargins(.horizontal, 0, for: .scrollIndicators)
            }
            .frame(height: CreditCardFaceMetrics.size.height + 16)
            // Edge-to-edge — only the faces, not the title above.
            .padding(.horizontal, -PageLayout.gutter)
            .frame(maxWidth: .infinity)
            .onAppear { syncCardScrollPosition(settle: true) }
            .onChange(of: viewModel.selectedCardId) { _, newId in
                if cardScrollPosition != newId {
                    cardScrollPosition = newId
                }
            }

            HStack(spacing: 6) {
                circleDot(active: viewModel.isAllCards)
                ForEach(viewModel.cards) { card in
                    circleDot(active: viewModel.selectedCardId == card.id)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func selectCardProgrammatically(_ id: String) {
        ignoreCardScrollSelection = true
        ignoreBillScrollSelection = true
        viewModel.selectCard(id)
        cardScrollPosition = id
        syncBillScrollPosition(settle: true)
        releaseCardScrollSelectionAfterSettle()
    }

    private func selectCardFromScroll(_ id: String) {
        ignoreBillScrollSelection = true
        viewModel.selectCard(id)
        syncBillScrollPosition(settle: true)
    }

    private func selectBillProgrammatically(_ key: String) {
        ignoreBillScrollSelection = true
        viewModel.selectBill(key)
        billScrollPosition = key
        releaseBillScrollSelectionAfterSettle()
    }

    private func syncCardScrollPosition(settle: Bool) {
        cardScrollPosition = viewModel.selectedCardId
        if settle { releaseCardScrollSelectionAfterSettle() }
    }

    private func syncBillScrollPosition(settle: Bool) {
        let key = viewModel.activeBillKey
        billScrollPosition = key.isEmpty ? nil : key
        if settle { releaseBillScrollSelectionAfterSettle() }
    }

    private func releaseCardScrollSelectionAfterSettle() {
        ignoreCardScrollSelection = true
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(320))
            cardScrollPosition = viewModel.selectedCardId
            ignoreCardScrollSelection = false
        }
    }

    private func releaseBillScrollSelectionAfterSettle() {
        ignoreBillScrollSelection = true
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(320))
            let key = viewModel.activeBillKey
            billScrollPosition = key.isEmpty ? nil : key
            ignoreBillScrollSelection = false
        }
    }

    private func circleDot(active: Bool) -> some View {
        Capsule()
            .fill(active ? MeuFluxColors.primary : MeuFluxColors.border)
            .frame(width: active ? 16 : 6, height: 6)
    }

    private var kpiGrid: some View {
        let open = viewModel.period.openBill
        let lastPaid = viewModel.period.lastPaidBill
        return VStack(spacing: 1) {
            HStack(spacing: 1) {
                CompactKPICell(
                    title: "Fatura em aberto",
                    value: viewModel.openBillTotal.formatted(),
                    meta: open.map { "Vence \($0.dueDateShort)" } ?? "—",
                    accent: MeuFluxColors.warning
                )
                CompactKPICell(
                    title: "Última paga",
                    value: viewModel.lastPaidTotal.formatted(),
                    meta: lastPaid?.title ?? "—",
                    accent: MeuFluxColors.success
                )
            }
            HStack(spacing: 1) {
                CompactKPICell(
                    title: "Saldo devedor",
                    value: viewModel.outstanding.formatted(),
                    meta: viewModel.isAllCards ? "Soma consolidada" : "Neste cartão",
                    accent: MeuFluxColors.danger
                )
                CompactKPICell(
                    title: "Limite disponível",
                    value: viewModel.availableLimit.formatted(),
                    meta: "\(viewModel.limitFreePercent)% livre",
                    accent: MeuFluxColors.info
                )
            }
        }
        .background(MeuFluxColors.border)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        }
    }

    private var billStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                SectionHeader("Seletor de faturas")
                Spacer(minLength: 0)
                if !viewModel.isViewingCurrentBill,
                   let currentKey = viewModel.currentBillKey {
                    Button("Fatura atual") {
                        selectBillProgrammatically(currentKey)
                    }
                    .font(.caption.weight(.semibold))
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }

            GeometryReader { geo in
                let chipWidth: CGFloat = 185
                let sideInset = max(0, (geo.size.width - chipWidth) / 2)

                ScrollView(.horizontal, showsIndicators: false) {
                    ScrollViewReader { proxy in
                        HStack(spacing: 10) {
                            ForEach(viewModel.period.bills) { bill in
                                billChip(bill)
                                    .id(bill.dueMonth)
                            }
                        }
                        .scrollTargetLayout()
                        .onAppear {
                            // scrollPosition alone stays at the leading edge when the
                            // preferred id is already set before first layout — force centre.
                            centerBillStrip(proxy, to: viewModel.activeBillKey, animated: false)
                            // Second pass after GeometryReader / cardEntrance settle (web uses ~50ms).
                            Task { @MainActor in
                                try? await Task.sleep(for: .milliseconds(80))
                                centerBillStrip(proxy, to: viewModel.activeBillKey, animated: false)
                            }
                        }
                        .onChange(of: viewModel.activeBillKey) { _, newKey in
                            centerBillStrip(proxy, to: newKey, animated: true)
                        }
                        .onChange(of: viewModel.selectedCardId) { _, _ in
                            // Same due-month across cards won't fire activeBillKey onChange.
                            centerBillStrip(proxy, to: viewModel.activeBillKey, animated: true, deferLayout: true)
                        }
                        .onChange(of: viewModel.period.bills.map(\.dueMonth)) { _, _ in
                            centerBillStrip(proxy, to: viewModel.activeBillKey, animated: false, deferLayout: true)
                        }
                    }
                }
                .contentMargins(.horizontal, sideInset, for: .scrollContent)
                .scrollTargetBehavior(.viewAligned(limitBehavior: .always))
                .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
                .scrollPosition(
                    id: Binding(
                        get: {
                            if let billScrollPosition { return billScrollPosition }
                            let key = viewModel.activeBillKey
                            return key.isEmpty ? nil : key
                        },
                        set: { newKey in
                            guard !ignoreBillScrollSelection else { return }
                            billScrollPosition = newKey
                            if let key = newKey, key != viewModel.activeBillKey {
                                viewModel.selectBill(key)
                            }
                        }
                    ),
                    anchor: .center
                )
                .contentMargins(.horizontal, 0, for: .scrollIndicators)
            }
            .frame(height: 148)
            .padding(.horizontal, -PageLayout.gutter)
            .frame(maxWidth: .infinity)
        }
    }

    /// Centres the bill strip on `key`. Prefer ScrollViewReader over scrollPosition alone —
    /// the latter does not scroll on first appear when the id is already the preferred key.
    private func centerBillStrip(
        _ proxy: ScrollViewProxy,
        to key: String,
        animated: Bool,
        deferLayout: Bool = false
    ) {
        guard !key.isEmpty,
              viewModel.period.bills.contains(where: { $0.dueMonth == key }) else { return }

        let run = {
            ignoreBillScrollSelection = true
            billScrollPosition = key
            if animated {
                withAnimation(.easeInOut(duration: 0.25)) {
                    proxy.scrollTo(key, anchor: .center)
                }
            } else {
                proxy.scrollTo(key, anchor: .center)
            }
            releaseBillScrollSelectionAfterSettle()
        }

        if deferLayout {
            Task { @MainActor in
                // Wait one frame so the new card's bill chips have laid out.
                await Task.yield()
                run()
            }
        } else {
            run()
        }
    }

    private func billChip(_ bill: CreditBillBucket) -> some View {
        let selected = bill.dueMonth == viewModel.activeBillKey
        let accent: Color = {
            switch bill.type {
            case .currentOpen: return MeuFluxColors.warning
            case .future: return MeuFluxColors.info
            case .past: return bill.isPaid ? MeuFluxColors.success : MeuFluxColors.border
            }
        }()
        return Button {
            selectBillProgrammatically(bill.dueMonth)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(bill.title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(2)
                StatusBadge(
                    bill.badgeText,
                    style: bill.type == .currentOpen ? .warning : bill.type == .future ? .info : bill.isPaid ? .success : .neutral
                )
                Text("VALOR CONSOLIDADO")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(MeuFluxColors.textMuted)
                Text(bill.total.formatted())
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(MeuFluxColors.textPrimary)
                Text("Vence \(bill.dueDateShort) • \(bill.items.count) itens")
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
            .padding(12)
            .frame(width: 185, alignment: .leading)
            .background(MeuFluxColors.bgTertiary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(selected ? MeuFluxColors.primary : accent, lineWidth: selected ? 2 : 1.5)
            }
        }
        .buttonStyle(.plain)
    }

    private var evolutionChart: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Evolução das faturas", subtitle: "Fechadas, aberta e projeções")
                Chart(viewModel.period.bills) { bill in
                    BarMark(
                        x: .value("Mês", shortLabel(bill.dueMonth)),
                        y: .value("Total", NSDecimalNumber(decimal: bill.total.amount).doubleValue)
                    )
                    .foregroundStyle(barColor(bill.type))
                    .cornerRadius(4)
                }
                .frame(height: 220)
                .chartPlotStyle { plot in
                    plot.padding(.bottom, 8)
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                        AxisValueLabel {
                            if let n = value.as(Double.self) {
                                Text(n >= 1000 ? "R$ \(Int(n / 1000))k" : "R$ \(Int(n))")
                                    .font(.caption2)
                                    .foregroundStyle(MeuFluxColors.textMuted)
                            }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel(
                            centered: true,
                            collisionResolution: .disabled,
                            orientation: .vertical
                        ) {
                            if let label = value.as(String.self) {
                                Text(label)
                                    .font(.system(size: 9, weight: .semibold))
                                    .foregroundStyle(MeuFluxColors.textMuted)
                                    .fixedSize()
                            }
                        }
                    }
                }
                HStack(spacing: 12) {
                    legend(color: MeuFluxColors.primary, text: "Paga")
                    legend(color: MeuFluxColors.warning, text: "Aberta")
                    legend(color: MeuFluxColors.info, text: "Projetada")
                }
                .font(.caption2)
                .foregroundStyle(MeuFluxColors.textMuted)
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    private func legend(color: Color, text: String) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(text)
        }
    }

    private func barColor(_ type: CreditBillKind) -> Color {
        switch type {
        case .currentOpen: return MeuFluxColors.warning
        case .future: return MeuFluxColors.info
        case .past: return MeuFluxColors.primary
        }
    }

    private func shortLabel(_ dueMonth: String) -> String {
        YearMonth(key: dueMonth)?.shortAxisLabel ?? dueMonth
    }

    private var statement: some View {
        let bill = viewModel.selectedBill
        return GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(
                    bill.map { "Extrato: \($0.title)" } ?? "Extrato",
                    subtitle: bill.map { "Vencimento \($0.dueDateShort)" }
                )

                if let bill {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("VALOR TOTAL DESTA FATURA")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(MeuFluxColors.textMuted)
                            Text(bill.total.formatted())
                                .font(.title3.weight(.heavy).monospacedDigit())
                                .foregroundStyle(MeuFluxColors.danger)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 4) {
                            StatusBadge(
                                bill.badgeText,
                                style: bill.type == .currentOpen ? .warning : bill.isPaid ? .success : .info
                            )
                            Text("\(viewModel.filteredLines.count) de \(bill.items.count) compras")
                                .font(.caption2)
                                .foregroundStyle(MeuFluxColors.textMuted)
                        }
                    }
                    .padding(12)
                    .background(MeuFluxColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(MeuFluxColors.textMuted)
                    TextField("Buscar compra...", text: $viewModel.searchText)
                        .textFieldStyle(.plain)
                        .font(.subheadline)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(MeuFluxColors.bgTertiary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))

                if viewModel.filteredLines.isEmpty {
                    Text("Nenhuma compra para o filtro selecionado.")
                        .font(.subheadline)
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                } else {
                    ForEach(viewModel.filteredLines) { line in
                        Button {
                            selectedLine = renamedLine(line)
                        } label: {
                            statementRow(line)
                        }
                        .buttonStyle(.plain)
                        if line.id != viewModel.filteredLines.last?.id {
                            Divider().opacity(0.35)
                        }
                    }
                }

                if !viewModel.categoryBreakdown.isEmpty, let total = bill?.total.amount, total > 0 {
                    Divider()
                    Text("Gastos por categoria")
                        .font(.subheadline.weight(.semibold))
                    ForEach(viewModel.categoryBreakdown, id: \.name) { cat in
                        let pct = NSDecimalNumber(decimal: (cat.value / total) * 100).intValue
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(cat.name).font(.caption.weight(.semibold))
                                Spacer()
                                Text("\(Money(amount: cat.value).formatted()) (\(min(100, pct))%)")
                                    .font(.caption)
                                    .foregroundStyle(MeuFluxColors.textMuted)
                            }
                            GeometryReader { geo in
                                Capsule()
                                    .fill(MeuFluxColors.primary.opacity(0.85))
                                    .frame(width: geo.size.width * CGFloat(min(100, pct)) / 100, height: 8)
                            }
                            .frame(height: 8)
                        }
                    }
                }
            }
        }
    }

    private func statementRow(_ line: CreditBillLine) -> some View {
        let cardName = viewModel.cardDisplayName(for: line)
        let tint = statementIconTint(for: line)
        let icon = statementIcon(for: line)
        let merchantMatch = line.isPayment ? nil : MerchantLogoCatalog.match(text: line.description)
        return HStack(alignment: .top, spacing: 12) {
            if let merchant = merchantMatch {
                MerchantLogoView(entry: merchant, size: 36)
            } else {
                Image(systemName: icon)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 36, height: 36)
                    .background(tint.opacity(0.12), in: Circle())
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(line.description)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(2)
                WrappingHStack(spacing: 6, lineSpacing: 4) {
                    if viewModel.isAllCards, !cardName.isEmpty {
                        StatusBadge(cardName, style: .neutral)
                    }
                    if let category = line.category, !category.isEmpty {
                        StatusBadge(translatedCategory(category), style: line.isPayment ? .success : .neutral)
                    }
                    if let installment = line.installmentLabel {
                        StatusBadge(installment, style: .info)
                    }
                    if let date = line.purchaseDate {
                        Text(date.formatted())
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(MeuFluxColors.textMuted)
                            .fixedSize()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(line.isCredit ? "+" : "-") \(line.amount.formatted())")
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(line.isCredit ? MeuFluxColors.success : MeuFluxColors.danger)
                Text(line.statusLabel)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(
                        line.isProjected ? MeuFluxColors.info :
                            line.isPending ? MeuFluxColors.warning : MeuFluxColors.success
                    )
            }
        }
        .padding(.vertical, 4)
    }

    private func statementIcon(for line: CreditBillLine) -> String {
        if line.isPayment { return "checkmark.circle.fill" }
        if let category = line.category, !category.isEmpty {
            return PurchaseCategoryCatalog.systemImage(for: category, in: viewModel.purchaseCategories)
        }
        return "receipt"
    }

    private func statementIconTint(for line: CreditBillLine) -> Color {
        if line.isPayment { return MeuFluxColors.success }
        if let category = line.category, !category.isEmpty,
           let hex = PurchaseCategoryCatalog.color(for: category, in: viewModel.purchaseCategories),
           let color = Color(hexString: hex) {
            return color
        }
        return MeuFluxColors.danger
    }
}

private struct IsolatedHScroll<Content: View>: View {
    var height: CGFloat?
    @ViewBuilder var content: () -> Content

    init(height: CGFloat? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.height = height
        self.content = content
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            content()
        }
        .frame(height: height)
        .contentMargins(.horizontal, 0, for: .scrollContent)
        .contentMargins(.horizontal, 0, for: .scrollIndicators)
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
    }
}

#Preview {
    NavigationStack { CreditCardsView() }
}
