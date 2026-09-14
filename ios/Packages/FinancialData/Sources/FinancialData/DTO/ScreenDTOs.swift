import Foundation

public struct AgendaScreenDTO: Decodable, Sendable {
    public let month: String
    public let items: [AgendaScreenItemDTO]
    public let calculationVersion: String?
}

public struct AgendaScreenItemDTO: Decodable, Sendable {
    public let id: String
    public let title: String
    public let date: String
    public let amount: Double?
    public let kind: String
    public let isCompleted: Bool?
}

public struct BudgetScreenDTO: Decodable, Sendable {
    public let month: String
    public let categories: [BudgetScreenRowDTO]
    public let calculationVersion: String?
}

public struct BudgetScreenRowDTO: Decodable, Sendable {
    public let id: String?
    public let category: String
    public let spent: Double
    public let limit: Double
    public let hasLimit: Bool?
    public let percent: Int?
}

public struct ReportsScreenDTO: Decodable, Sendable {
    public let months: Int
    public let selectedMonth: String
    public let income: Double
    public let expense: Double
    public let categories: [ReportsCategoryDTO]
    public let accounts: [ReportsAccountDTO]
    public let calculationVersion: String?
}

public struct ReportsCategoryDTO: Decodable, Sendable {
    public let name: String
    public let value: Double
}

public struct ReportsAccountDTO: Decodable, Sendable {
    public let id: String
    public let name: String
    public let type: String?
}

public struct SubscriptionsScreenDTO: Decodable, Sendable {
    public let items: [SubscriptionScreenItemDTO]
    public let calculationVersion: String?
}

public struct SubscriptionScreenItemDTO: Decodable, Sendable {
    public let id: String
    public let name: String
    public let amount: Double
    public let billingDay: Int?
    public let category: String?
    public let isActive: Bool?
}
