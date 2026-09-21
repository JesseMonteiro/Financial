import Foundation

/// Flexible Pluggy / BFF list payloads.
public struct PluggyListDTO<T: Decodable & Sendable>: Decodable, Sendable {
    public let results: [T]
    public let total: Int?

    public init(results: [T], total: Int? = nil) {
        self.results = results
        self.total = total
    }

    public init(from decoder: Decoder) throws {
        if let array = try? decoder.singleValueContainer().decode([T].self) {
            results = array
            total = array.count
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let nested = try? container.nestedContainer(keyedBy: CodingKeys.self, forKey: .data) {
            results = try nested.decodeIfPresent([T].self, forKey: .results) ?? []
            total = try nested.decodeIfPresent(Int.self, forKey: .total)
            return
        }
        results = try container.decodeIfPresent([T].self, forKey: .results) ?? []
        total = try container.decodeIfPresent(Int.self, forKey: .total)
    }

    private enum CodingKeys: String, CodingKey {
        case results, total, data
    }
}

public struct V1Data<T: Decodable & Sendable>: Decodable, Sendable {
    public let data: T?
}

public struct PluggyCategoryDTO: Decodable, Sendable {
    public let id: String
    public let description: String
    public let descriptionTranslated: String?
    public let parentId: String?
}

public struct PluggyAccountDTO: Decodable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let subtype: String?
    public let balance: Decimal
    public let currencyCode: String?
    public let marketingName: String?
    public let itemId: String?
    public let number: String?
    public let updatedAt: String?
    public let bankData: PluggyBankDataDTO?
    public let creditData: PluggyCreditDataDTO?
    public let availableBalance: Decimal?
    public let reservedBalance: Decimal?
    public let openBillTotal: Decimal?
    public let outstanding: Decimal?
    public let billAmount: Decimal?
    public let isManual: Bool?
    public let lastPaidTotal: Decimal?
    public let openDueKey: String?
    public let connectorProfileId: String?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Conta"
        type = try c.decodeIfPresent(String.self, forKey: .type) ?? "BANK"
        subtype = try c.decodeIfPresent(String.self, forKey: .subtype)
        currencyCode = try c.decodeIfPresent(String.self, forKey: .currencyCode)
        marketingName = try c.decodeIfPresent(String.self, forKey: .marketingName)
        itemId = try c.decodeIfPresent(String.self, forKey: .itemId)
        number = try c.decodeIfPresent(String.self, forKey: .number)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
        bankData = try c.decodeIfPresent(PluggyBankDataDTO.self, forKey: .bankData)
        creditData = try c.decodeIfPresent(PluggyCreditDataDTO.self, forKey: .creditData)
        balance = Self.decodeDecimal(c, forKey: .balance) ?? 0
        availableBalance = Self.decodeDecimal(c, forKey: .availableBalance)
        reservedBalance = Self.decodeDecimal(c, forKey: .reservedBalance)
        openBillTotal = Self.decodeDecimal(c, forKey: .openBillTotal)
        outstanding = Self.decodeDecimal(c, forKey: .outstanding)
        billAmount = Self.decodeDecimal(c, forKey: .billAmount)
        lastPaidTotal = Self.decodeDecimal(c, forKey: .lastPaidTotal)
        isManual = try c.decodeIfPresent(Bool.self, forKey: .isManual)
        openDueKey = try c.decodeIfPresent(String.self, forKey: .openDueKey)
        connectorProfileId = try c.decodeIfPresent(String.self, forKey: .connectorProfileId)
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, type, subtype, balance, currencyCode, marketingName, itemId
        case number, updatedAt, bankData, creditData
        case availableBalance, reservedBalance, openBillTotal, outstanding, billAmount
        case isManual, lastPaidTotal, openDueKey, connectorProfileId
    }

    private static func decodeDecimal(_ c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) -> Decimal? {
        if let d = try? c.decode(Decimal.self, forKey: key) { return d }
        if let d = try? c.decode(Double.self, forKey: key) {
            return Decimal(string: String(d)) ?? Decimal(d)
        }
        if let s = try? c.decode(String.self, forKey: key) { return Decimal(string: s) }
        return nil
    }
}

