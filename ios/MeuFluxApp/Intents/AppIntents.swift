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
        categoryName: "MeuFlux",
        searchKeywords: ["gastos", "semana", "recap"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        return .result(dialog: IntentDialog("\(snapshot.weeklySpendDialog)"))
    }
}

public struct GetBalanceIntent: AppIntent {
    public static let title: LocalizedStringResource = "Saldo no MeuFlux"
    public static let description = IntentDescription(
        "Responde o saldo das contas Open Finance no app MeuFlux. Não consulta a Carteira da Apple nem o Apple Cash.",
        categoryName: "MeuFlux",
        searchKeywords: ["MeuFlux", "Open Finance", "saldo das contas", "patrimônio"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        return .result(dialog: IntentDialog("\(snapshot.balanceDialog)"))
    }
}

public struct GetOpenBillsIntent: AppIntent {
    public static let title: LocalizedStringResource = "Faturas abertas"
    public static let description = IntentDescription(
        "Informa o total das faturas abertas.",
        categoryName: "MeuFlux",
        searchKeywords: ["MeuFlux", "fatura", "Open Finance"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        return .result(dialog: IntentDialog("\(snapshot.openBillsDialog)"))
    }
}

public struct GetTopCardSpendIntent: AppIntent {
    public static let title: LocalizedStringResource = "Maior fatura no MeuFlux"
    public static let description = IntentDescription(
        "Diz qual cartão Open Finance do MeuFlux tem a maior fatura aberta. Não usa Apple Cash nem a Carteira da Apple.",
        categoryName: "MeuFlux",
        searchKeywords: ["MeuFlux", "fatura", "Open Finance", "gastos do cartão"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        return .result(dialog: IntentDialog("\(snapshot.cardSpendDialog)"))
    }
}

public struct GetBudgetStatusIntent: AppIntent {
    public static let title: LocalizedStringResource = "Status do orçamento"
    public static let description = IntentDescription(
        "Informa o uso das verbas do mês.",
        categoryName: "MeuFlux",
        searchKeywords: ["orçamento", "verba", "budget"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: SiriQueryDialog.missingSnapshot)
        }
        return .result(dialog: IntentDialog("\(snapshot.budgetDialog)"))
    }
}

public struct GetInsightsIntent: AppIntent {
    public static let title: LocalizedStringResource = "Insights financeiros"
    public static let description = IntentDescription(
        "Lê os insights da visão geral.",
        categoryName: "MeuFlux",
        searchKeywords: ["insight", "dica", "finanças"]
    )
    public static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]
    public static let isDiscoverable = true

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let snapshot = SiriSnapshotStore().load() else {
            return .result(dialog: "Ainda não há insights no resumo local. Abra a Visão Geral uma vez.")
        }
        return .result(dialog: IntentDialog("\(snapshot.insightsDialog)"))
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
