import Foundation

/// Closed set aligned with default `PurchaseCategory` keys for heuristic categorizing.
public enum ExpenseCategoryKind: String, Sendable, Codable, CaseIterable, Hashable, Identifiable {
    case food = "Food"
    case groceries = "Groceries"
    case rent = "Rent"
    case utilities = "Utilities"
    case transport = "Transport"
    case entertainment = "Entertainment"
    case health = "Health"
    case education = "Education"
    case other = "Other"

    public var id: String { rawValue }

    public var labelPT: String {
        switch self {
        case .food: return "Alimentação"
        case .groceries: return "Supermercado"
        case .rent: return "Aluguel / Habitação"
        case .utilities: return "Contas de Consumo (Água, Luz)"
        case .transport: return "Transporte"
        case .entertainment: return "Lazer / Entretenimento"
        case .health: return "Saúde"
        case .education: return "Educação"
        case .other: return "Outros"
        }
    }

    /// SF Symbol used in transaction rows and category lists.
    public var systemImage: String {
        CategoryIconCatalog.systemImage(forIconId: CategoryIconCatalog.defaultIconId(for: self))
    }

    public func mealBudgetCategory(merchant: String?) -> String {
        let hay = (merchant ?? "").notificationImportFolded
        if hay.contains("ifood") || hay.contains("rappi") || hay.contains("uber eats")
            || hay.contains("delivery") {
            return "Delivery de Comida"
        }
        switch self {
        case .food: return "Restaurantes & Bares"
        case .groceries: return "Supermercado & Alimentação"
        default: return "Supermercado & Alimentação"
        }
    }

    public static func fromStorage(_ raw: String?) -> ExpenseCategoryKind {
        guard let raw, let match = ExpenseCategoryKind(rawValue: raw) else { return .other }
        return match
    }
}

public struct PurchaseCategorySuggestion: Sendable, Hashable {
    public var kind: ExpenseCategoryKind
    public var merchant: String?
    public var usedOnDeviceModel: Bool

    public init(kind: ExpenseCategoryKind, merchant: String?, usedOnDeviceModel: Bool) {
        self.kind = kind
        self.merchant = merchant
        self.usedOnDeviceModel = usedOnDeviceModel
    }

    public var manualCategory: String { kind.rawValue }
    public var mealCategory: String { kind.mealBudgetCategory(merchant: merchant) }
}

public protocol PurchaseCategorizing: Sendable {
    func suggest(
        merchant: String?,
        source: NotificationImportSource,
        combinedText: String
    ) async -> PurchaseCategorySuggestion
}

public protocol PurchaseParsingAssisting: Sendable {
    func recoverPurchase(
        title: String,
        subtitle: String,
        body: String,
        sourceApp: String,
        now: Date
    ) async -> ParsedPurchase?
}

public enum MerchantNormalizer {
    public static func normalize(_ merchant: String?) -> String? {
        guard var value = merchant?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        let folded = value.notificationImportFolded
        let aliases: [(needles: [String], canon: String)] = [
            (["ifood"], "iFood"),
            (["uber eats"], "Uber Eats"),
            (["uber"], "Uber"),
            (["99 app", "99pop", "99 "], "99"),
            (["rappi"], "Rappi"),
            (["extra"], "Extra"),
            (["carrefour"], "Carrefour"),
            (["assai", "assaí"], "Assaí"),
            (["padaria"], value),
            (["netflix"], "Netflix"),
            (["spotify"], "Spotify"),
            (["drogasil"], "Drogasil"),
            (["raia"], "Droga Raia"),
        ]
        for alias in aliases {
            if alias.needles.contains(where: { folded.contains($0.notificationImportFolded) || folded == $0.notificationImportFolded }) {
                if alias.canon == value { break }
                return alias.canon
            }
        }
        if let star = value.firstIndex(of: "*") {
            let tail = value[value.index(after: star)...].trimmingCharacters(in: .whitespacesAndNewlines)
            if !tail.isEmpty { value = tail }
        }
        return value
    }
}

public struct RuleBasedPurchaseCategorizer: PurchaseCategorizing {
    public init() {}

    public func suggest(
        merchant: String?,
        source: NotificationImportSource,
        combinedText: String
    ) async -> PurchaseCategorySuggestion {
        let normalized = MerchantNormalizer.normalize(merchant)
        let kind = Self.heuristic(merchant: normalized, source: source, combinedText: combinedText)
        return PurchaseCategorySuggestion(kind: kind, merchant: normalized, usedOnDeviceModel: false)
    }

    public static func heuristic(
        merchant: String?,
        source: NotificationImportSource,
        combinedText: String
    ) -> ExpenseCategoryKind {
        let hay = [merchant, combinedText]
            .compactMap { $0?.notificationImportFolded }
            .joined(separator: " ")

        if matches(hay, ["uber", "99", "taxi", "táxi", "cabify", "onibus", "ônibus", "metro", "metrô", "estacionamento", "shell", "ipiranga", "posto"]) {
            return .transport
        }
        if matches(hay, ["ifood", "rappi", "uber eats", "restaurante", "hambur", "lanchonete", "padaria", "pizzaria", "bar "]) {
            return .food
        }
        if matches(hay, ["extra", "carrefour", "assai", "assaí", "supermercado", "mercado", "atacadao", "atacadão", "pao de acucar", "pão de açúcar"]) {
            return .groceries
        }
        if matches(hay, ["netflix", "spotify", "cinema", "ingresso", "steam", "playstation", "show "]) {
            return .entertainment
        }
        if matches(hay, ["farmacia", "farmácia", "drogaria", "drogasil", "raia", "hospital", "laboratorio", "laboratório"]) {
            return .health
        }
        if matches(hay, ["aluguel", "condominio", "condomínio", "iptu"]) {
            return .rent
        }
        if matches(hay, ["enel", "cpfl", "sabesp", "vivo", "claro", "tim", "energia", "agua", "água", "internet"]) {
            return .utilities
        }
        if matches(hay, ["escola", "faculdade", "udemy", "curso"]) {
            return .education
        }

        switch source {
        case .wallet, .alelo, .vr, .ticket, .pluxee, .caju, .flash, .swile, .ifoodBeneficios:
            return .food
        case .nubank, .itau, .bradesco, .c6, .inter, .picpay, .btg, .mercadoPago, .generic:
            return .other
        }
    }

    private static func matches(_ hay: String, _ needles: [String]) -> Bool {
        needles.contains { hay.contains($0.notificationImportFolded) }
    }
}
