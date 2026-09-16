import SwiftUI

public enum MotionTokens {
    public static let fast: Double = 0.15
    public static let normal: Double = 0.25
    public static let slow: Double = 0.4

    public static var spring: Animation {
        .spring(response: 0.45, dampingFraction: 0.82)
    }

    public static var easeOutFast: Animation {
        .easeOut(duration: fast)
    }
}

/// Applies Liquid Glass on chrome when available; opaque material fallback otherwise.
public struct GlassChromeModifier: ViewModifier {
    public var cornerRadius: CGFloat
    public var capsule: Bool

    public init(cornerRadius: CGFloat = Radius().chrome, capsule: Bool = false) {
        self.cornerRadius = cornerRadius
        self.capsule = capsule
    }

    @ViewBuilder
    public func body(content: Content) -> some View {
        if capsule {
            if #available(iOS 26.0, macOS 26.0, *) {
                content.glassEffect(.regular, in: Capsule())
            } else {
                content
                    .background(.ultraThinMaterial, in: Capsule())
                    .overlay(Capsule().strokeBorder(MeuFluxColors.border, lineWidth: 1))
            }
        } else {
            let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            if #available(iOS 26.0, macOS 26.0, *) {
                content.glassEffect(.regular, in: shape)
            } else {
                content
                    .background(.ultraThinMaterial, in: shape)
                    .overlay(shape.strokeBorder(MeuFluxColors.border, lineWidth: 1))
            }
        }
    }
}

public extension View {
    func meuFluxGlassChrome(cornerRadius: CGFloat = Radius().chrome) -> some View {
        modifier(GlassChromeModifier(cornerRadius: cornerRadius))
    }

    func meuFluxGlassCapsule() -> some View {
        modifier(GlassChromeModifier(capsule: true))
    }
}
