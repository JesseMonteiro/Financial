import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain
#if canImport(UIKit)
import UIKit
#endif

public struct FinancialMomentView: View {
    @State private var viewModel: FinancialMomentDetailViewModel
    @State private var selectedDetail: LineItemDetail?
    private let onCreateManualExpense: (() -> Void)?
    private let onOpenMealVouchers: (() -> Void)?
    private let onOpenReceivables: (() -> Void)?
    private let currentUserLabel: String?

    private var isPhoneIdiom: Bool {
        #if canImport(UIKit)
        UIDevice.current.userInterfaceIdiom == .phone
        #else
        false
        #endif
    }

    public init(
        buildFinancialMomentDetail: any BuildFinancialMomentDetailUseCase,
        manageMonthlySalary: any ManageMonthlySalaryUseCase,
        toggleManualExpensePaid: any ToggleManualExpensePaidUseCase,
        manuals: (any ManualExpensesRepository)? = nil,
        receivables: (any ReceivablesRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil,
        onCreateManualExpense: (() -> Void)? = nil,
        onOpenMealVouchers: (() -> Void)? = nil,
        onOpenReceivables: (() -> Void)? = nil,
        currentUserLabel: String? = nil
    ) {
        _viewModel = State(initialValue: FinancialMomentDetailViewModel(
            buildFinancialMomentDetail: buildFinancialMomentDetail,
            manageMonthlySalary: manageMonthlySalary,
            toggleManualExpensePaid: toggleManualExpensePaid,
            manuals: manuals,
            receivables: receivables,
            purchaseCategories: purchaseCategories
        ))
        self.onCreateManualExpense = onCreateManualExpense
        self.onOpenMealVouchers = onOpenMealVouchers
        self.onOpenReceivables = onOpenReceivables
        self.currentUserLabel = currentUserLabel
    }

    public init() {
        _viewModel = State(initialValue: FinancialMomentDetailViewModel())
        self.onCreateManualExpense = nil
        self.onOpenMealVouchers = nil
        self.onOpenReceivables = nil
        self.currentUserLabel = nil
    }

    public var body: some View {
        PageChrome {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    PageLoadingSkeleton(style: .moment)
                case .empty:
                    EmptyState(
                        title: "Mês zerado",
                        message: "Não há lançamentos neste mês. Você pode registrar uma despesa manual.",
                        systemImage: "waveform.path.ecg",
                        actionTitle: onCreateManualExpense == nil ? nil : "Criar despesa",
                        action: onCreateManualExpense
                    )
                case .failed(let message):
                    ErrorState(message: message) {
                        Task { await viewModel.retry() }
                    }
                case .loaded(let detail):
                    content(detail)
                }
            }
        }
        .meuFluxPageTitle("Momento Financeiro")
        .refreshable { await viewModel.load(force: true) }
        .task(id: viewModel.selectedMonth.key) { await viewModel.load() }
        .sheet(item: $selectedDetail) { item in
            LineItemDetailSheet(
                item: item,
                isBusy: viewModel.pendingExpenses.contains(item.sourceId),
                categoryOptions: item.kind == .manualExpense
                    ? LineItemCategoryOption.manualOptions(viewModel.purchaseCategories)
                    : [],
                onTogglePaid: {
                    Task {
                        if item.kind == .manualExpense {
                            await viewModel.toggleManualExpensePaid(item.sourceId, isPaid: !item.isPaid)
                        } else if item.kind == .receivable {
                            await viewModel.markReceivablePaid(id: item.sourceId, installmentNumber: item.installmentNumber)
                        }
                        selectedDetail = nil
                    }
                },
                onEdit: {
                    selectedDetail = nil
                    if item.kind == .manualExpense {
                        onCreateManualExpense?()
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

    @ViewBuilder
    private func content(_ detail: FinancialMomentDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                monthSelector(detail)

                VStack(alignment: .leading, spacing: 16) {
                    if isPhoneIdiom {
                        mobileKPIs(detail)
                        utilizationCard(detail)
                        mealBenefitsCards(detail)
                        mobileContentStack(detail)
                    } else {
                        desktopKPIs(detail)
                        utilizationCard(detail)
                        mealBenefitsCards(detail)
                        desktopContentColumns(detail)
                    }
                }
                .padding(.horizontal, PageLayout.gutter)
            }
            .padding(.top, PageLayout.contentTop)
            .padding(.bottom, PageLayout.gutter)
        }
    }

    @ViewBuilder
    private func monthSelector(_ detail: FinancialMomentDetail) -> some View {
        VStack(spacing: 12) {
            if viewModel.selectedMonth != YearMonth(from: Date()),
               isPhoneIdiom {
                HStack {
                    Spacer()
                    Button("Mês atual") {
                        viewModel.selectCurrentMonth()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                .padding(.horizontal, PageLayout.gutter)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                ScrollViewReader { proxy in
                    HStack(spacing: 8) {
                        ForEach(Array(viewModel.monthOptions.enumerated()), id: \.offset) { index, month in
                            MomentMonthChip(
                                month: month,
                                status: detail.monthsStatus[month.key] ?? (month == detail.selectedMonth ? detail.status : nil),
                                isSelected: index == viewModel.selectedMonthIndex,
                                isCurrent: month == YearMonth(from: Date())
                            ) {
                                viewModel.selectMonth(at: index)
                            }
                            .id(index)
                        }
                    }
                    .onAppear {
                        proxy.scrollTo(viewModel.selectedMonthIndex, anchor: .center)
                    }
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

    @ViewBuilder
    private func mobileKPIs(_ detail: FinancialMomentDetail) -> some View {
        let payableClear = detail.totals.accountsPayable.isZero
        let netOk = detail.totals.netBalance.amount >= 0

        LazyVGrid(columns: [GridItem(.flexible(), spacing: 1), GridItem(.flexible(), spacing: 1)], spacing: 1) {
            KPICompactCard(
                title: "Entradas",
                value: detail.totals.income.formatted(),
                subtitle: "Salário + \(detail.receivables.items.count) reembolsos",
                valueColor: MeuFluxColors.success,
                accent: MeuFluxColors.success
            )
            KPICompactCard(
                title: "Saídas",
                value: detail.totals.expenses.formatted(),
                subtitle: "\(detail.manualExpenses.items.count) manuais",
                valueColor: MeuFluxColors.danger,
                accent: MeuFluxColors.danger
            )
            KPICompactCard(
                title: "A pagar",
                value: detail.totals.accountsPayable.formatted(),
                subtitle: payableClear ? "Nada pendente" :
                    "\(detail.creditCards.unpaidBills.count) fat. · \(detail.automaticDebits.unpaidItems.count) déb.",
                valueColor: payableClear ? MeuFluxColors.success : MeuFluxColors.warning,
                accent: payableClear ? MeuFluxColors.success : MeuFluxColors.warning
            )
            KPICompactCard(
                title: "Saldo",
                value: (netOk ? "+" : "") + detail.totals.netBalance.formatted(),
                subtitle: netOk ? "Superávit" : "Déficit",
                valueColor: netOk ? MeuFluxColors.success : MeuFluxColors.danger,
                accent: netOk ? MeuFluxColors.success : MeuFluxColors.danger
            )
        }
        .background(MeuFluxColors.border)
        .clipShape(RoundedRectangle(cornerRadius: Radius().lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func desktopKPIs(_ detail: FinancialMomentDetail) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 12) {
            MetricCard(
                title: "Entradas do Mês",
                value: detail.totals.income.formatted(),
                subtitle: "Salário + \(detail.receivables.items.count) reembolsos",
                tint: MeuFluxColors.success,
                systemImage: "arrow.down.left",
                leadingAccent: true
            )
            MetricCard(
                title: "Saídas do Mês",
                value: detail.totals.expenses.formatted(),
                subtitle: "Faturas + débitos auto + \(detail.manualExpenses.items.count) manuais",
                tint: MeuFluxColors.danger,
                systemImage: "arrow.up.right",
                leadingAccent: true
            )
            MetricCard(
                title: "Contas a Pagar",
                value: detail.totals.accountsPayable.formatted(),
                subtitle: detail.totals.accountsPayable.isZero ? "Nada pendente neste mês" :
                    "\(detail.creditCards.unpaidBills.count) fatura(s), \(detail.automaticDebits.unpaidItems.count) débito(s) auto",
                tint: detail.totals.accountsPayable.isZero ? MeuFluxColors.success : MeuFluxColors.warning,
                systemImage: "exclamationmark.triangle",
                leadingAccent: true
            )
            MetricCard(
                title: "Saldo Residual",
                value: (detail.totals.netBalance.amount >= 0 ? "+" : "") + detail.totals.netBalance.formatted(),
                subtitle: detail.totals.netBalance.amount >= 0 ? "Superavitário" : "Deficitário",
                tint: detail.totals.netBalance.amount >= 0 ? MeuFluxColors.success : MeuFluxColors.danger,
                systemImage: "scale.3d",
                leadingAccent: true
            )
        }
    }

    @ViewBuilder
    private func utilizationCard(_ detail: FinancialMomentDetail) -> some View {
        let percent = detail.totals.utilizationPercent
        let over = detail.totals.isOverBudget

        GlassCard {
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

                ProgressBar(
                    percent: percent,
                    color: over ? MeuFluxColors.danger : MeuFluxColors.primary
                )

                Text("Suas despesas consomem \(percent)% do seu orçamento líquido. Restam \(Money(amount: max(0, detail.totals.netBalance.amount)).formatted()) livres para investimento ou reserva.")
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
        }
    }

    @ViewBuilder
    private func mealBenefitsCards(_ detail: FinancialMomentDetail) -> some View {
        if !detail.mealBenefits.isEmpty {
            ForEach(detail.mealBenefits.items) { item in
                let kindTitle = item.kind.title
                let provider: String? = {
                    let trimmed = item.label.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty, trimmed != kindTitle else { return nil }
                    return trimmed
                }()
                MealBenefitMomentCard(
                    kindTitle: kindTitle,
                    isVR: item.kind == .vr,
                    provider: provider,
                    remainingText: item.remaining.formatted(),
                    remainingNegative: item.remaining.amount < 0,
                    creditDay: item.creditDay,
                    monthSpentText: item.monthSpent.formatted(),
                    ownerLabel: item.ownerLabel ?? currentUserLabel,
                    onManage: onOpenMealVouchers
                )
            }
        }
    }

    @ViewBuilder
    private func mobileContentStack(_ detail: FinancialMomentDetail) -> some View {
        VStack(spacing: 16) {
            salaryCard(detail)
            if !detail.creditCards.isEmpty { billsCard(detail) }
            if !detail.automaticDebits.isEmpty { debitsCard(detail) }
            if shouldShowManualsCard(detail) { manualsCard(detail) }
            if !detail.receivables.isEmpty { receivablesCard(detail) }
        }
    }

    @ViewBuilder
    private func desktopContentColumns(_ detail: FinancialMomentDetail) -> some View {
        HStack(alignment: .top, spacing: 16) {
            // Income/Credits column
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Image(systemName: "arrow.down.left")
                        .foregroundStyle(MeuFluxColors.success)
                    Text("Entradas / Créditos (\(shortMonth(detail.selectedMonth)))")
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundStyle(MeuFluxColors.success)
                }
                
                salaryCard(detail)
                if !detail.receivables.isEmpty { receivablesCard(detail) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // Expenses/Debits column
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Image(systemName: "arrow.up.right")
                        .foregroundStyle(MeuFluxColors.danger)
                    Text("Saídas / Despesas (\(shortMonth(detail.selectedMonth)))")
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundStyle(MeuFluxColors.danger)
                }
                
                if !detail.creditCards.isEmpty { billsCard(detail) }
                if !detail.automaticDebits.isEmpty { debitsCard(detail) }
                if shouldShowManualsCard(detail) { manualsCard(detail) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func salaryCard(_ detail: FinancialMomentDetail) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "banknote")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.primary)
                    Text("Salário Mensal")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                }

                HStack(spacing: 8) {
                    HStack(spacing: 8) {
                        Text("$")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(MeuFluxColors.textMuted)
                        TextField("0", text: $viewModel.salaryInput)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(MeuFluxColors.textPrimary)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                            .disabled(viewModel.isSavingSalary)
                        Text("BRL")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(MeuFluxColors.textMuted)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                            .fill(MeuFluxColors.bgPrimary.opacity(0.7))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                            .strokeBorder(MeuFluxColors.border, lineWidth: 1)
                    )

                    Button {
                        Task { await viewModel.saveSalary() }
                    } label: {
                        Group {
                            if viewModel.isSavingSalary {
                                ProgressView()
                            } else {
                                Text("Definir")
                                    .font(.subheadline.weight(.bold))
                            }
                        }
                        .frame(minWidth: 72)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(MeuFluxColors.bgPrimary)
                    .background(
                        RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                            .fill(MeuFluxColors.primary)
                    )
                    .disabled(viewModel.isSavingSalary)
                }
            }
        }
    }

    @ViewBuilder
    private func receivablesCard(_ detail: FinancialMomentDetail) -> some View {
        GlassCard(
            title: "Valores a Receber (Reembolsos)",
            subtitle: isPhoneIdiom ? nil : 
                "Reembolsos e parcelas a receber de amigos/familiares vencendo neste mês."
        ) {
            if detail.receivables.isEmpty {
                Text("Nenhum valor a receber cadastrado para este mês.")
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                VStack(spacing: 8) {
                    ForEach(detail.receivables.items) { item in
                        receivableRow(item)
                    }
                    
                    Divider()
                    
                    HStack {
                        Text("Total Reembolsos")
                            .font(.caption)
                            .fontWeight(.bold)
                        Spacer()
                        Text(detail.receivables.total.formatted())
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(MeuFluxColors.success)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func receivableRow(_ item: ReceivableItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.description)
                    .font(.caption)
                    .fontWeight(.semibold)
                
                HStack(spacing: 8) {
                    Badge(item.personName, style: .neutral)
                        .foregroundStyle(parseColor(item.personColor) ?? MeuFluxColors.primary)
                    
                    Text("Parcela \(item.installmentNumber)/\(item.totalInstallments)")
                        .font(.caption2)
                        .foregroundStyle(MeuFluxColors.textMuted)
                    
                    if item.isPaid {
                        Badge("Recebido", style: .success)
                    }
                }
            }
            
            Spacer()
            
            Text("+ " + item.amount.formatted())
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(MeuFluxColors.success)
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .onTapGesture { selectedDetail = LineItemDetail.from(momentReceivable: item) }
    }

    @ViewBuilder
    private func billsCard(_ detail: FinancialMomentDetail) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Faturas de Cartão de Crédito")
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundStyle(MeuFluxColors.textPrimary)
                if !isPhoneIdiom {
                    Text("Faturas fechadas e estimadas com vencimento neste mês.")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textSecondary)
                }
            }

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

    private func shouldShowManualsCard(_ detail: FinancialMomentDetail) -> Bool {
        !detail.manualExpenses.isEmpty || onCreateManualExpense != nil
    }

    @ViewBuilder
    private func debitsCard(_ detail: FinancialMomentDetail) -> some View {
        GlassCard(
            title: "Débito Automático",
            subtitle: isPhoneIdiom ? nil : 
                "Convênios e débitos automáticos das contas bancárias neste mês (energia, celular, financiamentos). PIX e transferências não entram."
        ) {
            if detail.automaticDebits.isEmpty {
                Text("Nenhum débito automático nas contas conectadas para este mês.")
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                VStack(spacing: 8) {
                    ForEach(detail.automaticDebits.items) { debit in
                        debitRow(debit)
                    }
                    
                    Divider()
                    
                    HStack {
                        Text("Total Débitos Automáticos")
                            .font(.caption)
                            .fontWeight(.bold)
                        Spacer()
                        Text(detail.automaticDebits.total.formatted())
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(MeuFluxColors.danger)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func debitRow(_ debit: AutomaticDebitItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: "repeat")
                        .font(.caption2)
                    Text(debit.description)
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                
                HStack(spacing: 8) {
                    Badge(debit.accountName, style: .neutral)
                    
                    Text(formatDate(debit.date))
                        .font(.caption2)
                        .foregroundStyle(MeuFluxColors.textMuted)
                    
                    if debit.isPending {
                        Badge("Agendado", style: .warning)
                    } else {
                        Badge("Liquidado", style: .success)
                    }
                }
            }
            
            Spacer()
            
            Text("- " + debit.amount.formatted())
                .font(.caption)
                .fontWeight(.bold)
                .foregroundStyle(MeuFluxColors.danger)
        }
        .padding(.vertical, 8)
        .background(debit.isPending ? MeuFluxColors.warningBackground : Color.clear)
        .cornerRadius(8)
        .contentShape(Rectangle())
        .onTapGesture { selectedDetail = LineItemDetail.from(debit: debit) }
    }

    @ViewBuilder
    private func manualsCard(_ detail: FinancialMomentDetail) -> some View {
        GlassCard(
            title: "Despesas Manuais",
            subtitle: isPhoneIdiom ? nil :
                "Marque Pago por ocorrência deste mês (só controle; não altera saldo)."
        ) {
            VStack(alignment: .leading, spacing: 12) {
                if let onCreateManualExpense {
                    Button(action: onCreateManualExpense) {
                        Label("Criar despesa manual", systemImage: "plus.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(MeuFluxColors.primary)
                }

                if detail.manualExpenses.isEmpty {
                    Text("Nenhuma despesa manual registrada para este mês.")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                } else {
                    VStack(spacing: 8) {
                        ForEach(detail.manualExpenses.items) { expense in
                            manualExpenseRow(expense)
                        }

                        Divider()

                        HStack {
                            Text("Total Manuais")
                                .font(.caption)
                                .fontWeight(.bold)
                            Spacer()
                            Text(detail.manualExpenses.total.formatted())
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundStyle(MeuFluxColors.danger)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func manualExpenseRow(_ expense: ManualExpenseItem) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(expense.description)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .strikethrough(expense.isPaid)
                
                HStack(spacing: 8) {
                    Badge(translateCategory(expense.category), style: .neutral)
                    
                    Text(formatDate(expense.date))
                        .font(.caption2)
                        .foregroundStyle(MeuFluxColors.textMuted)
                    
                    if expense.isPaid {
                        Badge("Paga", style: .success)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture { selectedDetail = LineItemDetail.from(momentExpense: expense) }
            
            Spacer()
            
            HStack(spacing: 12) {
                Text("- " + expense.amount.formatted())
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(MeuFluxColors.danger)
                
                PaidCheckbox(
                    checked: expense.isPaid,
                    busy: viewModel.pendingExpenses.contains(expense.id)
                ) { isPaid in
                    Task {
                        await viewModel.toggleManualExpensePaid(expense.id, isPaid: isPaid)
                    }
                }
            }
        }
        .padding(.vertical, 8)
        .background(expense.isPaid ? MeuFluxColors.successBackground : MeuFluxColors.tertiaryBackground)
        .cornerRadius(8)
    }

    // MARK: - Helpers

    private func shortMonth(_ month: YearMonth) -> String {
        var comps = DateComponents()
        comps.year = month.year
        comps.month = month.month
        comps.day = 1
        let cal = Calendar(identifier: .gregorian)
        guard let date = cal.date(from: comps) else { return month.key }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.setLocalizedDateFormatFromTemplate("MMM yy")
        return formatter.string(from: date).capitalized
    }

    private func formatDate(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: String(dateString.prefix(10))) else { return dateString }
        
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateFormat = "dd/MM"
        return formatter.string(from: date)
    }

    private func translateCategory(_ category: String) -> String {
        let categories = [
            "food": "Alimentação",
            "groceries": "Mercado",
            "rent": "Moradia",
            "utilities": "Utilidades",
            "transport": "Transporte",
            "entertainment": "Lazer",
            "health": "Saúde",
            "education": "Educação",
            "other": "Outros"
        ]
        return categories[category.lowercased()] ?? category.capitalized
    }

    private func parseColor(_ colorString: String) -> Color? {
        var cleanHex = colorString.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Remove # if present
        if cleanHex.hasPrefix("#") {
            cleanHex = String(cleanHex.dropFirst())
        }
        
        // Convert to UInt32
        guard let hexValue = UInt32(cleanHex, radix: 16) else {
            return nil
        }
        
        return Color(hex: hexValue)
    }
}

// MARK: - Supporting Views

private struct MomentMonthChip: View {
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
        guard let tone else {
            return MeuFluxColors.tertiaryBackground
        }
        return tone.opacity(isSelected ? 0.15 : 0.05)
    }

    private var chipBorder: Color {
        guard let tone else { return MeuFluxColors.border }
        return tone.opacity(isSelected ? 1 : 0.35)
    }
}

private struct KPICompactCard: View {
    let title: String
    let value: String
    let subtitle: String
    let valueColor: Color
    let accent: Color

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(accent)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .tracking(0.3)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .allowsTightening(true)

                Text(value)
                    .font(.subheadline.weight(.heavy).monospacedDigit())
                    .foregroundStyle(valueColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                    .allowsTightening(true)

                Text(subtitle)
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textSecondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                    .allowsTightening(true)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(MeuFluxColors.card)
    }
}

private struct ProgressBar: View {
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
        .frame(height: 10)
        .accessibilityLabel("Utilização \(percent) por cento")
    }
}

private struct PaidCheckbox: View {
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
        .opacity(busy ? 0.6 : 1.0)
    }
}

#Preview {
    NavigationStack { FinancialMomentView() }
}
