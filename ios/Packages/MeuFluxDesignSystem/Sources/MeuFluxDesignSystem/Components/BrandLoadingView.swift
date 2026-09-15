import SwiftUI

/// Branded full-screen / inline loading indicator used across feature screens.
public struct BrandLoadingView: View {
    public var message: String?
    /// Display height of the GIF (width follows aspect fit).
    public var height: CGFloat

    public init(message: String? = nil, height: CGFloat = 220) {
        self.message = message
        self.height = height
    }

    public var body: some View {
        VStack(spacing: 16) {
            AnimatedGIFView(resourceName: "LogoLoading", maxPixelSize: 640)
                .frame(maxWidth: 280, maxHeight: height)
                .accessibilityHidden(true)

            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(MeuFluxColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 280)
        .padding()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message ?? "Carregando")
    }
}
