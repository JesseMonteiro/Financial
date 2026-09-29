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
    /// Robust ISO8601 / RFC3339 date parser supporting fractional seconds and space separators.
    public static func parseDate(_ string: String?) -> Date? {
        guard let string, !string.isEmpty else { return nil }
        let s = string.replacingOccurrences(of: " ", with: "T")
        let f1 = ISO8601DateFormatter()
        f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f1.date(from: s) { return d }
        let f2 = ISO8601DateFormatter()
        f2.formatOptions = [.withInternetDateTime]
        if let d = f2.date(from: s) { return d }

        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.timeZone = TimeZone(secondsFromGMT: 0)
        let patterns = [
            "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd HH:mm:ss.SSS",
            "yyyy-MM-dd HH:mm:ss"
        ]
        for pattern in patterns {
            df.dateFormat = pattern
            if let d = df.date(from: string) ?? df.date(from: s) {
                return d
            }
        }
        return nil
    }

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
