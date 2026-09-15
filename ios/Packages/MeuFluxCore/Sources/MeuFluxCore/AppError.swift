import Foundation

/// Cross-cutting application errors (transport, config, persistence).
public enum AppError: Error, Sendable, Equatable {
    case networkUnavailable
    case unauthorized
    case notFound
    case decodingFailed(String)
    case keychain(String)
    case configuration(String)
    case unknown(String)

    public var localizedDescriptionPT: String {
        switch self {
        case .networkUnavailable:
            return "Sem conexão com a internet."
        case .unauthorized:
            return "Sessão expirada. Faça login novamente."
        case .notFound:
            return "Recurso não encontrado."
        case .decodingFailed(let detail):
            return "Falha ao interpretar dados: \(detail)"
        case .keychain(let detail):
            return "Erro no cofre seguro: \(detail)"
        case .configuration(let detail):
            return "Configuração inválida: \(detail)"
        case .unknown(let detail):
            return detail
        }
    }
}

extension AppError: LocalizedError, CustomNSError {
    public static var errorDomain: String { "MeuFluxCore.AppError" }

    public var errorCode: Int {
        switch self {
        case .networkUnavailable: return 0
        case .unauthorized: return 1
        case .notFound: return 2
        case .decodingFailed: return 3
        case .keychain: return 4
        case .configuration: return 5
        case .unknown: return 6
        }
    }

    public var errorDescription: String? { localizedDescriptionPT }

    public var errorUserInfo: [String: Any] {
        [NSLocalizedDescriptionKey: localizedDescriptionPT]
    }
}

public extension Notification.Name {
    /// Posted after the stored session is cleared because the JWT could not be refreshed.
    static let financialSessionInvalidated = Notification.Name("MeuFluxCore.sessionInvalidated")
}
