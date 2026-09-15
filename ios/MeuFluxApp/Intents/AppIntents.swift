import AppIntents
import Foundation
import MeuFluxCore
import MeuFluxData
import MeuFluxDomain

public struct OpenDashboardIntent: AppIntent {
    public static let title: LocalizedStringResource = "Abrir Visão Geral"
    public static let description = IntentDescription("Abre a tela inicial do MeuFlux.")
    public static let supportedModes: IntentModes = [.foreground(.immediate)]

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        IntentRuntime.shared.open(.dashboard)
        return .result()
    }
}

public struct OpenCreditCardsIntent: AppIntent {
    public static let title: LocalizedStringResource = "Abrir Cartões"
    public static let description = IntentDescription("Abre faturas e cartões de crédito.")
    public static let supportedModes: IntentModes = [.foreground(.immediate)]

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        IntentRuntime.shared.open(.creditCards)
        return .result()
    }
}

public struct SyncBanksIntent: AppIntent {
    public static let title: LocalizedStringResource = "Sincronizar bancos"
    public static let description = IntentDescription("Dispara sincronização das conexões bancárias.")
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let message = await IntentRuntime.shared.syncAllBanks()
        return .result(dialog: IntentDialog("\(message)"))
    }
}

struct ImportPurchaseFromNotificationIntent: AppIntent {
    static let title: LocalizedStringResource = "Importar compra da notificação"
    static let description = IntentDescription(
        "Lê o texto de uma notificação de compra e lança no VA/VR ou em uma conta manual."
    )
    static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]

    @Parameter(title: "Título", default: "")
    var title: String

    @Parameter(title: "Subtítulo", default: "")
    var subtitle: String

    @Parameter(title: "Corpo", default: "")
    var body: String

    @Parameter(title: "App de origem", default: "")
    var sourceApp: String

    init() {
        self.title = ""
        self.subtitle = ""
        self.body = ""
        self.sourceApp = ""
    }

    init(title: String, subtitle: String, body: String, sourceApp: String) {
        self.title = title
        self.subtitle = subtitle
        self.body = body
        self.sourceApp = sourceApp
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let service = await NotificationImportRuntime.shared.resolve()
        let outcome = await service.importFromNotification(
            title: title,
            subtitle: subtitle,
            body: body,
            sourceApp: sourceApp.isEmpty ? title : sourceApp,
            now: Date()
        )
        await ImportLocalNotifications.post(outcome: outcome)
        return .result(dialog: IntentDialog("\(outcome.dialogText)"))
    }
}

enum ExpenseCategoryAppEnum: String, AppEnum {
    case food
    case groceries
    case rent
    case utilities
    case transport
    case entertainment
    case health
    case education
    case other

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Categoria")

    static let caseDisplayRepresentations: [ExpenseCategoryAppEnum: DisplayRepresentation] = [
        .food: "Alimentação",
        .groceries: "Supermercado",
        .rent: "Aluguel / Habitação",
        .utilities: "Contas de Consumo",
        .transport: "Transporte",
        .entertainment: "Lazer",
        .health: "Saúde",
        .education: "Educação",
        .other: "Outros",
    ]

    var domain: ExpenseCategoryKind {
        switch self {
        case .food: return .food
        case .groceries: return .groceries
        case .rent: return .rent
        case .utilities: return .utilities
        case .transport: return .transport
        case .entertainment: return .entertainment
        case .health: return .health
        case .education: return .education
        case .other: return .other
        }
    }
}

