import Foundation

public enum BudgetPeriod: String, Sendable, Codable, Hashable, CaseIterable, Identifiable {
    case daily
    case weekly
    case biweekly
    case monthly

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .daily: return "Diária"
        case .weekly: return "Semanal"
        case .biweekly: return "Quinzenal"
        case .monthly: return "Mensal"
        }
    }

    public var unitLabel: String {
        switch self {
        case .daily: return "/dia"
        case .weekly: return "/semana"
        case .biweekly: return "/quinzena"
        case .monthly: return "/mês"
        }
    }

    public func progressLabel(index: Int, count: Int) -> String {
        switch self {
        case .daily: return "\(index) de \(count) dias"
        case .weekly: return "semana \(index) de \(count)"
        case .biweekly: return "quinzena \(index) de \(count)"
        case .monthly: return "mês"
        }
    }
}

public enum BudgetCategoryCatalog {
    public static let labels: [String] = [
        "Supermercado & Alimentação",
        "Restaurantes & Bares",
        "Delivery de Comida",
        "Cinema, Teatro & Shows",
        "Compras & Lojas",
        "Serviços",
        "Serviços Digitais",
        "Telefone & Internet",
        "Postos de Combustível",
        "Uber / Táxi / Transporte",
        "Saúde & Medicina",
        "Farmácia & Drogaria",
        "Academias & Fitness",
        "Aluguel",
        "Vestuário & Roupas",
        "Games & Entretenimento",
        "Outros",
    ]
}
