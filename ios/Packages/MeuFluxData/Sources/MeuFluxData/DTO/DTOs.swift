import Foundation

// MARK: - OpenAPI-style DTOs (snake_case via decoder strategy)

public struct MoneyDTO: Codable, Sendable, Equatable {
    public let amount: String
    public let currency: String

    public init(amount: String, currency: String = "BRL") {
        self.amount = amount
        self.currency = currency
    }
}

public struct AccountDTO: Codable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let balance: MoneyDTO
    public let institutionName: String?
    public let connectorId: String?
    public let isHidden: Bool?
}

public struct TransactionDTO: Codable, Sendable {
    public let id: String
    public let accountId: String
    public let description: String
    public let amount: MoneyDTO
    public let date: String
    public let category: String?
    public let kind: String
    public let isPending: Bool?
}

public struct BillDTO: Codable, Sendable {
    public let id: String
    public let accountId: String
    public let dueMonth: String
    public let dueDate: String?
    public let totalAmount: MoneyDTO
    public let minimumPayment: MoneyDTO?
    public let status: String
    public let isPaid: Bool?
}

public struct InvestmentDTO: Codable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let balance: MoneyDTO
    public let accountId: String?
    public let rate: String?
}

public struct LoanDTO: Codable, Sendable {
    public let id: String
    public let name: String
    public let principal: MoneyDTO
    public let outstandingBalance: MoneyDTO
    public let interestRate: String?
    public let nextDueDate: String?
    public let installmentAmount: MoneyDTO?
}

public struct BudgetLimitDTO: Codable, Sendable {
    public let id: String
    public let category: String
    public let limit: MoneyDTO
    public let spent: MoneyDTO
    public let month: String
}

public struct GoalDTO: Codable, Sendable {
    public let id: String
    public let name: String
    public let target: MoneyDTO
    public let current: MoneyDTO
    public let deadline: String?
}

public struct ReceivableDTO: Codable, Sendable {
    public let id: String
    public let description: String
    public let amount: MoneyDTO
    public let dueDate: String?
    public let isReceived: Bool?
    public let counterparty: String?
}

public struct ManualExpenseDTO: Codable, Sendable {
    public let id: String
    public let description: String
    public let amount: MoneyDTO
    public let date: String
    public let category: String?
    public let accountId: String?
}

public struct SubscriptionDTO: Codable, Sendable {
    public let id: String
    public let name: String
    public let amount: MoneyDTO
    public let billingDay: Int?
    public let category: String?
    public let isActive: Bool?
}

public struct AgendaItemDTO: Codable, Sendable {
    public let id: String
    public let title: String
    public let date: String
    public let amount: MoneyDTO?
    public let kind: String
    public let isCompleted: Bool?
}

public struct UserProfileDTO: Codable, Sendable {
    public let id: String
    public let email: String
    public let displayName: String
    public let avatarUrl: String?
}

public struct AppSettingsDTO: Codable, Sendable {
    public let preferredLocale: String?
    public let biometricLockEnabled: Bool?
    public let notificationsEnabled: Bool?
    public let defaultDueMonthOffset: Int?
}

public struct BankItemDTO: Codable, Sendable {
    public let id: String
    public let institutionName: String
    public let status: String
    public let lastSyncAt: Date?
}

public struct AuthTokensDTO: Codable, Sendable {
    public let accessToken: String
    public let refreshToken: String?
}

public struct LoginBodyDTO: Codable, Sendable {
    public let email: String
    public let password: String
}
