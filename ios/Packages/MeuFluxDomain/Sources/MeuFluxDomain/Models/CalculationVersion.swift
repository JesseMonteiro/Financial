import Foundation

/// Must match BFF `CALCULATION_VERSION` (`supabase/functions/pluggy-proxy/middleware/http.ts`).
public enum CalculationVersion {
    public static let current = "2026.09.2"

    /// Missing stamp (legacy cache) is not a mismatch; a different stamp is.
    /// Components are compared numerically so `2026.9.2` and `2026.09.2` match.
    public static func matches(_ remote: String?) -> Bool {
        guard let remote, !remote.isEmpty else { return true }
        guard let remoteParts = parse(remote), let currentParts = parse(current) else {
            return remote == current
        }
        return remoteParts == currentParts
    }

    private static func parse(_ value: String) -> [Int]? {
        let parts = value.split(separator: ".").compactMap { Int($0) }
        guard !parts.isEmpty, parts.count == value.split(separator: ".").count else { return nil }
        return parts
    }
}
