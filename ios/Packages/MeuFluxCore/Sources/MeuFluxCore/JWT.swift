import Foundation

/// Name and e-mail extracted from a Supabase access-token payload.
public struct JWTIdentity: Equatable, Sendable {
    public var email: String
    public var displayName: String

    public init(email: String, displayName: String) {
        self.email = email
        self.displayName = displayName
    }
}

/// Minimal JWT helpers (no signature verification — only expiry from the payload).
public enum JWT {
    /// Seconds before `exp` at which the token is treated as stale and should be refreshed.
    public static let refreshLeeway: TimeInterval = 60

    public static func expiry(of jwt: String) -> Date? {
        guard let json = payload(of: jwt) else { return nil }

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

    public static func accountIdentity(of jwt: String) -> JWTIdentity? {
        guard let json = payload(of: jwt) else { return nil }
        let meta = json["user_metadata"] as? [String: Any]
        let email = stringClaim(json["email"])
            ?? stringClaim(meta?["email"])
            ?? ""
        let displayName = stringClaim(meta?["full_name"])
            ?? stringClaim(meta?["name"])
            ?? stringClaim(meta?["display_name"])
            ?? stringClaim(json["name"])
            ?? ""
        if email.isEmpty, displayName.isEmpty { return nil }
        return JWTIdentity(email: email, displayName: displayName)
    }

    public static func needsRefresh(
        _ jwt: String,
        now: Date = Date(),
        leeway: TimeInterval = refreshLeeway
    ) -> Bool {
        guard let expiry = expiry(of: jwt) else { return true }
        return now.addingTimeInterval(leeway) >= expiry
    }

    static func payload(of jwt: String) -> [String: Any]? {
        let parts = jwt.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count >= 2 else { return nil }
        guard let data = base64URLDecode(String(parts[1])),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return json
    }

    private static func stringClaim(_ value: Any?) -> String? {
        guard let raw = value as? String else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
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

