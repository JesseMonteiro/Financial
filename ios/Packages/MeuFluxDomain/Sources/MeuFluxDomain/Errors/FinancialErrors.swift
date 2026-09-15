import Foundation

public enum FinancialError: Error, Sendable, Equatable {
    case notAuthenticated
    case notFound(entity: String, id: String)
    case validation(String)
    case syncFailed(String)
    case offline
    case conflict(String)
    case underlying(String)

    public var messagePT: String {
        switch self {
        case .notAuthenticated:
            return "Você precisa entrar na sua conta."
        case .notFound(let entity, let id):
            return "\(entity) (\(id)) não encontrado."
        case .validation(let msg):
            return msg
        case .syncFailed(let msg):
            return "Falha na sincronização: \(msg)"
        case .offline:
            return "Você está offline. As alterações serão enviadas depois."
        case .conflict(let msg):
            return "Conflito de dados: \(msg)"
        case .underlying(let msg):
            return msg
        }
    }
}
