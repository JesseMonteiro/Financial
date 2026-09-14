import Foundation
import FinancialCore

public protocol AuthSessionActor: Actor {
    func accessToken() async -> String?
    func refreshToken() async -> String?
    func setTokens(access: String, refresh: String?) async throws
    func clear() async throws
    func isAuthenticated() async -> Bool
}

public actor KeychainAuthSession: AuthSessionActor {
    private let keychain: KeychainStoreProtocol
    private let accessKey = "auth.accessToken"
    private let refreshKey = "auth.refreshToken"

    public init(keychain: KeychainStoreProtocol = KeychainStore()) {
        self.keychain = keychain
    }

    public func accessToken() async -> String? {
        try? keychain.string(forKey: accessKey)
    }

    public func refreshToken() async -> String? {
        try? keychain.string(forKey: refreshKey)
    }

    public func setTokens(access: String, refresh: String?) async throws {
        try keychain.setString(access, forKey: accessKey)
        if let refresh {
            try keychain.setString(refresh, forKey: refreshKey)
        } else {
            try keychain.delete(forKey: refreshKey)
        }
    }

    public func clear() async throws {
        try keychain.delete(forKey: accessKey)
        try keychain.delete(forKey: refreshKey)
    }

    public func isAuthenticated() async -> Bool {
        (try? keychain.string(forKey: accessKey)) != nil
    }
}
