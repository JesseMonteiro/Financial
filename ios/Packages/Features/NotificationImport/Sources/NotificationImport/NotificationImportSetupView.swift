import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct NotificationImportSetupView: View {
    @State private var viewModel: NotificationImportSetupViewModel
    @Environment(\.openURL) private var openURL
    @State private var tutorialMode: TutorialMode = .applePay

    private enum TutorialMode: String, CaseIterable, Identifiable {
        case applePay = "Apple Pay (Transação)"
        case notification = "Notificação de Banco"
        var id: String { rawValue }
    }

    public init(
        importer: any NotificationImporting,
        mealBenefits: any MealBenefitsRepository,
        accounts: any AccountsRepository,
        bankConnections: (any BankConnectionsRepository)? = nil
    ) {
        _viewModel = State(
            initialValue: NotificationImportSetupViewModel(
                importer: importer,
                mealBenefits: mealBenefits,
                accounts: accounts,
                bankConnections: bankConnections
            )
        )
    }

    public init() {
        _viewModel = State(initialValue: NotificationImportSetupViewModel())
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .form)
            case .failed(let message):
                ErrorState(message: message) { Task { await viewModel.load() } }
            case .empty:
                EmptyState(
                    title: "Leitor indisponível",
                    message: "Entre na sua conta para configurar o importador de notificações.",
                    systemImage: "bell.slash"
                )
            case .loaded:
                content
            }
        }
        .meuFluxPageTitle("Leitor de notificações")
        .task { await viewModel.load() }
        .sheet(item: $viewModel.configuringSource) { source in
            destinationPicker(for: source)
        }
    }

    private var content: some View {
        List {
            Section {
                Text(introCopy)
                    .font(.subheadline)
                    .foregroundStyle(MeuFluxColors.textSecondary)
            }

            Section("Permissão do MeuFlux") {
                if viewModel.notificationsGranted {
                    Label("Avisos de revisão ativados", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(MeuFluxColors.success)
                } else {
                    Button("Permitir notificações de revisão") {
                        Task { await viewModel.requestNotificationPermission() }
                    }
                }
            }

            if viewModel.destinationOptions.isEmpty {
                Section {
                    Text("Cadastre um VA/VR ou uma conta manual antes de ligar o leitor.")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textSecondary)
                }
            }

            Section("Benefícios (VA / VR)") {
                ForEach(benefitSources) { source in
                    sourceRow(source)
                }
            }

            Section {
                ForEach(bankSources) { source in
                    sourceRow(source)
                }
            } header: {
                Text("Bancos e Cartões")
            } footer: {
                Text("Bancos conectados via Open Finance são sincronizados automaticamente para evitar compras duplicadas.")
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }

            Section("Carteira e Outros") {
                ForEach(otherSources) { source in
                    sourceRow(source)
                }
            }

            Section("Como configurar no Atalhos") {
                Picker("Tipo de Automação", selection: $tutorialMode) {
                    ForEach(TutorialMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

                if tutorialMode == .applePay {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Recomendado para Apple Pay e Apple Watch", systemImage: "sparkles")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.primary)
                        Text("Sempre que você aproximar o iPhone ou Apple Watch, a compra é importada automaticamente com valor e loja exatos.")
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                    .padding(.vertical, 4)

                    numberedStep(1, "Abra o app Atalhos → aba Automação → toque no botão + (canto superior direito).")
                    numberedStep(2, "Escolha o gatilho Transação (com o ícone da Carteira).")
                    numberedStep(3, "Em Cartão, escolha seu cartão (ou Qualquer Cartão). Marque Executar Imediatamente e desative Perguntar ao Executar. Toque em Avançar.")
                    numberedStep(4, "Toque em Nova Automação Vazia → Adicionar Ação → busque por “MeuFlux”.")
                    numberedStep(5, "Escolha a ação: “Importar transação do Apple Pay / Carteira”.")
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Como preencher a variável Transação:")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(MeuFluxColors.textPrimary)
                        Text("• Campo Valor: toque nele, selecione a variável azul Transação, toque nela novamente e escolha Valor.")
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                        Text("• Campo Estabelecimento: toque nele, selecione Transação e escolha Comerciante.")
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                        Text("• Campo Nome do Cartão: toque nele, selecione Transação e escolha Cartão.")
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 8).fill(MeuFluxColors.primary.opacity(0.08)))

                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Para compras fora do Apple Pay", systemImage: "bell.badge")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.primary)
                        Text("Lê as notificações push emitidas pelo app do seu banco (ex.: Nubank, Itaú, Alelo).")
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                    .padding(.vertical, 4)

                    numberedStep(1, "No app Atalhos → Automação → + → escolha o gatilho Notificação.")
                    numberedStep(2, "Escolha o App do seu banco (ex: Nubank, Itaú, Alelo).")
                    numberedStep(3, "No campo “A notificação contém”, digite “compra” ou “R$”.")
                    numberedStep(4, "Marque Executar Imediatamente e avance.")
                    numberedStep(5, "Adicione a ação do MeuFlux: “Importar compra da notificação”.")
                    numberedStep(6, "No campo Corpo, selecione a variável Texto da notificação da entrada do atalho.")
                }

                Button {
                    if let url = URL(string: "shortcuts://") {
                        openURL(url)
                    }
                } label: {
                    Label("Abrir o App Atalhos", systemImage: "arrow.up.forward.app")
                        .font(.subheadline.weight(.semibold))
                }
            }

            Section("Colar uma notificação") {
                TextField("App de origem (ex.: Nubank, Alelo)", text: $viewModel.pasteSourceApp)
                TextEditor(text: $viewModel.pasteText)
                    .frame(minHeight: 88)
                Button("Importar texto") {
                    Task { await viewModel.importPastedText() }
                }
                if let result = viewModel.lastPasteResult {
                    Text(result)
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textSecondary)
                }
            }

            if !viewModel.history.isEmpty {
                Section("Recentes") {
                    ForEach(viewModel.history.prefix(12)) { record in
                        historyRow(record)
                    }
                }
            }
        }
    }

    private var benefitSources: [NotificationImportSource] {
        NotificationImportSource.allCases.filter(\.isMealBenefitSource)
    }

    private var bankSources: [NotificationImportSource] {
        NotificationImportSource.allCases.filter(\.isBankSource)
    }

    private var otherSources: [NotificationImportSource] {
        NotificationImportSource.allCases.filter { !$0.isMealBenefitSource && !$0.isBankSource }
    }

    private func sourceRow(_ source: NotificationImportSource) -> some View {
        let isOpenFinanceConnected = viewModel.isConnectedViaOpenFinance(source)

        return VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: Binding(
                get: {
                    if isOpenFinanceConnected { return false }
                    return viewModel.isEnabled(source)
                },
                set: { enabled in
                    Task { await viewModel.setEnabled(source, enabled: enabled) }
                }
            )) {
                Label(source.displayName, systemImage: source.systemImage)
            }
            .disabled(viewModel.destinationOptions.isEmpty || isOpenFinanceConnected)

            if isOpenFinanceConnected {
                Label("Open Finance ativo · importação automática", systemImage: "antenna.radiowaves.left.and.right")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(MeuFluxColors.success)
            } else {
                Button(viewModel.destinationLabel(for: source)) {
                    viewModel.configuringSource = source
                }
                .font(.caption)
                .disabled(viewModel.destinationOptions.isEmpty)
            }
        }
    }

    private func historyRow(_ record: NotificationImportRecord) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(historyTitle(record))
                .font(.subheadline.weight(.semibold))
            Text(historySubtitle(record))
                .font(.caption)
                .foregroundStyle(MeuFluxColors.textMuted)
        }
    }

    private func historyTitle(_ record: NotificationImportRecord) -> String {
        if let parsed = record.parsed {
            return "\(parsed.amount.formatted()) · \(parsed.displayMerchant)"
        }
        return record.ignoreReason ?? "Notificação"
    }

    private func historySubtitle(_ record: NotificationImportRecord) -> String {
        switch record.status {
        case .imported: return "Importada"
        case .ignored: return "Ignorada"
        case .undone: return "Desfeita"
        case .parseFailed: return "Falhou o parse"
        case .needsDestination: return "Escolher conta"
        case .needsReview: return "Revisar"
        case .queued: return "Na fila"
        case .skippedOpenFinance: return "Open Finance (sem duplicidade)"
        }
    }

    private var hasNotificationTrigger: Bool {
        ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 27
    }

    private var introCopy: String {
        if hasNotificationTrigger {
            return "O iOS não deixa o MeuFlux ler notificações de outros apps sozinho. No iOS 27 você cria uma automação Notificação no Atalhos que encaminha o texto da compra."
        }
        return "O iOS não deixa o MeuFlux ler notificações de outros apps sozinho. No iOS 26 o Atalhos ainda não tem o gatilho Notificação; cole o texto da compra abaixo ou atualize para o iOS 27."
    }

    private func numberedStep(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(number)")
                .font(.caption.weight(.bold))
                .frame(width: 22, height: 22)
                .background(Circle().fill(MeuFluxColors.primary.opacity(0.15)))
            Text(text)
                .font(.caption)
                .foregroundStyle(MeuFluxColors.textSecondary)
        }
    }

    private func destinationPicker(for source: NotificationImportSource) -> some View {
        NavigationStack {
            List(viewModel.destinationOptions) { option in
                Button {
                    Task { await viewModel.assignDestination(option, to: source) }
                } label: {
                    Text(option.label)
                }
            }
            .meuFluxPageTitle("Destino · \(source.displayName)")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { viewModel.configuringSource = nil }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
