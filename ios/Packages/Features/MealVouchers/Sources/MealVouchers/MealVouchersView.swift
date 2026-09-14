import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct MealVouchersView: View {
    @State private var viewModel: MealVouchersViewModel
    @State private var showEditor = false
    @State private var showPurchase = false

    public init(repository: any MealBenefitsRepository) {
        _viewModel = State(initialValue: MealVouchersViewModel(repository: repository))
    }

    public init() {
        _viewModel = State(initialValue: MealVouchersViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .list)
            case .empty:
                EmptyState(
                    title: "Nenhum VA ou VR",
                    message: "Cadastre o valor e o dia que cai, depois lance as compras para debitar o saldo.",
                    systemImage: "fork.knife",
                    actionTitle: "Novo benefício",
                    action: {
                        viewModel.beginCreate()
                        showEditor = true
                    }
                )
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.retry() } }
            case .loaded:
                content
            }
        }
        .financialPageTitle("VA / VR")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    viewModel.beginCreate()
                    showEditor = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showEditor) { editorSheet }
        .sheet(isPresented: $showPurchase) { purchaseSheet }
    }

    private var content: some View {
        List {
            ForEach(viewModel.benefits) { benefit in
                let snap = viewModel.snapshot(for: benefit)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(benefit.displayLabel).font(.headline)
                            Text(benefit.kind.title)
                                .font(.caption)
                                .foregroundStyle(FinancialColors.textMuted)
                        }
                        Spacer()
                        Text(snap.remaining.formatted())
                            .font(.headline)
                    }
                    Text("\(benefit.monthlyAmount.formatted()) no dia \(benefit.creditDay)")
                        .font(.caption)
                        .foregroundStyle(FinancialColors.textMuted)
                    if let next = snap.nextCredit {
                        Text("Próximo crédito \(next.formatted())")
                            .font(.caption2)
                            .foregroundStyle(FinancialColors.textMuted)
                    }
                    ProgressView(value: monthProgress(snap, benefit: benefit))
                    Toggle("Mostrar no Momento", isOn: Binding(
                        get: { benefit.showInMoment },
                        set: { on in
                            Task { await viewModel.toggleShowInMoment(benefit, on: on) }
                        }
                    ))
                    .font(.subheadline)

                    ForEach(Array(benefit.purchases.sorted { $0.purchasedAt > $1.purchasedAt }.prefix(6))) { purchase in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(purchase.description.isEmpty ? "Compra" : purchase.description)
                                Text(purchase.purchasedAt.formatted())
                                    .font(.caption2)
                                    .foregroundStyle(FinancialColors.textMuted)
                            }
                            Spacer()
                            Text("− \(purchase.amount.formatted())")
                                .foregroundStyle(FinancialColors.danger)
                            Button(role: .destructive) {
                                Task { await viewModel.deletePurchase(purchase) }
                            } label: {
                                Image(systemName: "trash")
                            }
                            .buttonStyle(.borderless)
                        }
                        .font(.caption)
                    }

                    Button("Nova compra") {
                        viewModel.beginPurchase(for: benefit)
                        showPurchase = true
                    }
                    .font(.subheadline.weight(.semibold))
                }
                .padding(.vertical, 6)
                .swipeActions {
                    Button("Editar") {
                        viewModel.beginEdit(benefit)
                        showEditor = true
                    }
                    Button("Excluir", role: .destructive) {
                        Task { await viewModel.delete(benefit) }
                    }
                }
            }
        }
    }

    private func monthProgress(_ snap: MealBenefitMonthSnapshot, benefit: MealBenefit) -> Double {
        let limit = NSDecimalNumber(decimal: benefit.monthlyAmount.amount).doubleValue
        guard limit > 0 else { return 0 }
        let spent = NSDecimalNumber(decimal: snap.monthSpent.amount).doubleValue
        return min(1, max(0, spent / limit))
    }

    private var editorSheet: some View {
        NavigationStack {
            Form {
                Picker("Tipo", selection: $viewModel.draftKind) {
                    ForEach(MealBenefitKind.allCases, id: \.self) { kind in
                        Text(kind.title).tag(kind)
                    }
                }
                TextField("Apelido (Alelo, Sodexo…)", text: $viewModel.draftLabel)
                TextField("Valor mensal", text: $viewModel.draftMonthly)
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                TextField("Dia que cai", text: $viewModel.draftCreditDay)
                    #if os(iOS)
                    .keyboardType(.numberPad)
                    #endif
                DatePicker("Começa em", selection: $viewModel.draftStartsOn, displayedComponents: .date)
                TextField("Saldo atual", text: $viewModel.draftOpening)
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                Toggle("Mostrar no Momento Financeiro e na Conta conjunta", isOn: $viewModel.draftShowInMoment)
            }
            .navigationTitle(viewModel.editingBenefitId == nil ? "Novo benefício" : "Editar benefício")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { showEditor = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        Task {
                            await viewModel.saveDraft()
                            showEditor = false
                        }
                    }
                }
            }
        }
    }

    private var purchaseSheet: some View {
        NavigationStack {
            Form {
                TextField("Descrição", text: $viewModel.draftPurchaseDescription)
                TextField("Valor", text: $viewModel.draftPurchaseAmount)
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                DatePicker("Data", selection: $viewModel.draftPurchaseDate, displayedComponents: .date)
            }
            .navigationTitle("Nova compra")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { showPurchase = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lançar") {
                        Task {
                            await viewModel.savePurchase()
                            showPurchase = false
                        }
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { MealVouchersView() }
}
