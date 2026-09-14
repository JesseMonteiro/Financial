import Foundation

public struct CreditCardsScreenDTO: Decodable, Sendable {
    public let cards: [CreditCardSummaryDTO]
    public let outstandingTotal: String
    public let creditLimitTotal: String
    public let availableLimitTotal: String
    public let periods: [String: CreditBillPeriodDTO]
}

public struct CreditCardSummaryDTO: Decodable, Sendable {
    public let id: String
    public let name: String
    public let institutionName: String?
    public let marketingName: String?
    public let connectorName: String?
    public let iconKey: String?
    public let cardFaceUrl: String?
    public let lastFour: String?
    public let outstanding: String
    public let openTotal: String
    public let openDueKey: String?
    public let openDueDate: String?
    public let openTitle: String?
    public let lastPaidTotal: String?
    public let lastPaidKey: String?
    public let lastPaidTitle: String?
    public let creditLimit: String?
    public let availableLimit: String?
}

public struct CreditBillPeriodDTO: Decodable, Sendable {
    public let openDueKey: String?
    public let bills: [CreditBillBucketDTO]
}

public struct CreditBillBucketDTO: Decodable, Sendable {
    public let dueMonth: String
    public let title: String
    public let type: String
    public let total: String
    public let dueDate: String?
    public let dueDateShort: String?
    public let isPaid: Bool?
    public let hasOfficial: Bool?
    public let items: [CreditBillLineDTO]
}

public struct CreditBillLineDTO: Decodable, Sendable {
    public let id: String
    public let accountId: String?
    public let accountName: String?
    public let description: String
    public let amount: String
    public let isCredit: Bool?
    public let isPayment: Bool?
    public let isProjected: Bool?
    public let isPending: Bool?
    public let category: String?
    public let purchaseDate: String?
    public let installmentNumber: Int?
    public let installmentTotal: Int?
    public let merchantName: String?
}
