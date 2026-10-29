import SwiftUI

/// Overlay semitransparente que bloqueia interações durante ações assíncronas.
/// Use como `.overlay` sobre a view principal, condicionado a uma flag de loading.
public struct ActionLoadingOverlay: View {
    public var message: String?

    public init(message: String? = nil) {
        self.message = message
    }

    public var body: some View {
        ZStack {
            Color.black.opacity(0.38)
                .ignoresSafeArea()
            VStack(spacing: 12) {
                ProgressView()
                    .progressViewStyle(.circular)
                    .scaleEffect(1.4)
                    .tint(.white)
                if let message {
                    Text(message)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(24)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .accessibilityLabel("Processando...")
        .accessibilityAddTraits(.updatesFrequently)
        .allowsHitTesting(true) // bloqueia taps
    }
}