public struct PluggyBankDataDTO: Decodable, Sendable {
    public let transferNumber: String?
    public let closingBalance: Decimal?
    public let automaticallyInvestedBalance: Decimal?
    public let overdraftContractedLimit: Decimal?
    public let overdraftUsedLimit: Decimal?
    public let unarrangedOverdraftAmount: Decimal?
    public let institutionName: String?
    public let primaryColor: String?
    public let reservedBalances: [PluggyReservedBalanceDTO]?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        transferNumber = try c.decodeIfPresent(String.self, forKey: .transferNumber)
        closingBalance = Self.decodeDecimal(c, forKey: .closingBalance)
        automaticallyInvestedBalance = Self.decodeDecimal(c, forKey: .automaticallyInvestedBalance)
        overdraftContractedLimit = Self.decodeDecimal(c, forKey: .overdraftContractedLimit)
        overdraftUsedLimit = Self.decodeDecimal(c, forKey: .overdraftUsedLimit)
        unarrangedOverdraftAmount = Self.decodeDecimal(c, forKey: .unarrangedOverdraftAmount)
        institutionName = try c.decodeIfPresent(String.self, forKey: .institutionName)
        primaryColor = try c.decodeIfPresent(String.self, forKey: .primaryColor)
        reservedBalances = try c.decodeIfPresent([PluggyReservedBalanceDTO].self, forKey: .reservedBalances)
    }

    private enum CodingKeys: String, CodingKey {
        case transferNumber, closingBalance, automaticallyInvestedBalance
        case overdraftContractedLimit, overdraftUsedLimit, unarrangedOverdraftAmount
        case institutionName, primaryColor, reservedBalances
    }

    private static func decodeDecimal(_ c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) -> Decimal? {
        if let d = try? c.decode(Decimal.self, forKey: key) { return d }
        if let d = try? c.decode(Double.self, forKey: key) {
            return Decimal(string: String(d)) ?? Decimal(d)
        }
        if let s = try? c.decode(String.self, forKey: key) { return Decimal(string: s) }
        return nil
    }

    public var reservedTotal: Decimal {
        (reservedBalances ?? []).reduce(0) { $0 + $1.totalAmount }
    }
}

public struct PluggyReservedBalanceDTO: Decodable, Sendable {
    public let identification: String?
    public let name: String?
    public let availableAmounts: [PluggyAvailableAmountDTO]?

    public var totalAmount: Decimal {
        (availableAmounts ?? []).reduce(0) { partial, entry in
            partial + (entry.amount ?? 0)
        }
    }
}

public struct PluggyAvailableAmountDTO: Decodable, Sendable {
    public let amount: Decimal?
    public let currencyCode: String?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        currencyCode = try c.decodeIfPresent(String.self, forKey: .currencyCode)
        if let d = try? c.decode(Decimal.self, forKey: .amount) {
            amount = d
        } else if let d = try? c.decode(Double.self, forKey: .amount) {
            amount = Decimal(string: String(d)) ?? Decimal(d)
        } else if let s = try? c.decode(String.self, forKey: .amount) {
            amount = Decimal(string: s)
        } else {
            amount = nil
        }
    }

    private enum CodingKeys: String, CodingKey {
        case amount, currencyCode
    }
}

public struct PluggyCreditDataDTO: Decodable, Sendable {
    public let level: String?
    public let brand: String?
    public let balanceCloseDate: String?
    public let balanceDueDate: String?
    public let availableCreditLimit: Decimal?
    public let creditLimit: Decimal?
    public let isLimitFlexible: Bool?
    public let status: String?
    public let holderType: String?
    public let number: String?
    public let institutionName: String?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        level = try c.decodeIfPresent(String.self, forKey: .level)
        brand = try c.decodeIfPresent(String.self, forKey: .brand)
        balanceCloseDate = try c.decodeIfPresent(String.self, forKey: .balanceCloseDate)
        balanceDueDate = try c.decodeIfPresent(String.self, forKey: .balanceDueDate)
        isLimitFlexible = try c.decodeIfPresent(Bool.self, forKey: .isLimitFlexible)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        holderType = try c.decodeIfPresent(String.self, forKey: .holderType)
        number = try c.decodeIfPresent(String.self, forKey: .number)
        institutionName = try c.decodeIfPresent(String.self, forKey: .institutionName)
        availableCreditLimit = Self.decodeDecimal(c, forKey: .availableCreditLimit)
        creditLimit = Self.decodeDecimal(c, forKey: .creditLimit)
    }

    private enum CodingKeys: String, CodingKey {
        case level, brand, balanceCloseDate, balanceDueDate
        case availableCreditLimit, creditLimit, isLimitFlexible
        case status, holderType, number, institutionName
    }

    private static func decodeDecimal(_ c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) -> Decimal? {
        if let d = try? c.decode(Decimal.self, forKey: key) { return d }
        if let d = try? c.decode(Double.self, forKey: key) {
            return Decimal(string: String(d)) ?? Decimal(d)
        }
        if let s = try? c.decode(String.self, forKey: key) { return Decimal(string: s) }
        return nil
    }
}

