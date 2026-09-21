import Foundation

public struct PurchaseCategory: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var key: String
    public var label: String
    public var color: String?
    /// Shared catalog id (`CategoryIconCatalog`), e.g. `utensils`, `car`.
    public var icon: String?
    public var sortOrder: Int

    public init(
        id: String,
        key: String,
        label: String,
        color: String? = nil,
        icon: String? = nil,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.key = key
        self.label = label
        self.color = color
        self.icon = icon ?? CategoryIconCatalog.defaultIconId(forKey: key)
        self.sortOrder = sortOrder
    }
}

public enum PurchaseCategoryCatalog {
    public static let defaults: [PurchaseCategory] = [
        PurchaseCategory(id: "default-FoodAndDrinks", key: "Food and drinks", label: "Alimentação", color: "#f97316", icon: "utensils", sortOrder: 0),
        PurchaseCategory(id: "default-Groceries", key: "Groceries", label: "Supermercados", color: "#fb923c", icon: "cart", sortOrder: 1),
        PurchaseCategory(id: "default-Housing", key: "Housing", label: "Habitação", color: "#a855f7", icon: "home", sortOrder: 2),
        PurchaseCategory(id: "default-Transportation", key: "Transportation", label: "Transporte", color: "#0ea5e9", icon: "car", sortOrder: 3),
        PurchaseCategory(id: "default-Services", key: "Services", label: "Serviços", color: "#0284c7", icon: "wrench", sortOrder: 4),
        PurchaseCategory(id: "default-Shopping", key: "Shopping", label: "Compras", color: "#ec4899", icon: "bag", sortOrder: 5),
        PurchaseCategory(id: "default-Healthcare", key: "Healthcare", label: "Saúde", color: "#10b981", icon: "heart", sortOrder: 6),
        PurchaseCategory(id: "default-Education", key: "Education", label: "Educação", color: "#eab308", icon: "graduationcap", sortOrder: 7),
        PurchaseCategory(id: "default-Leisure", key: "Leisure", label: "Lazer", color: "#f43f5e", icon: "ticket", sortOrder: 8),
        PurchaseCategory(id: "default-DigitalServices", key: "Digital services", label: "Serviços digitais", color: "#8b5cf6", icon: "tv", sortOrder: 9),
        PurchaseCategory(id: "default-Travel", key: "Travel", label: "Viagens", color: "#06b6d4", icon: "airplane", sortOrder: 10),
        PurchaseCategory(id: "default-Income", key: "Income", label: "Renda", color: "#22c55e", icon: "banknote", sortOrder: 11),
        PurchaseCategory(id: "default-Investments", key: "Investments", label: "Investimentos", color: "#3b82f6", icon: "chart", sortOrder: 12),
        PurchaseCategory(id: "default-Transfers", key: "Transfers", label: "Transferências", color: "#8b5cf6", icon: "creditcard", sortOrder: 13),
        PurchaseCategory(id: "default-SamePersonTransfer", key: "Same person transfer", label: "Transferência entre mesma pessoa", color: "#6366f1", icon: "creditcard", sortOrder: 14),
        PurchaseCategory(id: "default-LoansAndFinancing", key: "Loans and Financing", label: "Empréstimos e Financiamentos", color: "#ef4444", icon: "percent", sortOrder: 15),
        PurchaseCategory(id: "default-BankFees", key: "Bank fees", label: "Taxas bancárias", color: "#78716c", icon: "percent", sortOrder: 16),
        PurchaseCategory(id: "default-Taxes", key: "Taxes", label: "Impostos", color: "#dc2626", icon: "doc", sortOrder: 17),
        PurchaseCategory(id: "default-Insurance", key: "Insurance", label: "Seguro", color: "#2563eb", icon: "shield", sortOrder: 18),
        PurchaseCategory(id: "default-Donations", key: "Donations", label: "Doações", color: "#14b8a6", icon: "handraised", sortOrder: 19),
        PurchaseCategory(id: "default-Gambling", key: "Gambling", label: "Jogos de azar", color: "#d946ef", icon: "sparkles", sortOrder: 20),
        PurchaseCategory(id: "default-LegalObligations", key: "Legal obligations", label: "Obrigações legais", color: "#64748b", icon: "doc", sortOrder: 21),
        PurchaseCategory(id: "default-Other", key: "Other", label: "Outros", color: "#64748b", icon: "ellipsis", sortOrder: 22),
    ]

    public static let presetColors: [String] = [
        "#f97316", "#fb923c", "#a855f7", "#c084fc", "#0ea5e9",
        "#ec4899", "#10b981", "#eab308", "#64748b", "#6366f1",
    ]

    public static func sorted(_ categories: [PurchaseCategory]) -> [PurchaseCategory] {
        categories.sorted { lhs, rhs in
            if lhs.sortOrder != rhs.sortOrder { return lhs.sortOrder < rhs.sortOrder }
            return lhs.label.localizedCaseInsensitiveCompare(rhs.label) == .orderedAscending
        }
    }

