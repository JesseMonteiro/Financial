import AppIntents

public struct MeuFluxAppShortcuts: AppShortcutsProvider {
    public static var shortcutTileColor: ShortcutTileColor { .navy }

    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: GetBalanceIntent(),
            phrases: [
                "Qual meu saldo no \(.applicationName)",
                "Qual é o meu saldo no \(.applicationName)",
                "Meu saldo no \(.applicationName)",
                "Quanto eu tenho no \(.applicationName)",
                "Saldo no \(.applicationName)",
                "What's my balance in \(.applicationName)",
            ],
            shortTitle: "Saldo",
            systemImageName: "wallet.pass"
        )
        AppShortcut(
            intent: GetWeeklySpendIntent(),
            phrases: [
                "Quanto gastei esta semana no \(.applicationName)",
                "Gastos da semana no \(.applicationName)",
            ],
            shortTitle: "Gastos da semana",
            systemImageName: "chart.bar"
        )
        AppShortcut(
            intent: GetOpenBillsIntent(),
            phrases: [
                "Faturas abertas no \(.applicationName)",
                "Quanto está a fatura no \(.applicationName)",
            ],
            shortTitle: "Faturas",
            systemImageName: "creditcard.and.123"
        )
        AppShortcut(
            intent: GetBudgetStatusIntent(),
            phrases: [
                "Como está meu orçamento no \(.applicationName)",
                "Status do orçamento no \(.applicationName)",
            ],
            shortTitle: "Orçamento",
            systemImageName: "chart.pie"
        )
        AppShortcut(
            intent: GetInsightsIntent(),
            phrases: [
                "Insights no \(.applicationName)",
                "O que mudou nas minhas finanças no \(.applicationName)",
            ],
            shortTitle: "Insights",
            systemImageName: "sparkles"
        )
        AppShortcut(
            intent: OpenDashboardIntent(),
            phrases: [
                "Abrir \(.applicationName)",
                "Mostrar visão geral no \(.applicationName)",
            ],
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