public struct CreditCardMetadataDTO: Decodable, Sendable {
    public let billId: String?
    public let billForecastDate: String?
    public let installmentNumber: Int?
    public let totalInstallments: Int?
    public let purchaseDate: String?
    public let purchaseId: String?
    
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        billId = try c.decodeIfPresent(String.self, forKey: .billId)
        billForecastDate = try c.decodeIfPresent(String.self, forKey: .billForecastDate)
        installmentNumber = try c.decodeIfPresent(Int.self, forKey: .installmentNumber)
        totalInstallments = try c.decodeIfPresent(Int.self, forKey: .totalInstallments)
        purchaseDate = try c.decodeIfPresent(String.self, forKey: .purchaseDate)
        purchaseId = try c.decodeIfPresent(String.self, forKey: .purchaseId)
    }
    
    private enum CodingKeys: String, CodingKey {
        case billId, billForecastDate, installmentNumber, totalInstallments, purchaseDate, purchaseId
    }
}

public struct PluggyTransactionDTO: Decodable, Sendable {
    public let id: String
    public let accountId: String
    public let description: String
    public let amount: Decimal
    public let date: String
    public let type: String?
    public let category: String?
    public let categoryId: String?
    public let status: String?
    public let currencyCode: String?
    public let creditCardMetadata: CreditCardMetadataDTO?
    public let billId: String?
    public let billForecastDate: String?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        accountId = try c.decodeIfPresent(String.self, forKey: .accountId) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? "Lançamento"
        date = try c.decodeIfPresent(String.self, forKey: .date) ?? ""
        type = try c.decodeIfPresent(String.self, forKey: .type)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        categoryId = try c.decodeIfPresent(String.self, forKey: .categoryId)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        currencyCode = try c.decodeIfPresent(String.self, forKey: .currencyCode)
        creditCardMetadata = try c.decodeIfPresent(CreditCardMetadataDTO.self, forKey: .creditCardMetadata)
        billId = try c.decodeIfPresent(String.self, forKey: .billId)
        billForecastDate = try c.decodeIfPresent(String.self, forKey: .billForecastDate)
        if let d = try? c.decode(Decimal.self, forKey: .amount) {
            amount = d
        } else if let d = try? c.decode(Double.self, forKey: .amount) {
            amount = Decimal(string: String(d)) ?? Decimal(d)
        } else if let s = try? c.decode(String.self, forKey: .amount), let d = Decimal(string: s) {
            amount = d
        } else {
            amount = 0
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id, accountId, description, amount, date, type, category, categoryId, status, currencyCode
        case creditCardMetadata, billId, billForecastDate
    }
}

/// Pluggy `/bills` payload (legacy BFF returns `{ results: [...] }`).
public struct PluggyBillDTO: Decodable, Sendable {
    public let id: String
    public let accountId: String
    public let dueDate: String?
    public let totalAmount: Decimal
    public let minimumPaymentAmount: Decimal?
    public let currencyCode: String?
    public let status: String?
    public let paidAt: String?
    public let payments: [PluggyBillPaymentDTO]?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        accountId = try c.decodeIfPresent(String.self, forKey: .accountId) ?? ""
        dueDate = try c.decodeIfPresent(String.self, forKey: .dueDate)
        currencyCode = try c.decodeIfPresent(String.self, forKey: .currencyCode)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        paidAt = try c.decodeIfPresent(String.self, forKey: .paidAt)
        payments = try c.decodeIfPresent([PluggyBillPaymentDTO].self, forKey: .payments)
        totalAmount = Self.decodeDecimal(c, forKey: .totalAmount) ?? 0
        minimumPaymentAmount = Self.decodeDecimal(c, forKey: .minimumPaymentAmount)
    }

    private enum CodingKeys: String, CodingKey {
        case id, accountId, dueDate, totalAmount, minimumPaymentAmount, currencyCode, status, paidAt, payments
    }

    private static func decodeDecimal(_ c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) -> Decimal? {
        if let d = try? c.decode(Decimal.self, forKey: key) { return d }
        if let d = try? c.decode(Double.self, forKey: key) {
            return Decimal(string: String(d)) ?? Decimal(d)
        }
        if let s = try? c.decode(String.self, forKey: key) { return Decimal(string: s) }
        return nil
    }
}

public struct PluggyBillPaymentDTO: Decodable, Sendable {
    public let amount: Decimal?
    public let paymentDate: String?
}
