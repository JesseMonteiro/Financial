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

public struct PluggyAccountDTO: Decodable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let subtype: String?
    public let balance: Decimal
    public let currencyCode: String?
    public let marketingName: String?
    public let itemId: String?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Conta"
        type = try c.decodeIfPresent(String.self, forKey: .type) ?? "BANK"
        subtype = try c.decodeIfPresent(String.self, forKey: .subtype)
        currencyCode = try c.decodeIfPresent(String.self, forKey: .currencyCode)
        marketingName = try c.decodeIfPresent(String.self, forKey: .marketingName)
        itemId = try c.decodeIfPresent(String.self, forKey: .itemId)
        balance = Self.decodeDecimal(c, forKey: .balance) ?? 0
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, type, subtype, balance, currencyCode, marketingName, itemId
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

public struct PluggyTransactionDTO: Decodable, Sendable {
    public let id: String
    public let accountId: String
    public let description: String
    public let amount: Decimal
    public let date: String
    public let type: String?
    public let category: String?
    public let status: String?
    public let currencyCode: String?

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        accountId = try c.decodeIfPresent(String.self, forKey: .accountId) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? "Lançamento"
        date = try c.decodeIfPresent(String.self, forKey: .date) ?? ""
        type = try c.decodeIfPresent(String.self, forKey: .type)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        currencyCode = try c.decodeIfPresent(String.self, forKey: .currencyCode)
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
        case id, accountId, description, amount, date, type, category, status, currencyCode
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
