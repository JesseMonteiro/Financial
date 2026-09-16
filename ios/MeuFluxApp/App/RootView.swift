import SwiftUI
import Authentication
import MeuFluxCore
import MeuFluxDesignSystem

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
                            Task {
                                await composition.refreshAccountIdentity()
                                await composition.refreshJointNav()
                                composition.isAuthenticated = true
                                if composition.env.featureFlags.biometricLockEnabled {
                                    isBiometricallyLocked = true
                                }
                                await composition.refreshWidgetSnapshot(force: true)
                            }
                        }
                    }
                } else {
                    MeuFluxColors.bgPrimary.ignoresSafeArea()
                }
            }

            if showSplash {
                LaunchSplashView(isReady: composition.hasBootstrapped) {
                    showSplash = false
                }
                .id("meuflux-launch-splash")
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
                #if canImport(MeuFluxDesignSystem)
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
            composition.handleDeepLink(url)
        }
        .onAppear {
            ImportNotificationCenter.shared.configure()
            ImportNotificationCenter.shared.onOpenReview = { id in
                composition.pendingImportReviewId = id
            }
            ImportNotificationCenter.shared.undoHandler = { id in
                _ = await composition.notificationImportService.undo(recordId: id)
            }
        }
    }

    private var biometricGate: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.fill")
                .font(.system(size: 44))
                .foregroundStyle(MeuFluxColors.primary)
            Text("MeuFlux bloqueado")
                .font(.title2.bold())
            Button("Desbloquear com \(biometric.biometryTypeName)") {
                Task {
                    let ok = await biometric.unlock(reason: "Desbloquear MeuFlux")
                    if ok { isBiometricallyLocked = false }
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MeuFluxColors.bgPrimary.ignoresSafeArea())
    }
}
