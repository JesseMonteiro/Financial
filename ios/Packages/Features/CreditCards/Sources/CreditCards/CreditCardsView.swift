import SwiftUI
import Charts
import UniformTypeIdentifiers
import FinancialDesignSystem
import FinancialDomain

public struct CreditCardsView: View {
    @State private var viewModel: CreditCardsViewModel
    @State private var showPurchase = false
    @State private var showImporter = false
    private let onReceivables: (() -> Void)?

    public init(
        repository: any CreditCardsRepository,
        manuals: (any ManualExpensesRepository)? = nil,
        parseBill: (any ParseBillUseCase)? = nil,
        onReceivables: (() -> Void)? = nil
    ) {
        _viewModel = State(initialValue: CreditCardsViewModel(
            repository: repository,
            manuals: manuals,
            parseBill: parseBill
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
                case .empty:
                    EmptyState(
                        title: "Nenhum cartão",
                        message: "Conecte cartões de crédito em Conexões Bancárias.",
                        systemImage: "creditcard"
                    )
                case .failed(let message):
                    ErrorState(message: message) { Task { await viewModel.retry() } }
                case .loaded:
                    content
                }
            }
        }
        .financialPageTitle("Cartões de Crédito")
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
                                            .foregroundStyle(FinancialColors.textSecondary)
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
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                cardCarousel
                kpiGrid
                billStrip
                if !viewModel.period.bills.isEmpty {
                    evolutionChart
                }
                statement
            }
            .financialPageGutter()
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
                    .foregroundStyle(FinancialColors.textPrimary)
            } else if let card = viewModel.selectedCard {
                Text(faceStyle(for: card).productLabel)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(FinancialColors.textPrimary)
                Text("Final \(card.lastFour)")
                    .font(.subheadline)
                    .foregroundStyle(FinancialColors.textSecondary)
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

    private var cardCarousel: some View {
        VStack(spacing: 10) {
            IsolatedHScroll(height: CreditCardFaceMetrics.size.height + 16) {
                HStack(spacing: 12) {
                    CreditAllCardsChip(
                        count: viewModel.cards.count,
                        totalLabel: viewModel.screen?.outstandingTotal.formatted() ?? Money.zero.formatted(),
                        selected: viewModel.isAllCards
                    ) {
                        viewModel.selectCard(CreditCardsScreen.allCardsId)
                    }
                    .focusEffectDisabled()

                    ForEach(viewModel.cards) { card in
                        Button {
                            viewModel.selectCard(card.id)
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
                    }
                }
                .padding(.vertical, 8)
                // Rest position aligns with page gutter; scroll can still reach screen edges.
                .padding(.horizontal, PageLayout.gutter)
            }
            // Edge-to-edge like Momento / Conta conjunta — only the faces, not the title above.
            .padding(.horizontal, -PageLayout.gutter)
            .frame(maxWidth: .infinity)

            HStack(spacing: 6) {
                circleDot(active: viewModel.isAllCards)
                ForEach(viewModel.cards) { card in
                    circleDot(active: viewModel.selectedCardId == card.id)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func circleDot(active: Bool) -> some View {
        Capsule()
            .fill(active ? FinancialColors.primary : FinancialColors.border)
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
                    accent: FinancialColors.warning
                )
                CompactKPICell(
                    title: "Última paga",
                    value: viewModel.lastPaidTotal.formatted(),
                    meta: lastPaid?.title ?? "—",
                    accent: FinancialColors.success
                )
            }
            HStack(spacing: 1) {
                CompactKPICell(
                    title: "Saldo devedor",
                    value: viewModel.outstanding.formatted(),
                    meta: viewModel.isAllCards ? "Soma consolidada" : "Neste cartão",
                    accent: FinancialColors.danger
                )
                CompactKPICell(
                    title: "Limite disponível",
                    value: viewModel.availableLimit.formatted(),
                    meta: "\(viewModel.limitFreePercent)% livre",
                    accent: FinancialColors.info
                )
            }
        }
        .background(FinancialColors.border)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(FinancialColors.border, lineWidth: 1)
        }
    }

    private var billStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 8) {
                SectionHeader("Seletor de faturas")
                Spacer(minLength: 0)
                if !viewModel.isViewingCurrentMonthBill,
                   viewModel.currentMonthBillKey != nil {
                    Button("atual") {
                        viewModel.selectCurrentMonthBill()
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
                        .padding(.horizontal, sideInset)
                        .onAppear {
                            scrollBillStrip(proxy, to: viewModel.activeBillKey, animated: false)
                        }
                        .onChange(of: viewModel.activeBillKey) { _, newKey in
                            scrollBillStrip(proxy, to: newKey, animated: true)
                        }
                        .onChange(of: viewModel.selectedCardId) { _, _ in
                            // Same month key across cards won't fire activeBillKey onChange —
                            // re-center after the new card's strip lays out.
                            scrollBillStrip(proxy, to: viewModel.activeBillKey, animated: true, deferLayout: true)
                        }
                    }
                }
                .contentMargins(.horizontal, 0, for: .scrollContent)
                .contentMargins(.horizontal, 0, for: .scrollIndicators)
                .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
            }
            .frame(height: 148)
            .padding(.horizontal, -PageLayout.gutter)
            .frame(maxWidth: .infinity)
        }
    }

    private func scrollBillStrip(
        _ proxy: ScrollViewProxy,
        to key: String,
        animated: Bool,
        deferLayout: Bool = false
    ) {
        guard !key.isEmpty else { return }
        let run = {
            guard viewModel.period.bills.contains(where: { $0.dueMonth == key }) else { return }
            if animated {
                withAnimation(.easeInOut(duration: 0.25)) {
                    proxy.scrollTo(key, anchor: .center)
                }
            } else {
                proxy.scrollTo(key, anchor: .center)
            }
        }
        if deferLayout {
            DispatchQueue.main.async(execute: run)
        } else {
            run()
        }
    }

    private func billChip(_ bill: CreditBillBucket) -> some View {
        let selected = bill.dueMonth == viewModel.activeBillKey
        let accent: Color = {
            switch bill.type {
            case .currentOpen: return FinancialColors.warning
            case .future: return FinancialColors.info
            case .past: return bill.isPaid ? FinancialColors.success : FinancialColors.border
            }
        }()
        return Button {
            viewModel.selectBill(bill.dueMonth)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(bill.title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(FinancialColors.textPrimary)
                    .lineLimit(2)
                StatusBadge(
                    bill.badgeText,
                    style: bill.type == .currentOpen ? .warning : bill.type == .future ? .info : bill.isPaid ? .success : .neutral
                )
                Text("VALOR CONSOLIDADO")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(FinancialColors.textMuted)
                Text(bill.total.formatted())
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(FinancialColors.textPrimary)
                Text("Vence \(bill.dueDateShort) • \(bill.items.count) itens")
                    .font(.caption2)
                    .foregroundStyle(FinancialColors.textMuted)
            }
            .padding(12)
            .frame(width: 185, alignment: .leading)
            .background(FinancialColors.bgTertiary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(selected ? FinancialColors.primary : accent, lineWidth: selected ? 2 : 1.5)
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
                .frame(height: 160)
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                        AxisValueLabel {
                            if let n = value.as(Double.self) {
                                Text(n >= 1000 ? "R$ \(Int(n / 1000))k" : "R$ \(Int(n))")
                                    .font(.caption2)
                            }
                        }
                    }
                }
                HStack(spacing: 12) {
                    legend(color: FinancialColors.primary, text: "Paga")
                    legend(color: FinancialColors.warning, text: "Aberta")
                    legend(color: FinancialColors.info, text: "Projetada")
                }
                .font(.caption2)
                .foregroundStyle(FinancialColors.textMuted)
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
        case .currentOpen: return FinancialColors.warning
        case .future: return FinancialColors.info
        case .past: return FinancialColors.primary
        }
    }

    private func shortLabel(_ dueMonth: String) -> String {
        let parts = dueMonth.split(separator: "-")
        guard parts.count == 2 else { return dueMonth }
        return "\(parts[1])/\(parts[0].suffix(2))"
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
                                .foregroundStyle(FinancialColors.textMuted)
                            Text(bill.total.formatted())
                                .font(.title3.weight(.heavy).monospacedDigit())
                                .foregroundStyle(FinancialColors.danger)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 4) {
                            StatusBadge(
                                bill.badgeText,
                                style: bill.type == .currentOpen ? .warning : bill.isPaid ? .success : .info
                            )
                            Text("\(viewModel.filteredLines.count) de \(bill.items.count) compras")
                                .font(.caption2)
                                .foregroundStyle(FinancialColors.textMuted)
                        }
                    }
                    .padding(12)
                    .background(FinancialColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                }

                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(FinancialColors.textMuted)
                    TextField("Buscar compra...", text: $viewModel.searchText)
                        .textFieldStyle(.plain)
                        .font(.subheadline)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(FinancialColors.bgTertiary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))

                if viewModel.filteredLines.isEmpty {
                    Text("Nenhuma compra para o filtro selecionado.")
                        .font(.subheadline)
                        .foregroundStyle(FinancialColors.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                } else {
                    ForEach(viewModel.filteredLines) { line in
                        statementRow(line)
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
                                    .foregroundStyle(FinancialColors.textMuted)
                            }
                            GeometryReader { geo in
                                Capsule()
                                    .fill(FinancialColors.primary.opacity(0.85))
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
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: line.isPayment ? "checkmark.circle.fill" : "receipt")
                .foregroundStyle(line.isPayment ? FinancialColors.success : FinancialColors.danger)
                .frame(width: 36, height: 36)
                .background(
                    (line.isPayment ? FinancialColors.success : FinancialColors.danger).opacity(0.12),
                    in: Circle()
                )
            VStack(alignment: .leading, spacing: 4) {
                Text(line.description)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(FinancialColors.textPrimary)
                    .lineLimit(2)
                WrappingHStack(spacing: 6, lineSpacing: 4) {
                    if viewModel.isAllCards, !line.accountName.isEmpty {
                        StatusBadge(line.accountName, style: .neutral)
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
                            .foregroundStyle(FinancialColors.textMuted)
                            .fixedSize()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(line.isCredit ? "+" : "-") \(line.amount.formatted())")
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(line.isCredit ? FinancialColors.success : FinancialColors.danger)
                Text(line.statusLabel)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(
                        line.isProjected ? FinancialColors.info :
                            line.isPending ? FinancialColors.warning : FinancialColors.success
                    )
            }
        }
        .padding(.vertical, 4)
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
