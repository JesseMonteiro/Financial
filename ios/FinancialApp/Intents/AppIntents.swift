import AppIntents
import Foundation

public struct OpenDashboardIntent: AppIntent {
    public static var title: LocalizedStringResource {
        "Abrir Visão Geral"
    }

    public static var description: IntentDescription {
        IntentDescription("Abre a tela inicial do Financial.")
    }

    public init() {}

    public func perform() async throws -> some IntentResult {
        .result()
    }
}

public struct OpenCreditCardsIntent: AppIntent {
    public static var title: LocalizedStringResource {
        "Abrir Cartões"
    }

    public static var description: IntentDescription {
        IntentDescription("Abre faturas e cartões de crédito.")
    }

    public init() {}

    public func perform() async throws -> some IntentResult {
        .result()
    }
}

public struct SyncBanksIntent: AppIntent {
    public static var title: LocalizedStringResource {
        "Sincronizar bancos"
    }

    public static var description: IntentDescription {
        IntentDescription("Dispara sincronização das conexões bancárias.")
    }

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: "Sincronização iniciada.")
    }
}

public struct FinancialAppShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenDashboardIntent(),
            phrases: ["Abrir \(.applicationName)", "Mostrar visão geral no \(.applicationName)"],
            shortTitle: "Visão Geral",
            systemImageName: "square.grid.2x2"
        )
        AppShortcut(
            intent: OpenCreditCardsIntent(),
            phrases: ["Abrir cartões no \(.applicationName)"],
            shortTitle: "Cartões",
            systemImageName: "creditcard"
        )
        AppShortcut(
            intent: SyncBanksIntent(),
            phrases: ["Sincronizar bancos no \(.applicationName)"],
            shortTitle: "Sincronizar",
            systemImageName: "arrow.triangle.2.circlepath"
        )
    }
}
