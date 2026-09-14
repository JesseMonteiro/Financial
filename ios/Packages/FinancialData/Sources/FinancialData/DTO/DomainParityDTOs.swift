import Foundation

enum FlexibleDecimal {
    static func decode<K: CodingKey>(_ container: KeyedDecodingContainer<K>, forKey key: K) -> Decimal? {
        if let d = try? container.decode(Decimal.self, forKey: key) { return d }
        if let d = try? container.decode(Double.self, forKey: key) {
            return Decimal(string: String(d)) ?? Decimal(d)
        }
        if let s = try? container.decode(String.self, forKey: key) { return Decimal(string: s) }
        if let i = try? container.decode(Int.self, forKey: key) { return Decimal(i) }
        return nil
    }
}

struct V1Envelope<T: Decodable & Sendable>: Decodable, Sendable {
    let data: T?
}

struct ConnectTokenDTO: Decodable, Sendable {
    let accessToken: String?
}

struct TelegramLinkTokenDTO: Decodable, Sendable {
    let success: Bool?
    let token: String?
}

struct RegisterItemBody: Encodable, Sendable {
    let itemId: String
}

struct ConnectTokenBody: Encodable, Sendable {
    let itemId: String?
}

struct ParseBillBody: Encodable, Sendable {
    let base64: String
    let mimeType: String
}

struct ParsedBillDTO: Decodable, Sendable {
    let totalAmount: Decimal
    let dueDate: String?
    let closingDate: String?
    let cardLastDigits: String?
    let institutionName: String?
    let purchases: [ParsedBillPurchaseDTO]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalAmount = FlexibleDecimal.decode(c, forKey: .totalAmount) ?? 0
        dueDate = try c.decodeIfPresent(String.self, forKey: .dueDate)
        closingDate = try c.decodeIfPresent(String.self, forKey: .closingDate)
        cardLastDigits = try c.decodeIfPresent(String.self, forKey: .cardLastDigits)
        institutionName = try c.decodeIfPresent(String.self, forKey: .institutionName)
        purchases = try c.decodeIfPresent([ParsedBillPurchaseDTO].self, forKey: .purchases) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case totalAmount, dueDate, closingDate, cardLastDigits, institutionName, purchases
    }
}

struct ParsedBillPurchaseDTO: Decodable, Sendable {
    let date: String?
    let description: String
    let amount: Decimal
    let installment: Int?
    let totalInstallments: Int?
    let category: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        date = try c.decodeIfPresent(String.self, forKey: .date)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? "Compra"
        amount = FlexibleDecimal.decode(c, forKey: .amount) ?? 0
        installment = try c.decodeIfPresent(Int.self, forKey: .installment)
        totalInstallments = try c.decodeIfPresent(Int.self, forKey: .totalInstallments)
        category = try c.decodeIfPresent(String.self, forKey: .category)
    }

    private enum CodingKeys: String, CodingKey {
        case date, description, amount, installment, totalInstallments, category
    }
}

struct DomainProfileDTO: Decodable, Sendable {
    let id: String?
    let displayName: String?
    let theme: String?
    let density: String?
    let animationsEnabled: Bool?
    let telegramChatId: String?
    let customAccountNames: [String: String]?
}

struct DomainBudgetRowDTO: Decodable, Sendable {
    let id: String?
    let category: String
    let limit: Decimal

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? "Other"
        limit = FlexibleDecimal.decode(c, forKey: .limit) ?? 0
    }

    private enum CodingKeys: String, CodingKey {
        case id, category, limit
    }
}

struct DomainGoalRowDTO: Decodable, Sendable {
    let id: String
    let title: String?
    let name: String?
    let targetAmount: Decimal
    let currentAmount: Decimal
    let deadline: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title = try c.decodeIfPresent(String.self, forKey: .title)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        targetAmount = FlexibleDecimal.decode(c, forKey: .targetAmount) ?? 0
        currentAmount = FlexibleDecimal.decode(c, forKey: .currentAmount) ?? 0
        deadline = try c.decodeIfPresent(String.self, forKey: .deadline)
    }

    private enum CodingKeys: String, CodingKey {
        case id, title, name, targetAmount, currentAmount, deadline
    }
}

struct DomainReceivableRowDTO: Decodable, Sendable {
    let id: String
    let personName: String?
    let description: String?
    let totalAmount: Decimal
    let installments: Int?
    let paidInstallments: Int?
    let isContinuous: Bool?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        personName = try c.decodeIfPresent(String.self, forKey: .personName)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        totalAmount = FlexibleDecimal.decode(c, forKey: .totalAmount) ?? 0
        installments = try c.decodeIfPresent(Int.self, forKey: .installments)
        paidInstallments = try c.decodeIfPresent(Int.self, forKey: .paidInstallments)
        isContinuous = try c.decodeIfPresent(Bool.self, forKey: .isContinuous)
    }

    private enum CodingKeys: String, CodingKey {
        case id, personName, description, totalAmount, installments, paidInstallments, isContinuous
    }
}

struct DomainManualRowDTO: Decodable, Sendable {
    let id: String
    let description: String
    let amount: Decimal
    let date: String
    let category: String?
    let accountId: String?
    let isPaid: Bool?
    let isRecurring: Bool?
    let isContinuous: Bool?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? "Despesa"
        amount = FlexibleDecimal.decode(c, forKey: .amount) ?? 0
        date = try c.decodeIfPresent(String.self, forKey: .date) ?? ""
        category = try c.decodeIfPresent(String.self, forKey: .category)
        accountId = try c.decodeIfPresent(String.self, forKey: .accountId)
        isPaid = try c.decodeIfPresent(Bool.self, forKey: .isPaid)
        isRecurring = try c.decodeIfPresent(Bool.self, forKey: .isRecurring)
        isContinuous = try c.decodeIfPresent(Bool.self, forKey: .isContinuous)
    }

    private enum CodingKeys: String, CodingKey {
        case id, description, amount, date, category, accountId, isPaid, isRecurring, isContinuous
    }
}

