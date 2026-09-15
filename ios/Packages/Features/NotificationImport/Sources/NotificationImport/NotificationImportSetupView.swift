import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain

public struct NotificationImportSetupView: View {
    @State private var viewModel: NotificationImportSetupViewModel
    @Environment(\.openURL) private var openURL

    public init(
        importer: any NotificationImporting,
        mealBenefits: any MealBenefitsRepository,
        accounts: any AccountsRepository
    ) {
        _viewModel = State(
            initialValue: NotificationImportSetupViewModel(
                importer: importer,
                mealBenefits: mealBenefits,
                accounts: accounts
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

            Section("Origens") {
                if viewModel.destinationOptions.isEmpty {
                    Text("Cadastre um VA/VR ou uma conta manual antes de ligar o leitor.")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textSecondary)
                }
                ForEach(NotificationImportSource.allCases) { source in
                    sourceRow(source)
                }
            }

            Section("Automação no Atalhos") {
                if hasNotificationTrigger {
                    numberedStep(1, "Atalhos → Automação → + → Criar Automação Pessoal.")
                    numberedStep(2, "Na lista, toque em Notificação (não aparece como “Quando eu receber…”).")
                    numberedStep(3, "Escolha o app (Alelo, Carteira, VR…) e, se quiser, filtre por “compra” ou “R$”.")
                    numberedStep(4, "Adicione a ação “Importar compra da notificação” do MeuFlux.")
                    numberedStep(5, "Mapeie Título, Subtítulo, Corpo e App de origem a partir da notificação.")
                    numberedStep(6, "Marque Executar imediatamente e desligue “Perguntar ao executar”.")
                } else {
                    Text("O gatilho de notificação chegou no iOS 27. Neste iPhone ele não aparece na lista de automações.")
                        .font(.subheadline)
                        .foregroundStyle(MeuFluxColors.textSecondary)
                    numberedStep(1, "Atualize para o iOS 27: Atalhos → Automação → + → Notificação (seção de Apps).")
                    numberedStep(2, "Enquanto isso, cole o texto da notificação do banco na seção abaixo.")
                    numberedStep(3, "Se o cartão estiver na Carteira, existe “Transação” / “Quando eu aproximar”, mas isso só dispara o atalho — não manda valor nem loja.")
                }
                Button("Abrir Atalhos") {
                    if let url = URL(string: "shortcuts://") {
                        openURL(url)
                    }
                }
            }

            Section("Colar uma notificação") {
                TextField("App de origem (ex.: Alelo)", text: $viewModel.pasteSourceApp)
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

    private func sourceRow(_ source: NotificationImportSource) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: Binding(
                get: { viewModel.isEnabled(source) },
                set: { enabled in
                    Task { await viewModel.setEnabled(source, enabled: enabled) }
                }
            )) {
                Label(source.displayName, systemImage: source.systemImage)
            }
            .disabled(viewModel.destinationOptions.isEmpty)

            Button(viewModel.destinationLabel(for: source)) {
                viewModel.configuringSource = source
            }
            .font(.caption)
            .disabled(viewModel.destinationOptions.isEmpty)
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
