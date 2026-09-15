import SwiftUI
import MeuFluxDesignSystem

public struct AuthenticationView: View {
    @Bindable var viewModel: AuthenticationViewModel
    public var onAuthenticated: () -> Void

    public init(viewModel: AuthenticationViewModel, onAuthenticated: @escaping () -> Void = {}) {
        self.viewModel = viewModel
        self.onAuthenticated = onAuthenticated
    }

    public var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text("MeuFlux")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(MeuFluxColors.primary)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(MeuFluxColors.textSecondary)
                .multilineTextAlignment(.center)

            if viewModel.mode != .reset {
                Picker("Modo", selection: $viewModel.mode) {
                    Text("Entrar").tag(AuthMode.signIn)
                    Text("Criar conta").tag(AuthMode.signUp)
                }
                .pickerStyle(.segmented)
            }

            VStack(spacing: 12) {
                if viewModel.mode == .signUp {
                    TextField("Nome completo", text: $viewModel.fullName)
                        .textContentType(.name)
                        .foregroundStyle(MeuFluxColors.textPrimary)
                        .padding()
                        .background(MeuFluxColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12))
                }

                TextField("E-mail", text: $viewModel.email)
                    .textContentType(.username)
                    #if os(iOS)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    #endif
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .padding()
                    .background(MeuFluxColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12))

                if viewModel.mode != .reset {
                SecureField("Senha", text: $viewModel.password)
                        .textContentType(viewModel.mode == .signUp ? .newPassword : .password)
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .padding()
                    .background(MeuFluxColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12))
                }
            }

            if let hint = viewModel.configurationHint {
                Text(hint)
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.warning)
                    .multilineTextAlignment(.center)
            }

            if let success = viewModel.successMessage {
                Text(success)
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.success)
                    .multilineTextAlignment(.center)
            }

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.danger)
                    .multilineTextAlignment(.center)
            }

            Button {
                Task {
                    await viewModel.submit()
                    if viewModel.isAuthenticated { onAuthenticated() }
                }
            } label: {
                if viewModel.state.isLoading {
                    ProgressView()
                        .tint(.white)
                        .frame(maxWidth: .infinity)
                } else {
                    Text(primaryTitle)
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(MeuFluxColors.primary)
            .disabled(viewModel.state.isLoading)

            if viewModel.mode == .reset {
                Button("Voltar para entrar") {
                    viewModel.mode = .signIn
                    viewModel.errorMessage = nil
                    viewModel.successMessage = nil
                }
                .font(.footnote)
            } else {
                Button("Esqueci a senha") {
                    viewModel.mode = .reset
                    viewModel.errorMessage = nil
                    viewModel.successMessage = nil
                }
                .font(.footnote)
            }

            Spacer()
        }
        .padding(24)
        .foregroundStyle(MeuFluxColors.textPrimary)
        .background(MeuFluxColors.bgPrimary.ignoresSafeArea())
    }

    private var subtitle: String {
        switch viewModel.mode {
        case .signIn: return "Entre para ver suas finanças"
        case .signUp: return "Crie sua conta para começar"
        case .reset: return "Enviaremos um e-mail para redefinir a senha"
        }
    }

    private var primaryTitle: String {
        switch viewModel.mode {
        case .signIn: return "Entrar"
        case .signUp: return "Criar conta"
        case .reset: return "Enviar e-mail"
        }
    }
}

#Preview {
    AuthenticationView(viewModel: AuthenticationViewModel())
}
