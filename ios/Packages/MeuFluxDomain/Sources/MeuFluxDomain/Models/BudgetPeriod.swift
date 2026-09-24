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

    /// Represents an individual category or subcategory option for budgeting.
    public struct CategoryOptionItem: Sendable, Identifiable, Hashable {
        public var id: String { key }
        public let key: String
        public let label: String
        public let icon: String
        public let isSubcategory: Bool
        public let parentKey: String?
        public let parentLabel: String?

        public init(
            key: String,
            label: String,
            icon: String = "ellipsis",
            isSubcategory: Bool = false,
            parentKey: String? = nil,
            parentLabel: String? = nil
        ) {
            self.key = key
            self.label = label
            self.icon = icon
            self.isSubcategory = isSubcategory
            self.parentKey = parentKey
            self.parentLabel = parentLabel
        }
    }

    /// Represents a Level 1 Category and all its Level 2/3 subcategories.
    public struct CategoryHierarchyGroup: Sendable, Identifiable, Hashable {
        public var id: String { parent.key }
        public let parent: CategoryOptionItem
        public let subcategories: [CategoryOptionItem]

        public init(parent: CategoryOptionItem, subcategories: [CategoryOptionItem]) {
            self.parent = parent
            self.subcategories = subcategories
        }
    }

    /// Complete mapping of Subcategory Key -> Parent Level 1 Base Category Key.
    public static let subCategoryToParent: [String: String] = [
        // Food and drinks (Alimentação)
        "Groceries": "Food and drinks",
        "Eating out": "Food and drinks",
        "Food delivery": "Food and drinks",
        // Housing (Habitação)
        "Rent": "Housing",
        "Utilities": "Housing",
        "Electricity": "Housing",
        "Water": "Housing",
        "Gas": "Housing",
        "Houseware": "Housing",
        "Urban land and building tax": "Housing",
        // Transportation (Transporte)
        "Taxi and ride-hailing": "Transportation",
        "Gas stations": "Transportation",
        "Parking": "Transportation",
        "Public transportation": "Transportation",
        "Vehicle maintenance": "Transportation",
        "Car rental": "Transportation",
        "Tolls and in-vehicle payment": "Transportation",
        "Vehicle ownership taxes and fees": "Transportation",
        "Traffic tickets": "Transportation",
        "Bicycle": "Transportation",
        // Services (Serviços)
        "Telecommunications": "Services",
        "Internet": "Services",
        "Mobile": "Services",
        "TV": "Services",
        "Gyms and fitness centers": "Services",
        "Wellness and fitness": "Services",
        "Sports practice": "Services",
        // Shopping (Compras)
        "Online shopping": "Shopping",
        "Clothing": "Shopping",
        "Electronics": "Shopping",
        "Pet supplies and vet": "Shopping",
        "Kids and toys": "Shopping",
        "Bookstore": "Shopping",
        "Sports goods": "Shopping",
        "Office Supplies": "Shopping",
        // Healthcare (Saúde)
        "Pharmacy": "Healthcare",
        "Hospital clinics and labs": "Healthcare",
        "Dentist": "Healthcare",
        "Optometry": "Healthcare",
        // Leisure (Lazer)
        "Cinema, theater and concerts": "Leisure",
        "Tickets": "Leisure",
        "Stadiums and arenas": "Leisure",
        "Landmarks and museums": "Leisure",
        // Digital services (Serviços Digitais)
        "Video streaming": "Digital services",
        "Music streaming": "Digital services",
        "Gaming": "Digital services",
        // Education (Educação)
        "Online Courses": "Education",
        "University": "Education",
        "School": "Education",
        "Kindergarten": "Education",
        // Travel (Viagens)
        "Airport and airlines": "Travel",
        "Accommodation": "Travel",
        "Bus tickets": "Travel",
        "Mileage programs": "Travel",
        // Insurance (Seguro)
        "Life insurance": "Insurance",
        "Home Insurance": "Insurance",
        "Health insurance": "Insurance",
        "Vehicle insurance": "Insurance",
        // Loans and Financing (Empréstimos e Financiamentos)
        "Loans": "Loans and Financing",
        "Financing": "Loans and Financing",
        "Real estate financing": "Loans and Financing",
        "Vehicle Financing": "Loans and Financing",
        "Student loan": "Loans and Financing",
        "Late payment and overdraft costs": "Loans and Financing",
        "Interests charged": "Loans and Financing",
        // Gambling (Jogos de Azar)
        "Lottery": "Gambling",
        "Online bet": "Gambling",
        // Legal obligations (Obrigações Legais)
        "Alimony": "Legal obligations",
        "Blocked balances": "Legal obligations",
    ]

    /// Hierarchical definition of categories with parent levels and subcategory children.
    public static let hierarchy: [CategoryHierarchyGroup] = [
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Food and drinks", label: "Alimentação", icon: "utensils"),
            subcategories: [
                CategoryOptionItem(key: "Groceries", label: "Supermercados", icon: "cart", isSubcategory: true, parentKey: "Food and drinks", parentLabel: "Alimentação"),
                CategoryOptionItem(key: "Eating out", label: "Restaurantes & Bares", icon: "wineglass", isSubcategory: true, parentKey: "Food and drinks", parentLabel: "Alimentação"),
                CategoryOptionItem(key: "Food delivery", label: "Delivery de Comida", icon: "takeout", isSubcategory: true, parentKey: "Food and drinks", parentLabel: "Alimentação"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Housing", label: "Habitação", icon: "home"),
            subcategories: [
                CategoryOptionItem(key: "Rent", label: "Aluguel", icon: "home", isSubcategory: true, parentKey: "Housing", parentLabel: "Habitação"),
                CategoryOptionItem(key: "Utilities", label: "Contas de consumo (Água, Luz, Gás)", icon: "bolt", isSubcategory: true, parentKey: "Housing", parentLabel: "Habitação"),
                CategoryOptionItem(key: "Electricity", label: "Energia elétrica", icon: "bolt", isSubcategory: true, parentKey: "Housing", parentLabel: "Habitação"),
                CategoryOptionItem(key: "Water", label: "Água", icon: "drop", isSubcategory: true, parentKey: "Housing", parentLabel: "Habitação"),
                CategoryOptionItem(key: "Gas", label: "Gás", icon: "flame", isSubcategory: true, parentKey: "Housing", parentLabel: "Habitação"),
                CategoryOptionItem(key: "Houseware", label: "Utilidades Domésticas", icon: "sofa", isSubcategory: true, parentKey: "Housing", parentLabel: "Habitação"),
                CategoryOptionItem(key: "Urban land and building tax", label: "IPTU", icon: "doc", isSubcategory: true, parentKey: "Housing", parentLabel: "Habitação"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Transportation", label: "Transporte", icon: "car"),
            subcategories: [
                CategoryOptionItem(key: "Taxi and ride-hailing", label: "Uber / Táxi / Transporte", icon: "car", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Gas stations", label: "Postos de Combustível", icon: "fuelpump", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Parking", label: "Estacionamento", icon: "car", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Public transportation", label: "Transporte Público", icon: "bus", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Vehicle maintenance", label: "Manutenção Veicular", icon: "wrench", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Car rental", label: "Aluguel de Carros", icon: "car", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Tolls and in-vehicle payment", label: "Pedágios", icon: "car", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Vehicle ownership taxes and fees", label: "IPVA e Taxas de Veículo", icon: "doc", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Traffic tickets", label: "Multas de Trânsito", icon: "doc", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
                CategoryOptionItem(key: "Bicycle", label: "Bicicleta", icon: "bicycle", isSubcategory: true, parentKey: "Transportation", parentLabel: "Transporte"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Services", label: "Serviços", icon: "wrench"),
            subcategories: [
                CategoryOptionItem(key: "Telecommunications", label: "Telefone & Internet", icon: "wifi", isSubcategory: true, parentKey: "Services", parentLabel: "Serviços"),
                CategoryOptionItem(key: "Internet", label: "Internet", icon: "wifi", isSubcategory: true, parentKey: "Services", parentLabel: "Serviços"),
                CategoryOptionItem(key: "Mobile", label: "Celular / Telefonia", icon: "phone", isSubcategory: true, parentKey: "Services", parentLabel: "Serviços"),
                CategoryOptionItem(key: "TV", label: "TV por Assinatura", icon: "tv", isSubcategory: true, parentKey: "Services", parentLabel: "Serviços"),
                CategoryOptionItem(key: "Gyms and fitness centers", label: "Academias & Fitness", icon: "figure", isSubcategory: true, parentKey: "Services", parentLabel: "Serviços"),
                CategoryOptionItem(key: "Wellness and fitness", label: "Bem-estar & Fitness", icon: "figure", isSubcategory: true, parentKey: "Services", parentLabel: "Serviços"),
                CategoryOptionItem(key: "Sports practice", label: "Prática de Esportes", icon: "figure", isSubcategory: true, parentKey: "Services", parentLabel: "Serviços"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Shopping", label: "Compras", icon: "bag"),
            subcategories: [
                CategoryOptionItem(key: "Online shopping", label: "Compras Online", icon: "cartbadge", isSubcategory: true, parentKey: "Shopping", parentLabel: "Compras"),
                CategoryOptionItem(key: "Clothing", label: "Vestuário & Roupas", icon: "tshirt", isSubcategory: true, parentKey: "Shopping", parentLabel: "Compras"),
                CategoryOptionItem(key: "Electronics", label: "Eletrônicos", icon: "tv", isSubcategory: true, parentKey: "Shopping", parentLabel: "Compras"),
                CategoryOptionItem(key: "Pet supplies and vet", label: "Pets & Veterinário", icon: "pawprint", isSubcategory: true, parentKey: "Shopping", parentLabel: "Compras"),
                CategoryOptionItem(key: "Kids and toys", label: "Crianças & Brinquedos", icon: "baby", isSubcategory: true, parentKey: "Shopping", parentLabel: "Compras"),
                CategoryOptionItem(key: "Bookstore", label: "Livraria", icon: "book", isSubcategory: true, parentKey: "Shopping", parentLabel: "Compras"),
                CategoryOptionItem(key: "Sports goods", label: "Artigos Esportivos", icon: "figure", isSubcategory: true, parentKey: "Shopping", parentLabel: "Compras"),
                CategoryOptionItem(key: "Office Supplies", label: "Materiais de Escritório", icon: "pencil", isSubcategory: true, parentKey: "Shopping", parentLabel: "Compras"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Healthcare", label: "Saúde", icon: "heart"),
            subcategories: [
                CategoryOptionItem(key: "Pharmacy", label: "Farmácia & Drogaria", icon: "crosscase", isSubcategory: true, parentKey: "Healthcare", parentLabel: "Saúde"),
                CategoryOptionItem(key: "Hospital clinics and labs", label: "Hospitais & Laboratórios", icon: "heart", isSubcategory: true, parentKey: "Healthcare", parentLabel: "Saúde"),
                CategoryOptionItem(key: "Dentist", label: "Odontologia", icon: "heart", isSubcategory: true, parentKey: "Healthcare", parentLabel: "Saúde"),
                CategoryOptionItem(key: "Optometry", label: "Ótica & Visão", icon: "heart", isSubcategory: true, parentKey: "Healthcare", parentLabel: "Saúde"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Leisure", label: "Lazer", icon: "ticket"),
            subcategories: [
                CategoryOptionItem(key: "Cinema, theater and concerts", label: "Cinema, Teatro & Shows", icon: "film", isSubcategory: true, parentKey: "Leisure", parentLabel: "Lazer"),
                CategoryOptionItem(key: "Tickets", label: "Ingressos & Eventos", icon: "ticket", isSubcategory: true, parentKey: "Leisure", parentLabel: "Lazer"),
                CategoryOptionItem(key: "Stadiums and arenas", label: "Estádios & Arenas", icon: "ticket", isSubcategory: true, parentKey: "Leisure", parentLabel: "Lazer"),
                CategoryOptionItem(key: "Landmarks and museums", label: "Monumentos & Museus", icon: "ticket", isSubcategory: true, parentKey: "Leisure", parentLabel: "Lazer"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Digital services", label: "Serviços Digitais", icon: "tv"),
            subcategories: [
                CategoryOptionItem(key: "Video streaming", label: "Streaming de Vídeo", icon: "tv", isSubcategory: true, parentKey: "Digital services", parentLabel: "Serviços Digitais"),
                CategoryOptionItem(key: "Music streaming", label: "Streaming de Música", icon: "music", isSubcategory: true, parentKey: "Digital services", parentLabel: "Serviços Digitais"),
                CategoryOptionItem(key: "Gaming", label: "Games & Entretenimento", icon: "gamecontroller", isSubcategory: true, parentKey: "Digital services", parentLabel: "Serviços Digitais"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Education", label: "Educação", icon: "graduationcap"),
            subcategories: [
                CategoryOptionItem(key: "Online Courses", label: "Cursos Online", icon: "graduationcap", isSubcategory: true, parentKey: "Education", parentLabel: "Educação"),
                CategoryOptionItem(key: "University", label: "Universidade", icon: "graduationcap", isSubcategory: true, parentKey: "Education", parentLabel: "Educação"),
                CategoryOptionItem(key: "School", label: "Escola", icon: "book", isSubcategory: true, parentKey: "Education", parentLabel: "Educação"),
                CategoryOptionItem(key: "Kindergarten", label: "Jardim de Infância", icon: "baby", isSubcategory: true, parentKey: "Education", parentLabel: "Educação"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Travel", label: "Viagens", icon: "airplane"),
            subcategories: [
                CategoryOptionItem(key: "Airport and airlines", label: "Aeroporto & Passagens Aéreas", icon: "airplane", isSubcategory: true, parentKey: "Travel", parentLabel: "Viagens"),
                CategoryOptionItem(key: "Accommodation", label: "Hospedagem", icon: "bed", isSubcategory: true, parentKey: "Travel", parentLabel: "Viagens"),
                CategoryOptionItem(key: "Bus tickets", label: "Passagens de Ônibus", icon: "bus", isSubcategory: true, parentKey: "Travel", parentLabel: "Viagens"),
                CategoryOptionItem(key: "Mileage programs", label: "Programas de Milhas", icon: "airplane", isSubcategory: true, parentKey: "Travel", parentLabel: "Viagens"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Insurance", label: "Seguro", icon: "shield"),
            subcategories: [
                CategoryOptionItem(key: "Life insurance", label: "Seguro de Vida", icon: "shield", isSubcategory: true, parentKey: "Insurance", parentLabel: "Seguro"),
                CategoryOptionItem(key: "Home Insurance", label: "Seguro Residencial", icon: "shield", isSubcategory: true, parentKey: "Insurance", parentLabel: "Seguro"),
                CategoryOptionItem(key: "Health insurance", label: "Seguro de Saúde", icon: "shield", isSubcategory: true, parentKey: "Insurance", parentLabel: "Seguro"),
                CategoryOptionItem(key: "Vehicle insurance", label: "Seguro de Veículos", icon: "shield", isSubcategory: true, parentKey: "Insurance", parentLabel: "Seguro"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Loans and Financing", label: "Empréstimos e Financiamentos", icon: "percent"),
            subcategories: [
                CategoryOptionItem(key: "Loans", label: "Empréstimos", icon: "percent", isSubcategory: true, parentKey: "Loans and Financing", parentLabel: "Empréstimos e Financiamentos"),
                CategoryOptionItem(key: "Financing", label: "Financiamento", icon: "percent", isSubcategory: true, parentKey: "Loans and Financing", parentLabel: "Empréstimos e Financiamentos"),
                CategoryOptionItem(key: "Real estate financing", label: "Financiamento Imobiliário", icon: "percent", isSubcategory: true, parentKey: "Loans and Financing", parentLabel: "Empréstimos e Financiamentos"),
                CategoryOptionItem(key: "Vehicle Financing", label: "Financiamento de Veículos", icon: "percent", isSubcategory: true, parentKey: "Loans and Financing", parentLabel: "Empréstimos e Financiamentos"),
                CategoryOptionItem(key: "Student loan", label: "Empréstimo Estudantil", icon: "percent", isSubcategory: true, parentKey: "Loans and Financing", parentLabel: "Empréstimos e Financiamentos"),
                CategoryOptionItem(key: "Late payment and overdraft costs", label: "Custos de Atraso & Cheque Especial", icon: "percent", isSubcategory: true, parentKey: "Loans and Financing", parentLabel: "Empréstimos e Financiamentos"),
                CategoryOptionItem(key: "Interests charged", label: "Juros Cobrados", icon: "percent", isSubcategory: true, parentKey: "Loans and Financing", parentLabel: "Empréstimos e Financiamentos"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Donations", label: "Doações", icon: "handraised"),
            subcategories: []
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Gambling", label: "Jogos de Azar", icon: "sparkles"),
            subcategories: [
                CategoryOptionItem(key: "Lottery", label: "Loteria", icon: "sparkles", isSubcategory: true, parentKey: "Gambling", parentLabel: "Jogos de Azar"),
                CategoryOptionItem(key: "Online bet", label: "Aposta Online", icon: "sparkles", isSubcategory: true, parentKey: "Gambling", parentLabel: "Jogos de Azar"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Legal obligations", label: "Obrigações Legais", icon: "doc"),
            subcategories: [
                CategoryOptionItem(key: "Alimony", label: "Pensão Alimentícia", icon: "doc", isSubcategory: true, parentKey: "Legal obligations", parentLabel: "Obrigações Legais"),
                CategoryOptionItem(key: "Blocked balances", label: "Saldos Bloqueados", icon: "doc", isSubcategory: true, parentKey: "Legal obligations", parentLabel: "Obrigações Legais"),
            ]
        ),
        CategoryHierarchyGroup(
            parent: CategoryOptionItem(key: "Other", label: "Outros", icon: "ellipsis"),
            subcategories: []
        ),
    ]

    /// Raw Pluggy category -> PT-BR label. Keep in sync with src/utils/categories.js
    /// and supabase/.../utils/dashboardAnalytics.ts (CATEGORY_TRANSLATIONS).
    private static let categoryTranslations: [String: String] = [
        "Groceries": "Supermercados",
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
        "Utilities": "Contas de consumo (Água, Luz, Gás)",
        "Water": "Água",
        "Electricity": "Energia elétrica",
        "Gas": "Gás",
        "Urban land and building tax": "IPTU",
        "Public transportation": "Transporte Público",
        "Bicycle": "Bicicleta",
        "Tolls and in-vehicle payment": "Pedágios",
        "Vehicle ownership taxes and fees": "IPVA e Taxas de Veículo",
        "Traffic tickets": "Multas de Trânsito",
        "Internet": "Internet",
        "Mobile": "Celular / Telefonia",
        "TV": "TV por Assinatura",
        "Sports practice": "Prática de Esportes",
        "Online shopping": "Compras Online",
        "Electronics": "Eletrônicos",
        "Pet supplies and vet": "Pets & Veterinário",
        "Kids and toys": "Crianças & Brinquedos",
        "Bookstore": "Livraria",
        "Sports goods": "Artigos Esportivos",
        "Office Supplies": "Materiais de Escritório",
        "Hospital clinics and labs": "Hospitais & Laboratórios",
        "Stadiums and arenas": "Estádios & Arenas",
        "Landmarks and museums": "Monumentos & Museus",
        "Video streaming": "Streaming de Vídeo",
        "Music streaming": "Streaming de Música",
        "Online Courses": "Cursos Online",
        "University": "Universidade",
        "School": "Escola",
        "Kindergarten": "Jardim de Infância",
        "Airport and airlines": "Aeroporto & Passagens Aéreas",
        "Accommodation": "Hospedagem",
        "Bus tickets": "Passagens de Ônibus",
        "Mileage programs": "Programas de Milhas",
        "Life insurance": "Seguro de Vida",
        "Home Insurance": "Seguro Residencial",
        "Health insurance": "Seguro de Saúde",
        "Vehicle insurance": "Seguro de Veículos",
        "Loans": "Empréstimos",
        "Financing": "Financiamento",
        "Real estate financing": "Financiamento Imobiliário",
        "Vehicle Financing": "Financiamento de Veículos",
        "Student loan": "Empréstimo Estudantil",
        "Late payment and overdraft costs": "Custos de Atraso & Cheque Especial",
        "Interests charged": "Juros Cobrados",
        "Lottery": "Loteria",
        "Online bet": "Aposta Online",
        "Alimony": "Pensão Alimentícia",
        "Blocked balances": "Saldos Bloqueados",
    ]

    /// Translate a raw Pluggy category into its PT-BR budget label, passing through
    /// already-translated or unknown categories unchanged (parity with web `translateCategory`).
    public static func translateCategory(_ category: String?) -> String {
        guard let category, !category.isEmpty else { return "Geral" }
        return categoryTranslations[category] ?? category
    }

    /// Resolves any category string (Pluggy subcategory, PT-BR translation, or base key)
    /// to its Level 1 base category key.
    public static func resolveBudgetCategoryKey(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "Other" }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Other" }
        if PurchaseCategoryCatalog.defaults.contains(where: { $0.key.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            return PurchaseCategoryCatalog.defaults.first(where: { $0.key.caseInsensitiveCompare(trimmed) == .orderedSame })?.key ?? trimmed
        }
        if let base = PurchaseCategoryCatalog.baseCategoryKey(for: trimmed) {
            return base
        }
        return trimmed
    }

    /// User-facing label for a base category key.
    public static func label(forBaseKey key: String) -> String {
        PurchaseCategoryCatalog.defaults.first(where: { $0.key == key })?.label ?? key
    }

    /// Canonical identifier for a budget target (preserves subcategories rather than collapsing them to parent base keys).
    public static func canonicalBudgetCategoryKey(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "Other" }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Other" }

        // Check if it's already a known subcategory key
        if subCategoryToParent.keys.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            return subCategoryToParent.keys.first(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) ?? trimmed
        }

        // Check if it's a translated subcategory label
        for (subKey, transLabel) in categoryTranslations {
            if transLabel.caseInsensitiveCompare(trimmed) == .orderedSame && subCategoryToParent[subKey] != nil {
                return subKey
            }
        }

        // Check in hierarchy items directly
        for group in hierarchy {
            for sub in group.subcategories {
                if sub.key.caseInsensitiveCompare(trimmed) == .orderedSame || sub.label.caseInsensitiveCompare(trimmed) == .orderedSame {
                    return sub.key
                }
            }
        }

        // If it's a base category, resolve to base key
        return resolveBudgetCategoryKey(trimmed)
    }

    /// Returns true if this category is a Level 2/3 subcategory.
    public static func isSubcategory(_ keyOrLabel: String?) -> Bool {
        guard let keyOrLabel, !keyOrLabel.isEmpty else { return false }
        let canonical = canonicalBudgetCategoryKey(keyOrLabel)
        return subCategoryToParent[canonical] != nil
    }

    /// Returns the Level 1 Parent Category Key for a subcategory (e.g. "Groceries" -> "Food and drinks").
    public static func parentBaseKey(forSubcategory keyOrLabel: String?) -> String? {
        guard let keyOrLabel, !keyOrLabel.isEmpty else { return nil }
        let canonical = canonicalBudgetCategoryKey(keyOrLabel)
        return subCategoryToParent[canonical]
    }

    /// Returns the Level 1 Parent Category Label for a subcategory (e.g. "Groceries" -> "Alimentação").
    public static func parentLabel(forSubcategory keyOrLabel: String?) -> String? {
        guard let parentKey = parentBaseKey(forSubcategory: keyOrLabel) else { return nil }
        return label(forBaseKey: parentKey)
    }

    /// Returns the user-facing label for any budget category (base or subcategory).
    public static func label(forCategory keyOrLabel: String?) -> String {
        guard let keyOrLabel, !keyOrLabel.isEmpty else { return "Geral" }
        let canonical = canonicalBudgetCategoryKey(keyOrLabel)

        if let translated = categoryTranslations[canonical] {
            return translated
        }
        for group in hierarchy {
            if group.parent.key.caseInsensitiveCompare(canonical) == .orderedSame {
                return group.parent.label
            }
            for sub in group.subcategories {
                if sub.key.caseInsensitiveCompare(canonical) == .orderedSame {
                    return sub.label
                }
            }
        }
        return label(forBaseKey: canonical)
    }

    /// Checks whether a transaction belongs to a given budget category (handles both base categories and subcategories).
    public static func matches(transactionCategory: String?, forBudgetCategory budgetCat: String) -> Bool {
        guard let transactionCategory, !transactionCategory.isEmpty else { return false }
        let trimmedTx = transactionCategory.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBudget = budgetCat.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedTx.isEmpty || trimmedBudget.isEmpty { return false }

        let canonicalBudget = canonicalBudgetCategoryKey(trimmedBudget)
        let isSub = isSubcategory(canonicalBudget)

        if isSub {
            // Specific subcategory budget: ONLY matches transactions matching this exact subcategory
            let canonicalTx = canonicalBudgetCategoryKey(trimmedTx)
            if canonicalTx.caseInsensitiveCompare(canonicalBudget) == .orderedSame { return true }

            let txLabel = translateCategory(trimmedTx).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let budgetLabel = label(forCategory: canonicalBudget).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if txLabel == budgetLabel { return true }

            // Common aliases
            if canonicalBudget == "Groceries" {
                let lower = trimmedTx.lowercased()
                if lower.contains("supermercado") || lower.contains("groceries") || lower.contains("mercado") {
                    return true
                }
            }
            if canonicalBudget == "Eating out" {
                let lower = trimmedTx.lowercased()
                if lower.contains("restaurante") || lower.contains("eating out") || lower.contains("bar") {
                    return true
                }
            }
            if canonicalBudget == "Food delivery" {
                let lower = trimmedTx.lowercased()
                if lower.contains("delivery") || lower.contains("ifood") || lower.contains("rappi") {
                    return true
                }
            }
            return false
        } else {
            // Base category budget: matches all transactions belonging to this base category
            let txBase = resolveBudgetCategoryKey(trimmedTx)
            let budgetBase = resolveBudgetCategoryKey(trimmedBudget)
            if txBase.caseInsensitiveCompare(budgetBase) == .orderedSame { return true }

            // If budget is "Food and drinks", also match Groceries
            if budgetBase.caseInsensitiveCompare("Food and drinks") == .orderedSame {
                let subParent = parentBaseKey(forSubcategory: trimmedTx)
                if subParent?.caseInsensitiveCompare("Food and drinks") == .orderedSame {
                    return true
                }
            }
            return false
        }
    }
}

