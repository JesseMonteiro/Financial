import AppIntents

public struct MeuFluxAppShortcuts: AppShortcutsProvider {
    public static var shortcutTileColor: ShortcutTileColor { .navy }

    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: GetBalanceIntent(),
            phrases: [
                "No \(.applicationName) qual meu saldo",
                "No \(.applicationName) meu saldo",
                "\(.applicationName) saldo",
                "Saldo no \(.applicationName)",
                "Quanto eu tenho no \(.applicationName)",
            ],
            shortTitle: "Saldo",
            systemImageName: "banknote"
        )
        AppShortcut(
            intent: GetWeeklySpendIntent(),
            phrases: [
                "No \(.applicationName) quanto gastei esta semana",
                "Gastos da semana no \(.applicationName)",
            ],
            shortTitle: "Gastos da semana",
            systemImageName: "chart.bar"
        )
        AppShortcut(
            intent: GetTopCardSpendIntent(),
            phrases: [
                "No \(.applicationName) qual cartão gastei mais",
                "No \(.applicationName) cartão com mais gastos",
                "\(.applicationName) maior fatura",
            ],
            shortTitle: "Maior fatura",
            systemImageName: "creditcard.and.123"
        )
        AppShortcut(
            intent: GetOpenBillsIntent(),
            phrases: [
                "No \(.applicationName) faturas abertas",
                "Faturas abertas no \(.applicationName)",
            ],
            shortTitle: "Faturas",
            systemImageName: "doc.text"
        )
        AppShortcut(
            intent: GetBudgetStatusIntent(),
            phrases: [
                "No \(.applicationName) como está meu orçamento",
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
            phrases: [
                "Abrir cartões no \(.applicationName)",
                "No \(.applicationName) abrir cartões",
            ],
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
