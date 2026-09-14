import Foundation

/// Mirrors web `navItems.js` destinations.
public enum AppRoute: String, CaseIterable, Identifiable, Hashable, Sendable {
    case dashboard
    case accounts
    case transactions
    case investments
    case creditCards
    case loans
    case budget
    case receivables
    case financialMoment
    case jointFinance
    case manualExpenses
    case subscriptions
    case agenda
    case goals
    case mealVouchers
    case reports
    case bankConnections
    case settings
    case more

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .dashboard: return "Visão Geral"
        case .accounts: return "Contas & Saldos"
        case .transactions: return "Transações"
        case .investments: return "Investimentos"
        case .creditCards: return "Cartões de Crédito"
        case .loans: return "Empréstimos"
        case .budget: return "Orçamento"
        case .receivables: return "Valores a Receber"
        case .financialMoment: return "Momento Financeiro"
        case .jointFinance: return "Conta conjunta"
        case .manualExpenses: return "Despesas Manuais"
        case .subscriptions: return "Assinaturas"
        case .agenda: return "Agenda"
        case .goals: return "Metas"
        case .mealVouchers: return "VA / VR"
        case .reports: return "Relatórios"
        case .bankConnections: return "Conexões Bancárias"
        case .settings: return "Configurações"
        case .more: return "Mais"
        }
    }

    public var shortTitle: String {
        switch self {
        case .dashboard: return "Início"
        case .accounts: return "Contas"
        case .transactions: return "Transações"
        case .investments: return "Investir"
        case .creditCards: return "Cartões"
        case .loans: return "Empréstimos"
        case .budget: return "Orçamento"
        case .receivables: return "Receber"
        case .financialMoment: return "Momento"
        case .jointFinance: return "Conjunta"
        case .manualExpenses: return "Despesas"
        case .subscriptions: return "Assinaturas"
        case .agenda: return "Agenda"
        case .goals: return "Metas"
        case .mealVouchers: return "VA/VR"
        case .reports: return "Relatórios"
        case .bankConnections: return "Conectar"
        case .settings: return "Ajustes"
        case .more: return "Mais"
        }
    }

    public var systemImage: String {
        switch self {
        case .dashboard: return "square.grid.2x2"
        case .accounts: return "wallet.pass"
        case .transactions: return "arrow.left.arrow.right"
        case .investments: return "chart.line.uptrend.xyaxis"
        case .creditCards: return "creditcard"
        case .loans: return "building.columns"
        case .budget: return "chart.pie"
        case .receivables: return "hand.raised"
        case .financialMoment: return "waveform.path.ecg"
        case .jointFinance: return "person.2"
        case .manualExpenses: return "plus.circle"
        case .subscriptions: return "arrow.triangle.2.circlepath"
        case .agenda: return "calendar"
        case .goals: return "target"
        case .mealVouchers: return "fork.knife"
        case .reports: return "chart.bar.xaxis"
        case .bankConnections: return "link"
        case .settings: return "gearshape"
        case .more: return "ellipsis.circle"
        }
    }

    /// Primary iPhone tabs (matches web `getMobileTabPaths`).
    /// Order: Início · Cartões · Momento · Conta conjunta|Despesas · (+ Mais in the shell).
    public static func primaryTabs(hasJointLink: Bool) -> [AppRoute] {
        [
            .dashboard,
            .creditCards,
            .financialMoment,
            hasJointLink ? .jointFinance : .manualExpenses,
        ]
    }

    public static let sidebarItems: [AppRoute] = [
        .dashboard, .accounts, .transactions, .investments, .creditCards,
        .loans, .budget, .receivables, .financialMoment, .jointFinance,
        .manualExpenses, .subscriptions, .agenda, .goals, .mealVouchers, .reports,
        .bankConnections, .settings
    ]

    public static func sidebarItems(hasJointLink: Bool) -> [AppRoute] {
        sidebarItems.filter { route in
            route != .jointFinance || hasJointLink
        }
    }

    public static func fromDeepLink(_ url: URL) -> AppRoute? {
        let path: String
        if url.scheme == "financehub" {
            path = (url.host ?? url.path).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        } else {
            path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        }
        switch path {
        case "", "dashboard": return .dashboard
        case "accounts": return .accounts
        case "transactions": return .transactions
        case "investments": return .investments
        case "credit-cards": return .creditCards
        case "loans": return .loans
        case "budget": return .budget
        case "receivables": return .receivables
        case "financial-moment": return .financialMoment
        case "joint-account": return .jointFinance
        case "manual-expenses": return .manualExpenses
        case "subscriptions": return .subscriptions
        case "agenda", "calendar": return .agenda
        case "goals": return .goals
        case "meal-vouchers": return .mealVouchers
        case "reports": return .reports
        case "connect": return .bankConnections
        case "settings": return .settings
        default: return nil
        }
    }
}
