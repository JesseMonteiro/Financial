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

    public init(cornerRadius: CGFloat = Radius().chrome) {
        self.cornerRadius = cornerRadius
    }

    public func body(content: Content) -> some View {
        if #available(iOS 26.0, macOS 26.0, *) {
            content
                .glassEffect(.regular, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        } else {
            content
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.45), lineWidth: 1)
                )
        }
    }
}

public extension View {
    func financialGlassChrome(cornerRadius: CGFloat = Radius().chrome) -> some View {
        modifier(GlassChromeModifier(cornerRadius: cornerRadius))
    }
}
