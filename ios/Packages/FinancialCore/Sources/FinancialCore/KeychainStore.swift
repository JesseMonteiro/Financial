import Foundation
import Security

public protocol KeychainStoreProtocol: Sendable {
    func set(_ value: Data, forKey key: String) throws
    func data(forKey key: String) throws -> Data?
    func delete(forKey key: String) throws
    func string(forKey key: String) throws -> String?
    func setString(_ value: String, forKey key: String) throws
}

public struct KeychainStore: KeychainStoreProtocol, Sendable {
    private let service: String

    public init(service: String = "com.financial.app") {
        self.service = service
    }

    public func set(_ value: Data, forKey key: String) throws {
        try delete(forKey: key)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: value,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AppError.keychain("SecItemAdd \(status)")
        }
    }

    public func data(forKey key: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else {
            throw AppError.keychain("SecItemCopyMatching \(status)")
        }
        return data
    }

    public func delete(forKey key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw AppError.keychain("SecItemDelete \(status)")
        }
    }

    public func string(forKey key: String) throws -> String? {
        guard let data = try data(forKey: key) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func setString(_ value: String, forKey key: String) throws {
        guard let data = value.data(using: .utf8) else {
            throw AppError.keychain("UTF-8 encoding failed")
        }
        try set(data, forKey: key)
    }
}
