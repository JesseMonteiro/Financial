import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain
import MeuFluxIntelligence

public struct SettingsView: View {
    @State private var viewModel: SettingsViewModel
    @State private var inviteCode = ""
    @State private var showUnlinkConfirm = false
    private let onSignOut: (() -> Void)?
    private let onJointChanged: (() -> Void)?
    private let notificationImportDestination: AnyView?
    private let siriShortcutsTip: AnyView?

    public init(
        jointRepository: (any JointFinanceRepository)? = nil,
        settingsRepository: (any SettingsRepository)? = nil,
        onSignOut: (() -> Void)? = nil,
        onJointChanged: (() -> Void)? = nil,
        notificationImportDestination: AnyView? = nil,
        siriShortcutsTip: AnyView? = nil
    ) {
        _viewModel = State(wrappedValue: SettingsViewModel(
            jointRepository: jointRepository,
            settingsRepository: settingsRepository
        ))
        self.onSignOut = onSignOut
        self.onJointChanged = onJointChanged
        self.notificationImportDestination = notificationImportDestination
        self.siriShortcutsTip = siriShortcutsTip
    }

    public init() {
        self.init(jointRepository: nil)
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                PageLoadingSkeleton(style: .form)
            default:
                settingsForm
            }
        }
        .meuFluxPageTitle("Configurações")
        .task { await viewModel.load() }
        .confirmationDialog("Desvincular conta conjunta?", isPresented: $showUnlinkConfirm) {
            Button("Desvincular", role: .destructive) {
                Task {
                    await viewModel.unlinkJoint()
                    onJointChanged?()
                }
            }
            Button("Cancelar", role: .cancel) {}
        }
    }

    private var settingsForm: some View {
        Form {
            Section("Aparência") {
                Picker("Tema", selection: $viewModel.settings.theme) {
                    Text("Sistema").tag("system")
                    Text("Claro").tag("light")
                    Text("Escuro").tag("dark")
                }
                Picker("Densidade", selection: $viewModel.settings.density) {
                    Text("Compacto").tag("compact")
                    Text("Confortável").tag("comfortable")
                    Text("Espaçoso").tag("spacious")
                }
                Toggle("Animações", isOn: $viewModel.settings.animationsEnabled)
            }
            .onChange(of: viewModel.settings.theme) { _, _ in
                Task { await viewModel.persistAppearance() }
            }
            .onChange(of: viewModel.settings.density) { _, _ in
                Task { await viewModel.persistAppearance() }
            }
            .onChange(of: viewModel.settings.animationsEnabled) { _, _ in
                Task { await viewModel.persistAppearance() }
            }

            Section("Segurança") {
                Toggle("Bloqueio biométrico", isOn: $viewModel.settings.biometricLockEnabled)
                Toggle("Notificações push", isOn: $viewModel.settings.notificationsEnabled)
            }
            .onChange(of: viewModel.settings.biometricLockEnabled) { _, _ in
                Task { await viewModel.persistAppearance() }
            }

            if let notificationImportDestination {
                Section("Contas sem Open Finance") {
                    NavigationLink {
                        notificationImportDestination
                    } label: {
                        Label("Leitor de notificações", systemImage: "bell.badge")
                    }
                }
            }

            Section("Telegram") {
                if viewModel.settings.telegramLinked {
                    Label("Vinculado", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(MeuFluxColors.success)
                    Button("Desconectar Telegram", role: .destructive) {
                        Task { await viewModel.disconnectTelegram() }
                    }
                } else {
                    Button("Gerar token e abrir bot") {
                        Task { await viewModel.linkTelegram() }
                    }
                    if let url = viewModel.telegramURL {
                        Link("Abrir @FinancialJesse_bot", destination: url)
                    }
                }
            }

            Section("Conta conjunta") {
                if viewModel.settings.hasJointLink {
                    Text("Parceiro: \(viewModel.settings.partnerName ?? "—")")
                    Button("Desvincular", role: .destructive) {
                        showUnlinkConfirm = true
                    }
                } else {
                    Button("Gerar convite (6 dígitos)") {
                        Task { await viewModel.createJointInvite() }
                    }
                    if let code = viewModel.lastInviteCode {
                        Text("Código: \(code)")
                            .font(.body.monospaced())
                            .textSelection(.enabled)
                    }
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.danger)
                    }
                    TextField("Código do convite", text: $inviteCode)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    #endif
                    .disableAutocorrection(true)
                    Button("Aceitar convite") {
                        Task {
                            await viewModel.acceptJointInvite(inviteCode)
                            onJointChanged?()
                        }
                    }
                    .disabled(inviteCode.count != 6)
                }
            }

            Section("Apple Intelligence") {
                LabeledContent(
                    "Neste iPhone",
                    value: AppleIntelligenceAvailability.isAvailable ? "Disponível" : "Indisponível"
                )
                if let siriShortcutsTip {
                    siriShortcutsTip
                }
                Text("Depois de instalar, abra a Visão Geral uma vez. Se a Siri recusar, apague o app, instale de novo pelo Xcode e fale exatamente: “Qual meu saldo no MeuFlux?”.")
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textSecondary)
            }

            Section("Privacidade") {
                Text("Exportar e excluir conta ainda estão disponíveis na versão web.")
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textSecondary)
            }

            Section("Sessão") {
                Button("Sair", role: .destructive) {
                    onSignOut?()
                }
            }

            Section("Sobre") {
                LabeledContent("Idioma", value: "Português (Brasil)")
                LabeledContent("Versão", value: "1.0.0")
                LabeledContent("Cálculo de faturas", value: "1.0.0")
            }
        }
        .scrollContentBackground(.hidden)
        .background(MeuFluxColors.bgPrimary)
    }
}

#Preview { NavigationStack { SettingsView() } }
