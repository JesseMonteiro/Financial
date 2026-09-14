import SwiftUI
import Authentication
import FinancialCore
import FinancialDesignSystem

private struct OfflineBannerFallback: View {
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.exclamationmark")
                .imageScale(.large)
            Text("Você está offline")
                .font(.subheadline.weight(.semibold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.red.opacity(0.9))
        )
        .padding(.top, 8)
    }
}

struct RootView: View {
    @Bindable var composition: AppCompositionRoot
    @State private var biometric = BiometricLock()
    @State private var isBiometricallyLocked = false
    @State private var showSplash = true

    var body: some View {
        ZStack {
            Group {
                if composition.hasBootstrapped {
                    if composition.isAuthenticated {
                        if isBiometricallyLocked {
                            biometricGate
                        } else {
                            AdaptiveShell(composition: composition)
                        }
                    } else {
                        AuthenticationView(viewModel: composition.authViewModel) {
                            composition.isAuthenticated = true
                            Task {
                                await composition.refreshJointNav()
                                await composition.refreshWidgetSnapshot(force: true)
                            }
                            if composition.env.featureFlags.biometricLockEnabled {
                                isBiometricallyLocked = true
                            }
                        }
                    }
                } else {
                    FinancialColors.bgPrimary.ignoresSafeArea()
                }
            }

            if showSplash {
                LaunchSplashView(isReady: composition.hasBootstrapped) {
                    showSplash = false
                }
                .transition(.identity)
                .zIndex(1)
            }
        }
        .task {
            await composition.bootstrap()
            if composition.isAuthenticated, composition.env.featureFlags.biometricLockEnabled {
                isBiometricallyLocked = true
            }
        }
        .overlay(alignment: .top) {
            if composition.isOffline {
                #if canImport(FinancialDesignSystem)
                    OfflineBannerFallback()
                #else
                    OfflineBannerFallback()
                #endif
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .financialSessionInvalidated)) { _ in
            Task { await composition.signOut() }
        }
        .onOpenURL { url in
            if let route = AppRoute.fromDeepLink(url) {
                composition.selectedRoute = route
            }
        }
    }

    private var biometricGate: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.fill")
                .font(.system(size: 44))
                .foregroundStyle(FinancialColors.primary)
            Text("FinanceHub bloqueado")
                .font(.title2.bold())
            Button("Desbloquear com \(biometric.biometryTypeName)") {
                Task {
                    let ok = await biometric.unlock(reason: "Desbloquear FinanceHub")
                    if ok { isBiometricallyLocked = false }
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FinancialColors.bgPrimary.ignoresSafeArea())
    }
}
