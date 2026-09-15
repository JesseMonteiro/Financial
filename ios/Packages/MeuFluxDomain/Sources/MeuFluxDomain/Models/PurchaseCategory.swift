import Foundation

public struct PurchaseCategory: Sendable, Identifiable, Hashable, Codable {
    public let id: String
    public var key: String
    public var label: String
    public var color: String?
    public var sortOrder: Int

    public init(
        id: String,
        key: String,
        label: String,
        color: String? = nil,
        sortOrder: Int = 0
    ) {
        self.id = id
        self.key = key
        self.label = label
        self.color = color
        self.sortOrder = sortOrder
    }
}

public enum PurchaseCategoryCatalog {
    public static let defaults: [PurchaseCategory] = [
        PurchaseCategory(id: "default-Food", key: "Food", label: "Alimentação", color: "#f97316", sortOrder: 0),
        PurchaseCategory(id: "default-Groceries", key: "Groceries", label: "Supermercado", color: "#fb923c", sortOrder: 1),
        PurchaseCategory(id: "default-Rent", key: "Rent", label: "Aluguel / Habitação", color: "#a855f7", sortOrder: 2),
        PurchaseCategory(id: "default-Utilities", key: "Utilities", label: "Contas de Consumo (Água, Luz)", color: "#c084fc", sortOrder: 3),
        PurchaseCategory(id: "default-Transport", key: "Transport", label: "Transporte", color: "#0ea5e9", sortOrder: 4),
        PurchaseCategory(id: "default-Entertainment", key: "Entertainment", label: "Lazer / Entretenimento", color: "#ec4899", sortOrder: 5),
        PurchaseCategory(id: "default-Health", key: "Health", label: "Saúde", color: "#10b981", sortOrder: 6),
        PurchaseCategory(id: "default-Education", key: "Education", label: "Educação", color: "#eab308", sortOrder: 7),
        PurchaseCategory(id: "default-Other", key: "Other", label: "Outros", color: "#64748b", sortOrder: 8),
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
        guard let raw else { return nil }
        return categories.first(where: { $0.key == raw })?.color
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
