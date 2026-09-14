import SwiftUI
import FinancialDesignSystem

/// Full-screen launch splash: holds the app logo until ready, then zooms it
/// to fill the screen and fades away.
struct LaunchSplashView: View {
    var isReady: Bool
    var onFinished: () -> Void

    @State private var logoScale: CGFloat = 0.72
    @State private var logoOpacity: Double = 1
    @State private var backgroundOpacity: Double = 1
    @State private var minTimeElapsed = false
    @State private var didStartExit = false

    private let minimumVisibleSeconds: TimeInterval = 1.1
    private let logoSide: CGFloat = 148

    var body: some View {
        ZStack {
            FinancialColors.bgPrimary
                .opacity(backgroundOpacity)
                .ignoresSafeArea()

            Image("AppLogo")
                .resizable()
                .scaledToFit()
                .frame(width: logoSide, height: logoSide)
                .clipShape(RoundedRectangle(cornerRadius: logoSide * 0.2237, style: .continuous))
                .shadow(color: .black.opacity(0.18), radius: 24, y: 12)
                .scaleEffect(logoScale)
                .opacity(logoOpacity)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .allowsHitTesting(false)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Carregando FinanceHub")
        .onAppear {
            withAnimation(.spring(response: 0.65, dampingFraction: 0.78)) {
                logoScale = 1
            }
            Task {
                try? await Task.sleep(nanoseconds: UInt64(minimumVisibleSeconds * 1_000_000_000))
                minTimeElapsed = true
                attemptExit()
            }
            // In case bootstrap finished before onAppear / onChange.
            attemptExit()
        }
        .onChange(of: isReady) { _, _ in
            attemptExit()
        }
    }

    private func attemptExit() {
        guard isReady, minTimeElapsed, !didStartExit else { return }
        didStartExit = true

        Task { @MainActor in
            // 1) Super zoom that swallows the screen while still fully visible.
            withAnimation(.easeIn(duration: 0.48)) {
                logoScale = 38
            }

            try? await Task.sleep(nanoseconds: 380_000_000)

            // 2) Then dissolve.
            withAnimation(.easeOut(duration: 0.22)) {
                logoOpacity = 0
                backgroundOpacity = 0
            }

            try? await Task.sleep(nanoseconds: 240_000_000)
            onFinished()
        }
    }
}
