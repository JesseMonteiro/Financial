import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct AccountsView: View {
    @State private var viewModel: AccountsViewModel
    @State private var showManualEditor = false
    private let onConnect: (() -> Void)?
    private let onInvestments: (() -> Void)?

    public init(
        repository: any AccountsRepository,
        onConnect: (() -> Void)? = nil,
        onInvestments: (() -> Void)? = nil
    ) {
        _viewModel = State(initialValue: AccountsViewModel(repository: repository))
        self.onConnect = onConnect
        self.onInvestments = onInvestments
    }

    public init() {
        _viewModel = State(initialValue: AccountsViewModel())
        self.onConnect = nil
        self.onInvestments = nil
    }

    public var body: some View {
        PageChrome {
            Group {
                switch viewModel.state {
                case .idle, .loading:
                    PageLoadingSkeleton(style: .list)
                case .empty:
                    EmptyState(
                        title: "Nenhuma conta",
                        message: "Conecte um banco ou cadastre uma conta manual.",
                        systemImage: "wallet.pass",
                        actionTitle: onConnect == nil ? nil : "Conectar banco",
                        action: onConnect
                    )
                case .failed(let message):
                    ErrorState(message: message) {
                        Task { await viewModel.retry() }
                    }
                case .loaded:
                    content
                }
            }
        }
        .meuFluxPageTitle("Contas & Saldos")
        .refreshable { await viewModel.load(force: true) }
        .task { await viewModel.load() }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button {
                    Task { await viewModel.sync() }
                } label: {
                    if viewModel.isSyncing {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                }
                .disabled(viewModel.isSyncing)
                .accessibilityLabel("Sincronizar")

                if onConnect != nil {
                    Button {
                        onConnect?()
                    } label: {
                        Image(systemName: "building.columns")
                    }
                    .accessibilityLabel("Conectar banco")
                }

                Button {
                    viewModel.resetManualDraft()
                    showManualEditor = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Adicionar manual")
            }
        }
        .sheet(item: $viewModel.renameTarget) { _ in
            NavigationStack {
                Form {
                    TextField("Nome", text: $viewModel.renameText)
                }
                .navigationTitle("Renomear")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { viewModel.renameTarget = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Salvar") {
                            Task { await viewModel.saveRename() }
                        }
                    }
                }
            }
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $showManualEditor) {
            manualEditorSheet
        }
        .confirmationDialog(
            "Excluir conta?",
            isPresented: Binding(
                get: { viewModel.pendingDelete != nil },
                set: { if !$0 { viewModel.pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Excluir", role: .destructive) {
                if let account = viewModel.pendingDelete {
                    Task { await viewModel.deleteManual(account) }
                }
            }
            Button("Cancelar", role: .cancel) {
                viewModel.pendingDelete = nil
            }
        } message: {
            if let account = viewModel.pendingDelete {
                Text("Excluir \(account.name)? As compras manuais desta conta também serão apagadas.")
            }
        }
    }

    // MARK: - Content

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header

                if let status = viewModel.statusMessage {
                    statusBanner(status, isError: viewModel.statusIsError)
                }

                bankSection
                creditSection
            }
            .meuFluxPageGutter()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Contas e cartões do Open Finance e itens manuais que você cadastrar.")
                .font(.subheadline)
                .foregroundStyle(MeuFluxColors.textMuted)
        }
    }

    private func statusBanner(_ text: String, isError: Bool) -> some View {
        Text(text)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(isError ? MeuFluxColors.danger : MeuFluxColors.success)
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                (isError ? MeuFluxColors.dangerBackground : MeuFluxColors.successBackground),
                in: RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
            )
    }

    private var bankSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle(
                systemImage: "wallet.pass.fill",
                tint: MeuFluxColors.primary,
                title: "Contas Bancárias (\(viewModel.bankAccounts.count))"
            )

            if viewModel.bankAccounts.isEmpty {
                emptySectionHint("Nenhuma conta bancária conectada.")
            } else {
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 280), spacing: 12)],
                    spacing: 12
                ) {
                    ForEach(viewModel.bankAccounts) { account in
                        bankCard(account)
                    }
                }
            }
        }
    }

    private var creditSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle(
                systemImage: "creditcard.fill",
                tint: MeuFluxColors.danger,
                title: "Cartões de Crédito (\(viewModel.creditCards.count))"
            )

            if viewModel.creditCards.isEmpty {
                emptySectionHint("Nenhum cartão de crédito conectado.")
            } else {
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 280), spacing: 12)],
                    spacing: 12
                ) {
                    ForEach(viewModel.creditCards) { account in
                        creditCard(account)
                    }
                }
            }
        }
    }

    private func sectionTitle(systemImage: String, tint: Color, title: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(tint)
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(MeuFluxColors.textPrimary)
        }
    }

    private func emptySectionHint(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(MeuFluxColors.textMuted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 8)
    }

    // MARK: - Cards

    private func bankCard(_ account: Account) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 16) {
                accountHeader(
                    account,
                    subtitle: bankSubtitle(account),
                    badge: account.isManual
                        ? StatusBadge("Manual", style: .info)
                        : StatusBadge("Ativa", style: .success)
                )

                moneyBlock(
                    label: "Saldo disponível",
                    amount: account.displayAmount.formatted(),
                    color: MeuFluxColors.textPrimary
                )

                if account.reservedBalance.amount > 0 {
                    reservedNote(account.reservedBalance)
                }

                if account.isManual {
                    manualActions(account)
                }
            }
        }
    }

    private func creditCard(_ account: Account) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 16) {
                accountHeader(
                    account,
                    subtitle: creditSubtitle(account),
                    badge: account.isManual
                        ? StatusBadge("Manual", style: .info)
                        : StatusBadge("Fatura Aberta", style: .neutral)
                )

                moneyBlock(
                    label: "Fatura Atual",
                    amount: account.displayAmount.formatted(),
                    color: MeuFluxColors.danger
                )

                if hasCreditLimit(account) {
                    Divider().opacity(0.5)
                    creditLimitRow(account)
                }

                if account.isManual {
                    manualActions(account)
                }
            }
        }
    }

    private func accountHeader(
        _ account: Account,
        subtitle: String,
        badge: StatusBadge
    ) -> some View {
        HStack(alignment: .top, spacing: 12) {
            AccountIconView(
                name: account.name,
                institutionName: account.institutionName ?? "",
                marketingName: account.marketingName ?? "",
                iconKey: account.iconKey,
                isCredit: account.isCreditCard,
                size: 40
            )

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .center, spacing: 6) {
                    Text(account.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                        .lineLimit(2)
                    Button {
                        viewModel.beginRename(account)
                    } label: {
                        Image(systemName: "pencil")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.textMuted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Editar nome")
                }

                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
                    .lineLimit(2)

                if let owner = account.ownerLabel, !owner.isEmpty {
                    Text("Titular: \(owner)")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                }
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 6) {
                badge
                if !account.isManual, let sync = AccountsViewModel.syncLabel(for: account.updatedAt) {
                    StatusBadge(sync.text, style: sync.style)
                }
            }
        }
    }

    private func moneyBlock(label: String, amount: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(MeuFluxColors.textMuted)
            Text(amount)
                .font(.title2.weight(.bold).monospacedDigit())
                .foregroundStyle(color)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
    }

    private func reservedNote(_ amount: Money) -> some View {
        Group {
            if onInvestments != nil {
                Button {
                    onInvestments?()
                } label: {
                    reservedText(amount, linked: true)
                }
                .buttonStyle(.plain)
            } else {
                reservedText(amount, linked: false)
            }
        }
    }

    private func reservedText(_ amount: Money, linked: Bool) -> some View {
        Text(reservedAttributed(amount, linked: linked))
            .font(.caption)
            .foregroundStyle(MeuFluxColors.textMuted)
    }

    private func reservedAttributed(_ amount: Money, linked: Bool) -> AttributedString {
        var base = AttributedString("\(amount.formatted()) em caixinhas contabilizados em ")
        var link = AttributedString("Investimentos")
        if linked {
            link.foregroundColor = MeuFluxColors.primary
            link.font = .caption.weight(.semibold)
        }
        base.append(link)
        return base
    }

    private func hasCreditLimit(_ account: Account) -> Bool {
        (account.creditLimit?.amount ?? 0) > 0
            || (account.availableCreditLimit?.amount ?? 0) > 0
    }

    private func creditLimitRow(_ account: Account) -> some View {
        HStack {
            Text("Limite Disponível: \((account.availableCreditLimit ?? .zero).formatted())")
            Spacer()
            Text("Total: \((account.creditLimit ?? .zero).formatted())")
        }
        .font(.caption)
        .foregroundStyle(MeuFluxColors.textMuted)
    }

    private func manualActions(_ account: Account) -> some View {
        HStack(spacing: 8) {
            Button(role: .destructive) {
                viewModel.pendingDelete = account
            } label: {
                Label("Excluir", systemImage: "trash")
                    .font(.caption.weight(.semibold))
            }
            .buttonStyle(.bordered)
            Spacer(minLength: 0)
        }
        .padding(.top, 4)
    }

    private func bankSubtitle(_ account: Account) -> String {
        var parts: [String] = []
        let institution = account.institutionName ?? account.marketingName ?? "Banco"
        parts.append(institution)
        if let number = account.number, !number.isEmpty {
            parts.append(number)
        }
        return parts.joined(separator: " • ")
    }

    private func creditSubtitle(_ account: Account) -> String {
        var parts: [String] = []
        parts.append(account.institutionName ?? "Cartão")
        if let number = account.number, !number.isEmpty {
            parts.append("Final \(number)")
        }
        return parts.joined(separator: " • ")
    }

    // MARK: - Manual editor

    private var manualEditorSheet: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Tipo", selection: $viewModel.draftKind) {
                        ForEach(AccountsViewModel.ManualKind.allCases) { kind in
                            Text(kind.label).tag(kind)
                        }
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    Text("Use quando o banco não está no Open Finance. O item aparece junto dos demais, com a tag Manual.")
                }

                Section("Instituição") {
                    TextField("Ex: Nubank, Inter, Caixa", text: $viewModel.draftInstitution)
                }

                if viewModel.draftKind == .account || viewModel.draftKind == .both {
                    Section("Conta") {
                        TextField("Nome da conta", text: $viewModel.draftAccountName)
                        TextField("Saldo (R$)", text: $viewModel.draftAccountBalance)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                    }
                }

                if viewModel.draftKind == .card || viewModel.draftKind == .both {
                    Section("Cartão") {
                        TextField("Nome do cartão", text: $viewModel.draftCardName)
                        TextField("Final", text: $viewModel.draftCardNumber)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                        TextField("Fatura atual (R$)", text: $viewModel.draftBillAmount)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                        TextField("Vencimento (dia)", text: $viewModel.draftBillDueDay)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                        TextField("Limite (opcional)", text: $viewModel.draftCreditLimit)
                            #if os(iOS)
                            .keyboardType(.decimalPad)
                            #endif
                    }
                }
            }
            .navigationTitle("Adicionar manual")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { showManualEditor = false }
                        .disabled(viewModel.isSavingManual)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        Task {
                            if await viewModel.saveManual() {
                                showManualEditor = false
                            }
                        }
                    }
                    .disabled(viewModel.isSavingManual || viewModel.draftInstitution.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

#Preview {
    NavigationStack { AccountsView() }
}
