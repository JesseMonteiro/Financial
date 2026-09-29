import Foundation

/// Cache freshness policy for MeuFlux iOS (parity with `freshness.js` on Web).
///
/// Thresholds:
/// - < 15 min: `.fresh` (green dot, "atualizado")
/// - < 1 hour: `.aging` (orange dot, "sincronizado há pouco")
/// - >= 1 hour: `.stale` (red dot, "dados podem estar desatualizados")
public enum SyncFreshness: String, Sendable, CaseIterable {
    case never
    case fresh
    case aging
    case stale

    public static let freshMaxAge: TimeInterval = 15 * 60       // 15 minutes
    public static let agingMaxAge: TimeInterval = 60 * 60       // 1 hour

    public static func classify(_ lastSync: Date?) -> SyncFreshness {
        guard let lastSync else { return .never }
        let age = Date().timeIntervalSince(lastSync)
        if age < freshMaxAge { return .fresh }
        if age < agingMaxAge { return .aging }
        return .stale
    }

    public var label: String {
        switch self {
        case .never: "nunca sincronizado"
        case .fresh: "atualizado"
        case .aging: "sincronizado há pouco"
        case .stale: "dados podem estar desatualizados"
        }
    }

    public var dotColorName: String {
        switch self {
        case .fresh: "green"
        case .aging: "orange"
        case .stale: "red"
        case .never: "gray"
        }
    }

    public var iconSystemName: String {
        switch self {
        case .fresh: "checkmark.circle.fill"
        case .aging: "clock.fill"
        case .stale: "exclamationmark.triangle.fill"
        case .never: "arrow.triangle.2.circlepath"
        }
    }
}

public enum SyncFreshnessFormatter {
    /// Returns human-readable relative time description in pt-BR
    public static func relativeLabel(from date: Date?) -> String {
        guard let date else { return "nunca sincronizado" }
        let age = Date().timeIntervalSince(date)
        if age < 60 { return "agora mesmo" }
        let minutes = Int(age / 60)
        if minutes < 60 { return "há \(minutes) min" }
        let hours = Int(age / 3600)
        if hours < 24 { return "há \(hours)h" }
        let days = Int(age / 86400)
        return "há \(days)d"
    }
}
