import SwiftUI
import FinancialDesignSystem
import FinancialDomain

public struct SettingsView: View {
    @State private var viewModel: SettingsViewModel
    @State private var inviteCode = ""
    @State private var showUnlinkConfirm = false
    private let onSignOut: (() -> Void)?
    private let onJointChanged: (() -> Void)?

    public init(
        jointRepository: (any JointFinanceRepository)? = nil,
        settingsRepository: (any SettingsRepository)? = nil,
        onSignOut: (() -> Void)? = nil,
        onJointChanged: (() -> Void)? = nil
    ) {
        _viewModel = State(wrappedValue: SettingsViewModel(
            jointRepository: jointRepository,
            settingsRepository: settingsRepository
        ))
        self.onSignOut = onSignOut
        self.onJointChanged = onJointChanged
    }

    public init() {
        self.init(jointRepository: nil)
    }

    public var body: some View {
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

            Section("Telegram") {
                if viewModel.settings.telegramLinked {
                    Label("Vinculado", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(FinancialColors.success)
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
                            .foregroundStyle(FinancialColors.danger)
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

            Section("Privacidade") {
                Text("Exportar e excluir conta ainda estão disponíveis na versão web.")
                    .font(.caption)
                    .foregroundStyle(FinancialColors.textSecondary)
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
        .navigationTitle("Configurações")
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
}

#Preview { NavigationStack { SettingsView() } }
