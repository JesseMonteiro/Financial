import Foundation

/// Must match BFF `CALCULATION_VERSION` (`supabase/functions/pluggy-proxy/middleware/http.ts`).
public enum CalculationVersion {
    public static let current = "2026.09.2"

    /// Missing stamp (legacy cache) is not a mismatch; a different stamp is.
    public static func matches(_ remote: String?) -> Bool {
        guard let remote, !remote.isEmpty else { return true }
        return remote == current
    }
}
