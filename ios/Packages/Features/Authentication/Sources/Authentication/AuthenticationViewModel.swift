import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

public enum AuthMode: String, Sendable, CaseIterable {
    case signIn
    case signUp
    case reset
}

public protocol AuthSigning: Sendable {
    func signIn(email: String, password: String) async throws
    func signUp(email: String, password: String, fullName: String) async throws
    func resetPassword(email: String) async throws
}

@Observable
@MainActor
public final class AuthenticationViewModel {
    public var email: String = ""
    public var password: String = ""
    public var fullName: String = ""
    public var mode: AuthMode = .signIn
    public private(set) var state: FeatureLoadState<Bool> = .idle
    public var errorMessage: String?
    public var successMessage: String?
    public var isAuthenticated: Bool = false
    public var configurationHint: String?

    private let auth: (any AuthSigning)?

    public init(auth: (any AuthSigning)? = nil) {
        self.auth = auth
    }

    public func submit() async {
        switch mode {
        case .signIn: await signIn()
        case .signUp: await signUp()
        case .reset: await resetPassword()
        }
    }

    public func signIn() async {
        state = .loading
        errorMessage = nil
        successMessage = nil
        guard email.contains("@"), password.count >= 6 else {
            errorMessage = "Informe e-mail e senha válidos."
            state = .failed(errorMessage!)
            return
        }
        guard let auth else {
            failAuthNotConfigured()
            return
        }
        do {
            try await auth.signIn(email: trimmedEmail, password: password)
            isAuthenticated = true
            state = .loaded(true)
        } catch {
            fail(error, fallback: "Falha ao entrar. Verifique e-mail, senha e Secrets.xcconfig.")
        }
    }

    public func signUp() async {
        state = .loading
        errorMessage = nil
        successMessage = nil
        guard email.contains("@"), password.count >= 6, !fullName.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Preencha nome, e-mail e senha (mínimo 6 caracteres)."
            state = .failed(errorMessage!)
            return
        }
        guard let auth else {
            failAuthNotConfigured()
            return
        }
        do {
            try await auth.signUp(email: trimmedEmail, password: password, fullName: fullName.trimmingCharacters(in: .whitespacesAndNewlines))
            successMessage = "Conta criada! Verifique seu e-mail para confirmar."
            mode = .signIn
            password = ""
            state = .idle
        } catch {
            fail(error, fallback: "Não foi possível criar a conta.")
        }
    }

    public func resetPassword() async {
        state = .loading
        errorMessage = nil
        successMessage = nil
        guard email.contains("@") else {
            errorMessage = "Informe um e-mail válido."
            state = .failed(errorMessage!)
            return
        }
        guard let auth else {
            failAuthNotConfigured()
            return
        }
        do {
            try await auth.resetPassword(email: trimmedEmail)
            successMessage = "E-mail de redefinição enviado."
            mode = .signIn
            state = .idle
        } catch {
            fail(error, fallback: "Não foi possível enviar o e-mail de redefinição.")
        }
    }

    private var trimmedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func failAuthNotConfigured() {
        errorMessage = "Auth não configurado. Preencha Secrets.xcconfig e reinicie o app."
        state = .failed(errorMessage!)
    }

    private func fail(_ error: Error, fallback: String) {
        let message = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        errorMessage = message.isEmpty ? fallback : message
        state = .failed(errorMessage!)
    }
}
