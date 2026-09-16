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
        PurchaseCategory(id: "default-Food", key: "Food", label: "Alimentação", color: "#f97316", icon: "utensils", sortOrder: 0),
        PurchaseCategory(id: "default-Groceries", key: "Groceries", label: "Supermercado", color: "#fb923c", icon: "cart", sortOrder: 1),
        PurchaseCategory(id: "default-Rent", key: "Rent", label: "Aluguel / Habitação", color: "#a855f7", icon: "home", sortOrder: 2),
        PurchaseCategory(id: "default-Utilities", key: "Utilities", label: "Contas de Consumo (Água, Luz)", color: "#c084fc", icon: "bolt", sortOrder: 3),
        PurchaseCategory(id: "default-Transport", key: "Transport", label: "Transporte", color: "#0ea5e9", icon: "car", sortOrder: 4),
        PurchaseCategory(id: "default-Entertainment", key: "Entertainment", label: "Lazer / Entretenimento", color: "#ec4899", icon: "ticket", sortOrder: 5),
        PurchaseCategory(id: "default-Health", key: "Health", label: "Saúde", color: "#10b981", icon: "crosscase", sortOrder: 6),
        PurchaseCategory(id: "default-Education", key: "Education", label: "Educação", color: "#eab308", icon: "graduationcap", sortOrder: 7),
        PurchaseCategory(id: "default-Other", key: "Other", label: "Outros", color: "#64748b", icon: "ellipsis", sortOrder: 8),
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
