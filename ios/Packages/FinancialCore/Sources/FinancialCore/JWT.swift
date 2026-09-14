import Foundation

/// Minimal JWT helpers (no signature verification — only expiry from the payload).
public enum JWT {
    /// Seconds before `exp` at which the token is treated as stale and should be refreshed.
    public static let refreshLeeway: TimeInterval = 60

    public static func expiry(of jwt: String) -> Date? {
        let parts = jwt.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count >= 2 else { return nil }
        guard let data = base64URLDecode(String(parts[1])),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }

        let exp: TimeInterval
        if let value = json["exp"] as? TimeInterval {
            exp = value
        } else if let value = json["exp"] as? Int {
            exp = TimeInterval(value)
        } else if let value = json["exp"] as? NSNumber {
            exp = value.doubleValue
        } else {
            return nil
        }
        return Date(timeIntervalSince1970: exp)
    }

    public static func needsRefresh(
        _ jwt: String,
        now: Date = Date(),
        leeway: TimeInterval = refreshLeeway
    ) -> Bool {
        guard let expiry = expiry(of: jwt) else { return true }
        return now.addingTimeInterval(leeway) >= expiry
    }

    private static func base64URLDecode(_ value: String) -> Data? {
        var base64 = value
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 {
            base64.append(String(repeating: "=", count: 4 - remainder))
        }
        return Data(base64Encoded: base64)
    }
}

