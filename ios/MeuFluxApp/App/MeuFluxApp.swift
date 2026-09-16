import SwiftUI
import MeuFluxCore
import MeuFluxDesignSystem
import Authentication

@main
struct MeuFluxApp: App {
    @State private var composition = AppCompositionRoot()
    @State private var appearance = AppearancePreferences.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(composition: composition)
                .modifier(SyncMeuFluxTheme())
                .preferredColorScheme(appearance.preferredColorScheme)
                .tint(MeuFluxColors.primary)
                .onAppear {
                    ImportNotificationCenter.shared.configure()
                    IntentRuntime.shared.bind(composition)
                    MeuFluxAppShortcuts.updateAppShortcutParameters()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        MeuFluxAppShortcuts.updateAppShortcutParameters()
                        Task { await composition.refreshWidgetSnapshot() }
                    }
                }
        }
    }
}

private struct SyncMeuFluxTheme: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content.environment(\.meuFluxTheme, MeuFluxTheme(colorScheme: colorScheme))
    }
}