struct DomainManualAccountRowDTO: Decodable, Sendable {
    let id: String
    let name: String
    let type: String?
    let institutionName: String?
    let balance: Decimal
    let billAmount: Decimal?
    let billDueDay: Int?
    let creditLimit: Decimal?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Conta"
        type = try c.decodeIfPresent(String.self, forKey: .type)
        institutionName = try c.decodeIfPresent(String.self, forKey: .institutionName)
        balance = FlexibleDecimal.decode(c, forKey: .balance) ?? 0
        billAmount = FlexibleDecimal.decode(c, forKey: .billAmount)
        billDueDay = try c.decodeIfPresent(Int.self, forKey: .billDueDay)
        creditLimit = FlexibleDecimal.decode(c, forKey: .creditLimit)
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, type, institutionName, balance, billAmount, billDueDay, creditLimit
    }
}

struct PluggyInvestmentDTO: Decodable, Sendable {
    let id: String
    let name: String
    let type: String
    let subtype: String?
    let balance: Decimal
    let accountId: String?
    let rate: Decimal?
    let issuer: String?
    let ownerLabel: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try c.decodeIfPresent(String.self, forKey: .name)
            ?? c.decodeIfPresent(String.self, forKey: .number)
            ?? "Investimento"
        type = try c.decodeIfPresent(String.self, forKey: .subtype)
            ?? c.decodeIfPresent(String.self, forKey: .type)
            ?? "OTHER"
        subtype = try c.decodeIfPresent(String.self, forKey: .subtype)
        accountId = try c.decodeIfPresent(String.self, forKey: .accountId)
            ?? c.decodeIfPresent(String.self, forKey: .itemId)
        issuer = try c.decodeIfPresent(String.self, forKey: .issuer)
            ?? c.decodeIfPresent(String.self, forKey: .institution)
        ownerLabel = try c.decodeIfPresent(String.self, forKey: .ownerLabel)
        let bal = FlexibleDecimal.decode(c, forKey: .balance)
            ?? FlexibleDecimal.decode(c, forKey: .amount)
            ?? FlexibleDecimal.decode(c, forKey: .value)
            ?? 0
        balance = bal
        rate = FlexibleDecimal.decode(c, forKey: .rate)
            ?? FlexibleDecimal.decode(c, forKey: .annualRate)
            ?? FlexibleDecimal.decode(c, forKey: .lastMonthRate)
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, number, type, subtype, balance, amount, value
        case accountId, itemId, rate, annualRate, lastMonthRate
        case issuer, institution, ownerLabel
    }
}

struct PluggyLoanDTO: Decodable, Sendable {
    let id: String
    let name: String
    let principal: Decimal
    let outstandingBalance: Decimal
    let interestRate: Decimal?
    let nextDueDate: String?
    let installmentAmount: Decimal?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try c.decodeIfPresent(String.self, forKey: .contractNumber)
            ?? c.decodeIfPresent(String.self, forKey: .type)
            ?? "Empréstimo"
        outstandingBalance = FlexibleDecimal.decode(c, forKey: .outstandingBalance)
            ?? FlexibleDecimal.decode(c, forKey: .balance)
            ?? 0
        principal = FlexibleDecimal.decode(c, forKey: .principalAmount)
            ?? FlexibleDecimal.decode(c, forKey: .principal)
            ?? outstandingBalance
        interestRate = FlexibleDecimal.decode(c, forKey: .interestRate)
            ?? FlexibleDecimal.decode(c, forKey: .annualInterestRate)
        nextDueDate = try c.decodeIfPresent(String.self, forKey: .dueDate)
            ?? c.decodeIfPresent(String.self, forKey: .nextDueDate)
        installmentAmount = FlexibleDecimal.decode(c, forKey: .installmentAmount)
            ?? FlexibleDecimal.decode(c, forKey: .installment)
    }

    private enum CodingKeys: String, CodingKey {
        case id, contractNumber, type, outstandingBalance, balance
        case principalAmount, principal, interestRate, annualInterestRate
        case dueDate, nextDueDate, installmentAmount, installment
    }
}

struct PluggyItemDTO: Decodable, Sendable {
    let id: String
    let institutionName: String
    let status: String
    let executionStatus: String?
    let lastSyncAt: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? "UNKNOWN"
        executionStatus = try c.decodeIfPresent(String.self, forKey: .executionStatus)
        lastSyncAt = try c.decodeIfPresent(String.self, forKey: .lastUpdatedAt)
            ?? c.decodeIfPresent(String.self, forKey: .updatedAt)
            ?? c.decodeIfPresent(String.self, forKey: .createdAt)
        if let connector = try? c.nestedContainer(keyedBy: ConnectorKeys.self, forKey: .connector) {
            institutionName = try connector.decodeIfPresent(String.self, forKey: .name) ?? "Instituição"
        } else {
            institutionName = try c.decodeIfPresent(String.self, forKey: .connectorName) ?? "Instituição"
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id, status, executionStatus, lastUpdatedAt, updatedAt, createdAt, connector, connectorName
    }

    private enum ConnectorKeys: String, CodingKey {
        case name
    }
}

struct JointInvestmentsDTO: Decodable, Sendable {
    let investments: [PluggyInvestmentDTO]
}

