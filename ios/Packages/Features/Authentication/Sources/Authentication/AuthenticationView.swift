import SwiftUI
import FinancialDesignSystem

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
            Text("FinanceHub")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(FinancialColors.primary)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(FinancialColors.textSecondary)
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
                        .padding()
                        .background(FinancialColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12))
                }

                TextField("E-mail", text: $viewModel.email)
                    .textContentType(.username)
                    #if os(iOS)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    #endif
                    .padding()
                    .background(FinancialColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12))

                if viewModel.mode != .reset {
                SecureField("Senha", text: $viewModel.password)
                        .textContentType(viewModel.mode == .signUp ? .newPassword : .password)
                    .padding()
                    .background(FinancialColors.bgTertiary, in: RoundedRectangle(cornerRadius: 12))
                }
            }

            if let hint = viewModel.configurationHint {
                Text(hint)
                    .font(.caption)
                    .foregroundStyle(FinancialColors.warning)
                    .multilineTextAlignment(.center)
            }

            if let success = viewModel.successMessage {
                Text(success)
                    .font(.caption)
                    .foregroundStyle(FinancialColors.success)
                    .multilineTextAlignment(.center)
            }

            if let error = viewModel.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(FinancialColors.danger)
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
            .tint(FinancialColors.primary)
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
        .background(FinancialColors.bgPrimary.ignoresSafeArea())
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