    public static func resolved(_ categories: [PurchaseCategory]) -> [PurchaseCategory] {
        categories.isEmpty ? defaults : sorted(categories)
    }

    public static func label(for raw: String?, in categories: [PurchaseCategory] = defaults) -> String {
        guard let raw, !raw.isEmpty else { return "Outros" }
        if let match = categories.first(where: { $0.key == raw }) {
            return match.label
        }
        return ExpenseCategoryKind(rawValue: raw)?.labelPT ?? raw
    }

    public static func color(for raw: String?, in categories: [PurchaseCategory] = defaults) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        if let match = categories.first(where: { $0.key == raw })?.color {
            return match
        }
        if let match = defaults.first(where: { $0.key == raw })?.color {
            return match
        }
        if let kind = kind(forPluggyOrKey: raw) {
            return defaults.first(where: { $0.key == kind.rawValue })?.color
        }
        return nil
    }

    public static func iconId(for raw: String?, in categories: [PurchaseCategory] = defaults) -> String {
        guard let raw, !raw.isEmpty else {
            return CategoryIconCatalog.defaultIconId(for: .other)
        }
        if let match = categories.first(where: { $0.key == raw })?.icon, !match.isEmpty {
            return match
        }
        if let match = defaults.first(where: { $0.key == raw })?.icon, !match.isEmpty {
            return match
        }
        return CategoryIconCatalog.defaultIconId(forKey: raw)
    }

    public static func systemImage(for raw: String?, in categories: [PurchaseCategory] = defaults) -> String {
        CategoryIconCatalog.systemImage(forIconId: iconId(for: raw, in: categories))
    }

    /// Maps Pluggy / legacy category labels onto the closed purchase set.
    public static func kind(forPluggyOrKey raw: String) -> ExpenseCategoryKind? {
        if let kind = ExpenseCategoryKind(rawValue: raw) { return kind }
        switch raw {
        case "Eating out", "Food delivery":
            return .food
        case "Groceries", "Houseware":
            return .groceries
        case "Rent":
            return .rent
        case "Telecommunications", "Services", "Digital services":
            return .utilities
        case "Parking", "Car rental", "Automotive", "Gas stations",
             "Vehicle maintenance", "Taxi and ride-hailing":
            return .transport
        case "Cinema, theater and concerts", "Tickets", "Shopping",
             "Clothing", "Gaming":
            return .entertainment
        case "Healthcare", "Dentist", "Pharmacy", "Optometry",
             "Gyms and fitness centers", "Wellness and fitness":
            return .health
        case "Other", "Transfers", "Credit card payment", "Bank fees",
             "Salary", "Investments":
            return .other
        default:
            return nil
        }
    }

    /// Maps any category identifier, label, or subcategory onto the official Level 1 base category key.
    public static func baseCategoryKey(for raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return nil }

        if defaults.contains(where: { $0.key.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            return defaults.first(where: { $0.key.caseInsensitiveCompare(trimmed) == .orderedSame })?.key
        }
        if let match = defaults.first(where: { $0.label.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            return match.key
        }

        switch trimmed.lowercased() {
        case "food and drinks", "comida e bebidas", "food", "alimentação",
             "eating out", "restaurantes", "restaurantes e bares", "food delivery", "delivery", "delivery de comida":
            return "Food and drinks"

        case "groceries", "supermercado", "supermercados":
            return "Groceries"

        case "housing", "habitação", "rent", "aluguel", "aluguel / habitação",
             "houseware", "casa", "utilidades domésticas", "urban land and building tax", "iptu",
             "utilities", "contas de consumo (água, luz)", "water", "água", "electricity", "energia elétrica", "gas", "gás":
            return "Housing"

        case "transportation", "transporte", "transport",
             "taxi and ride-hailing", "uber / táxi", "táxi e carros de aplicativo",
             "parking", "estacionamento", "car rental", "aluguel de carros",
             "bicycle", "bicicleta", "public transportation", "transporte público",
             "automotive", "automóvel", "gas stations", "combustível", "postos de combustível",
             "vehicle maintenance", "manutenção", "manutenção veicular",
             "tolls and in-vehicle payment", "pedágios", "vehicle ownership taxes and fees", "ipva e taxas de veículo",
             "traffic tickets", "multas de trânsito":
            return "Transportation"

        case "services", "serviços", "telecommunications", "telefone & internet", "telecomunicações",
             "internet", "mobile", "celular / telefonia", "tv", "tv por assinatura",
             "gyms and fitness centers", "academia", "academias e fitness",
             "wellness and fitness", "bem-estar e fitness", "wellness", "bem-estar", "sports practice", "prática de esportes":
            return "Services"

        case "shopping", "compras", "clothing", "vestuário", "vestuário e roupas",
             "online shopping", "compras online", "electronics", "eletrônicos",
             "pet supplies and vet", "pets e veterinário", "kids and toys", "crianças e brinquedos",
             "bookstore", "livraria", "sports goods", "artigos esportivos",
             "office supplies", "materiais de escritório", "cashback":
            return "Shopping"

        case "healthcare", "saúde", "health",
             "dentist", "odontologia", "farmácia", "pharmacy", "optometry", "ótica",
             "hospital clinics and labs", "hospitais e laboratórios":
            return "Healthcare"

        case "education", "educação", "online courses", "cursos online",
             "university", "universidade", "school", "escola", "kindergarten", "jardim de infância":
            return "Education"

        case "leisure", "lazer", "lazer / entretenimento", "entertainment",
             "cinema, theater and concerts", "cinema & shows", "cinema, teatro e shows",
             "tickets", "ingressos", "stadiums and arenas", "estádios e arenas",
             "landmarks and museums", "monumentos e museus":
            return "Leisure"

        case "digital services", "serviços digitais", "gaming", "games", "jogos",
             "video streaming", "streaming de vídeo", "music streaming", "streaming de música":
            return "Digital services"

        case "travel", "viagens", "airport and airlines", "aeroporto e passagens aéreas",
             "accommodation", "hospedagem", "mileage programs", "programas de milhas",
             "bus tickets", "passagens de ônibus":
            return "Travel"

        case "income", "renda", "salary", "salário", "retirement", "aposentadoria",
             "entrepreneurial activities", "atividades empreendedoras",
             "government aid", "auxílio governamental", "non-recurring income", "renda não recorrente":
            return "Income"

        case "investments", "investimentos", "automatic investment", "investimento automático",
             "fixed income", "renda fixa", "mutual funds", "fundos mútuos",
             "variable income", "renda variável", "margin", "margem",
             "proceeds interests and dividends", "juros e dividendos", "pension", "pensão":
            return "Investments"

        case "transfers", "transferências", "credit card payment", "pagamento de fatura",
             "transfer - bank slip (boleto)", "transferência - boleto",
             "transfer - cash", "transferência - dinheiro",
             "transfer - check", "transferência - cheque",
             "transfer - doc", "transferência - doc",
             "transfer - foreign exchange", "transferência - câmbio",
             "transfer - internal", "transferência - interna",
             "transfer - pix", "transferência - pix",
             "transfer - ted", "transferência - ted",
             "third-party transfers", "transferências de terceiros":
            return "Transfers"

        case "same person transfer", "transferência entre mesma pessoa",
             "same person transfer - cash", "same person transfer - pix", "same person transfer - ted":
            return "Same person transfer"

        case "loans and financing", "empréstimos e financiamentos", "loans", "empréstimos",
             "financing", "financiamento", "real estate financing", "financiamento imobiliário",
             "vehicle financing", "financiamento de veículos", "student loan", "empréstimo estudantil",
             "late payment and overdraft costs", "custos de atraso e cheque especial",
             "interests charged", "juros cobrados":
            return "Loans and Financing"

        case "bank fees", "taxas bancárias", "tarifas", "account fees", "tarifas de conta",
             "wire transfer fees and atm fees", "tarifas de transferência e saques",
             "credit card fees", "tarifas de cartão":
            return "Bank fees"

        case "taxes", "impostos", "income taxes", "impostos sobre renda",
             "taxes on investments", "impostos sobre investimentos",
             "tax on financial operations", "iof":
            return "Taxes"

        case "insurance", "seguro", "life insurance", "seguro de vida",
             "home insurance", "seguro residencial", "health insurance", "seguro de saúde",
             "vehicle insurance", "seguro de veículos":
            return "Insurance"

        case "donations", "doações":
            return "Donations"

        case "gambling", "jogos de azar", "lottery", "loteria", "online bet", "aposta online":
            return "Gambling"

        case "legal obligations", "obrigações legais", "blocked balances", "saldos bloqueados", "alimony", "pensão alimentícia":
            return "Legal obligations"

        case "other", "outros":
            return "Other"

        default:
            return nil
        }
    }

    public static func slugify(_ label: String, existingKeys: [String]) -> String {
        let folded = label.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
        let scalars = folded.unicodeScalars.map { CharacterSet.alphanumerics.contains($0) ? Character($0) : " " }
        let words = String(scalars)
            .split(whereSeparator: \.isWhitespace)
            .map { word -> String in
                let value = String(word)
                guard let first = value.first else { return "" }
                return String(first).uppercased() + value.dropFirst().lowercased()
            }
            .filter { !$0.isEmpty }
        var base = words.joined()
        if base.isEmpty { base = "Category" }
        if base.first?.isNumber == true { base = "Cat" + base }
        let used = Set(existingKeys.map { $0.lowercased() })
        if !used.contains(base.lowercased()) { return base }
        var index = 2
        while used.contains("\(base)\(index)".lowercased()) {
            index += 1
        }
        return "\(base)\(index)"
    }
}
