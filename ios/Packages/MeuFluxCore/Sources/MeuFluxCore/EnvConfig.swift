import Foundation

public enum AppEnvironment: String, Sendable, CaseIterable {
    case debug
    case staging
    case production
}

public struct EnvConfig: Sendable, Equatable {
    public let environment: AppEnvironment
    public let apiBaseURL: URL
    public let supabaseURL: URL
    public let supabaseAnonKey: String
    public let appDisplayName: String
    public let featureFlags: FeatureFlags

    public init(
        environment: AppEnvironment,
        apiBaseURL: URL,
        supabaseURL: URL,
        supabaseAnonKey: String,
        appDisplayName: String = "MeuFlux",
        featureFlags: FeatureFlags = .default
    ) {
        self.environment = environment
        self.apiBaseURL = apiBaseURL
        self.supabaseURL = supabaseURL
        self.supabaseAnonKey = supabaseAnonKey
        self.appDisplayName = appDisplayName
        self.featureFlags = featureFlags
    }

    public var isConfigured: Bool {
        let anon = supabaseAnonKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let unresolved = anon.hasPrefix("$(") || anon == "REPLACE_ME" || anon.isEmpty
        let badHost = supabaseURL.host?.contains("example") == true
            || apiBaseURL.host?.contains("example") == true
            || apiBaseURL.host == "localhost"
            || supabaseURL.host == nil
            || apiBaseURL.host == nil
        return !unresolved && !badHost
    }

    /// Reads `API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` from Info.plist (xcconfig → plist).
    public static func fromBundle(
        _ bundle: Bundle = .main,
        environment: AppEnvironment = .debug
    ) -> EnvConfig {
        let info = bundle.infoDictionary ?? [:]
        func plist(_ key: String) -> String? {
            guard let raw = info[key] as? String else { return nil }
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            // Unexpanded build setting slipped into the bundle.
            if trimmed.hasPrefix("$(") { return nil }
            return trimmed.isEmpty ? nil : trimmed
        }

        let api = plist("API_BASE_URL")
        let supabase = plist("SUPABASE_URL")
        let anon = plist("SUPABASE_ANON_KEY")
        let name = (info["CFBundleDisplayName"] as? String) ?? "MeuFlux"

        let apiURL = URL(string: api ?? "") ?? URL(string: "https://example.invalid")!
        let supabaseURL = URL(string: supabase ?? "") ?? URL(string: "https://example.invalid")!

        var flags = FeatureFlags.debug
        flags.biometricLockEnabled = false

        return EnvConfig(
            environment: environment,
            apiBaseURL: apiURL,
            supabaseURL: supabaseURL,
            supabaseAnonKey: anon ?? "REPLACE_ME",
            appDisplayName: name,
            featureFlags: flags
        )
    }

    public static let debug = EnvConfig(
        environment: .debug,
        apiBaseURL: URL(string: "https://example.invalid/functions/v1/pluggy-proxy")!,
        supabaseURL: URL(string: "https://example.invalid")!,
        supabaseAnonKey: "REPLACE_ME",
        featureFlags: .debug
    )
}
