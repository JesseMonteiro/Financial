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
    
    /// Categories that should be excluded from budget by default (transfers, income, etc.)
    public static let excludedCategories: Set<String> = [
        "Transferências",
        "Pagamento de Fatura",
        "Tarifas Bancárias",
        "Salário & Renda",
        "Investimentos",
        // Pluggy categories in English (before translation)
        "Transfers",
        "Credit card payment",
        "Bank fees",
        "Salary",
        "Investments",
        "Cashback",
        "cashback",
        "CASHBACK",
    ]

    /// Raw Pluggy category -> PT-BR label. Keep in sync with src/utils/categories.js
    /// and supabase/.../utils/dashboardAnalytics.ts (CATEGORY_TRANSLATIONS).
    private static let categoryTranslations: [String: String] = [
        "Groceries": "Supermercado & Alimentação",
        "Eating out": "Restaurantes & Bares",
        "Food delivery": "Delivery de Comida",
        "Cinema, theater and concerts": "Cinema, Teatro & Shows",
        "Parking": "Estacionamento",
        "Shopping": "Compras & Lojas",
        "Services": "Serviços",
        "Tickets": "Ingressos & Eventos",
        "Digital services": "Serviços Digitais",
        "Telecommunications": "Telefone & Internet",
        "Car rental": "Aluguel de Carros",
        "Automotive": "Automóvel",
        "Gas stations": "Postos de Combustível",
        "Vehicle maintenance": "Manutenção Veicular",
        "Taxi and ride-hailing": "Uber / Táxi / Transporte",
        "Healthcare": "Saúde & Medicina",
        "Dentist": "Odontologia",
        "Pharmacy": "Farmácia & Drogaria",
        "Optometry": "Ótica & Visão",
        "Gyms and fitness centers": "Academias & Fitness",
        "Wellness and fitness": "Bem-estar & Fitness",
        "Houseware": "Utilidades Domésticas",
        "Rent": "Aluguel",
        "Clothing": "Vestuário & Roupas",
        "Gaming": "Games & Entretenimento",
        "Transfers": "Transferências",
        "Credit card payment": "Pagamento de Fatura",
        "Bank fees": "Tarifas Bancárias",
        "Salary": "Salário & Renda",
        "Investments": "Investimentos",
        "Other": "Outros",
    ]

    /// Translate a raw Pluggy category into its PT-BR budget label, passing through
    /// already-translated or unknown categories unchanged (parity with web `translateCategory`).
    public static func translateCategory(_ category: String?) -> String {
        guard let category, !category.isEmpty else { return "Geral" }
        return categoryTranslations[category] ?? category
    }
}
