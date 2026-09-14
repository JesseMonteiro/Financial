import Foundation
import FinancialCore

public protocol TokenRefreshing: Sendable {
    /// Non-expired access token, refreshing with the refresh token when needed. `nil` if signed out.
    func validAccessToken() async throws -> String?
    /// Forces a refresh-token grant. Throws `AppError.unauthorized` if refresh is impossible.
    func refreshAccessToken() async throws -> String
}

/// Signs in against Supabase Auth (same project as the web app) and stores JWT in Keychain.
public actor SupabaseAuthService: TokenRefreshing {
    private let config: EnvConfig
    private let session: AuthSessionActor
    private let urlSession: URLSession
    private let logger: AppLogger
    private var isRefreshing = false
    private var refreshWaiters: [CheckedContinuation<String, Error>] = []

    public init(
        config: EnvConfig,
        session: AuthSessionActor,
        urlSession: URLSession = .shared,
        logger: AppLogger = AppLogger()
    ) {
        self.config = config
        self.session = session
        self.urlSession = urlSession
        self.logger = logger
    }

    public func signIn(email: String, password: String) async throws {
        let tokens = try await requestTokens(
            grantType: "password",
            body: ["email": email, "password": password]
        )
        try await session.setTokens(access: tokens.access, refresh: tokens.refresh)
        logger.info("Signed in", category: .auth)
    }

    public func signUp(email: String, password: String, fullName: String) async throws {
        guard config.isConfigured else {
            throw AppError.configuration(
                "Configure SUPABASE_URL, SUPABASE_ANON_KEY e API_BASE_URL no Secrets.xcconfig."
            )
        }
        var request = URLRequest(url: config.supabaseURL.appendingPathComponent("auth/v1/signup"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": email,
            "password": password,
            "data": ["full_name": fullName],
        ])
        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AppError.unknown("Resposta inválida do Supabase Auth")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw mapAuthError(data: data, status: http.statusCode)
        }
        logger.info("Signed up", category: .auth)
    }

    public func resetPassword(email: String) async throws {
        guard config.isConfigured else {
            throw AppError.configuration(
                "Configure SUPABASE_URL, SUPABASE_ANON_KEY e API_BASE_URL no Secrets.xcconfig."
            )
        }
        var request = URLRequest(url: config.supabaseURL.appendingPathComponent("auth/v1/recover"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email])
        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AppError.unknown("Resposta inválida do Supabase Auth")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw mapAuthError(data: data, status: http.statusCode)
        }
        logger.info("Password recovery sent", category: .auth)
    }

    public func signOut() async throws {
        try await session.clear()
    }

    public func validAccessToken() async throws -> String? {
        let access = await session.accessToken()
        let refresh = await session.refreshToken()
        if access == nil, refresh == nil { return nil }

        if let access, !JWT.needsRefresh(access) {
            return access
        }

        guard refresh != nil else {
            logger.error("Access token expired and no refresh token is stored", category: .auth)
            try await invalidateSession()
            throw AppError.unauthorized
        }

        return try await refreshAccessToken()
    }

    public func refreshAccessToken() async throws -> String {
        if isRefreshing {
            return try await withCheckedThrowingContinuation { continuation in
                refreshWaiters.append(continuation)
            }
        }

        isRefreshing = true
        defer { isRefreshing = false }

        do {
            let token = try await performRefresh()
            let waiters = refreshWaiters
            refreshWaiters = []
            waiters.forEach { $0.resume(returning: token) }
            return token
        } catch {
            let waiters = refreshWaiters
            refreshWaiters = []
            waiters.forEach { $0.resume(throwing: error) }
            throw error
        }
    }

    private func performRefresh() async throws -> String {
        guard let refresh = await session.refreshToken() else {
            try await invalidateSession()
            throw AppError.unauthorized
        }

        do {
            let tokens = try await requestTokens(
                grantType: "refresh_token",
                body: ["refresh_token": refresh]
            )
            try await session.setTokens(access: tokens.access, refresh: tokens.refresh ?? refresh)
            logger.info("Refreshed access token", category: .auth)
            return tokens.access
        } catch let error as AppError where error == .unauthorized {
            logger.error("Refresh token rejected", category: .auth)
            try await invalidateSession()
            throw error
        }
    }

    private func invalidateSession() async throws {
        try await session.clear()
        await MainActor.run {
            NotificationCenter.default.post(name: .financialSessionInvalidated, object: nil)
        }
    }

    private func requestTokens(
        grantType: String,
        body: [String: String]
    ) async throws -> (access: String, refresh: String?) {
        guard config.isConfigured else {
            throw AppError.configuration(
                "Configure SUPABASE_URL, SUPABASE_ANON_KEY e API_BASE_URL no Secrets.xcconfig."
            )
        }

        var components = URLComponents(
            url: config.supabaseURL.appendingPathComponent("auth/v1/token"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "grant_type", value: grantType)]
        guard let url = components?.url else {
            throw AppError.configuration("URL de autenticação inválida.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AppError.unknown("Resposta inválida do Supabase Auth")
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error_description"] as? String
                ?? (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["msg"] as? String
                ?? "HTTP \(http.statusCode)"
            logger.error("Auth failed: \(message)", category: .auth)
            if http.statusCode == 401 || http.statusCode == 403 {
                throw AppError.unauthorized
            }
            throw AppError.unknown(message)
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let access = json?["access_token"] as? String else {
            throw AppError.decodingFailed("access_token ausente")
        }
        let refresh = json?["refresh_token"] as? String
        return (access, refresh)
    }

    private func mapAuthError(data: Data, status: Int) -> AppError {
        let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error_description"] as? String
            ?? (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["msg"] as? String
            ?? "HTTP \(status)"
        logger.error("Auth failed: \(message)", category: .auth)
        if status == 401 || status == 403 {
            return .unauthorized
        }
        return .unknown(message)
    }
}