/// App Intents metadata extraction only sees compile-time literals on the intent type.
/// Computed helpers like `SiriQuerySupport.modes` are ignored, so Siri treats the
/// intent as background-only and answers “não permite fazer isso com a Siri”.
public struct GetWeeklySpendIntent: AppIntent {
    public static let title: LocalizedStringResource = "Gastos da semana"
    public static let description = IntentDescription(
        "Informa quanto você gastou nos últimos 7 dias.",
        categoryName: "Finanças",
        searchKeywords: ["gastos", "semana", "recap"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        var text = "Nos últimos 7 dias você gastou \(snapshot.weeklySpendLabel)."
        let sign = snapshot.weeklyDeltaPct > 0 ? "+" : ""
        text += " Isso é \(sign)\(Int(snapshot.weeklyDeltaPct.rounded()))% vs a semana anterior."
        if let top = snapshot.weeklyTopCategory {
            text += " Maior categoria: \(top)."
        }
        return .result(dialog: IntentDialog("\(text)"))
    }
}

public struct GetBalanceIntent: AppIntent {
    public static let title: LocalizedStringResource = "Qual meu saldo"
    public static let description = IntentDescription(
        "Informa o saldo consolidado das contas.",
        categoryName: "Finanças",
        searchKeywords: ["saldo", "conta", "dinheiro", "patrimônio"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        let text = "Seu saldo em contas é \(snapshot.bankBalanceLabel). Patrimônio líquido: \(snapshot.netWorthLabel)."
        return .result(dialog: IntentDialog("\(text)"))
    }
}

public struct GetOpenBillsIntent: AppIntent {
    public static let title: LocalizedStringResource = "Faturas abertas"
    public static let description = IntentDescription(
        "Informa o total das faturas abertas.",
        categoryName: "Finanças",
        searchKeywords: ["fatura", "cartão", "bill"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        let text = "Há \(snapshot.creditCount) cartão(ões) com fatura aberta de \(snapshot.openBillsLabel)."
        return .result(dialog: IntentDialog("\(text)"))
    }
}

public struct GetBudgetStatusIntent: AppIntent {
    public static let title: LocalizedStringResource = "Status do orçamento"
    public static let description = IntentDescription(
        "Informa o uso das verbas do mês.",
        categoryName: "Finanças",
        searchKeywords: ["orçamento", "verba", "budget"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        if snapshot.budgets.isEmpty {
            return .result(dialog: "Não há categorias de orçamento no resumo deste mês.")
        }
        let lines = snapshot.budgets.prefix(5).map {
            "\($0.category): \($0.spentLabel) de \($0.limitLabel) (\($0.percent)%)."
        }
        return .result(dialog: IntentDialog("\(lines.joined(separator: " "))"))
    }
}

public struct GetInsightsIntent: AppIntent {
    public static let title: LocalizedStringResource = "Insights financeiros"
    public static let description = IntentDescription(
        "Lê os insights da visão geral.",
        categoryName: "Finanças",
        searchKeywords: ["insight", "dica", "finanças"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: "Ainda não há insights no resumo local. Abra a Visão Geral uma vez.")
        }
        if snapshot.insights.isEmpty {
            return .result(dialog: "Ainda não há insights no resumo local.")
        }
        let text = snapshot.insights.prefix(3).map(\.text).joined(separator: " ")
        return .result(dialog: IntentDialog("\(text)"))
    }
}

struct AddManualExpenseIntent: AppIntent {
    static let title: LocalizedStringResource = "Lançar despesa"
    static let description = IntentDescription("Lança uma despesa manual no MeuFlux.")
    static let supportedModes: IntentModes = [.foreground(.immediate)]
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresLocalDeviceAuthentication

    @Parameter(title: "Valor")
    var amount: Double

    @Parameter(title: "Descrição")
    var expenseDescription: String

    @Parameter(title: "Categoria", default: .other)
    var category: ExpenseCategoryAppEnum

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let decimal = Decimal(amount)
        guard decimal > 0 else {
            return .result(dialog: "Informe um valor maior que zero.")
        }
        let message = await IntentRuntime.shared.addManualExpense(
            amount: decimal,
            description: expenseDescription,
            category: category.domain
        )
        return .result(dialog: IntentDialog("\(message)"))
    }
}

private enum SiriQueryDialog {
    static let missingSnapshot = IntentDialog(
        "Ainda não há um resumo neste iPhone. Abra a Visão Geral uma vez."
    )
}
