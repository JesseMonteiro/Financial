import SwiftUI
import FinancialCore
import FinancialDesignSystem
import Authentication

@main
struct FinancialApp: App {
    @State private var composition = AppCompositionRoot()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(composition: composition)
                .environment(\.financialTheme, .light)
                .tint(FinancialColors.primary)
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task { await composition.refreshWidgetSnapshot() }
                    }
                }
        }
    }
}
