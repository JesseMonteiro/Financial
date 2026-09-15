import Observation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif
#if canImport(AppKit) && !os(iOS)
import AppKit
#endif

/// Colors mapped from web CSS tokens in `src/styles/variables.css`.
/// Semantic surfaces and text resolve against the current color scheme so dark
/// mode never keeps light-theme slate on a dark system chrome (or the reverse).
public enum MeuFluxColors {
    public static let bgPrimary = Color(light: 0xF8FAFC, dark: 0x090D16)
    public static let bgSecondary = Color(light: 0xFFFFFF, dark: 0x111827)
    public static let bgTertiary = Color(light: 0xF1F5F9, dark: 0x1F2937)
    public static let textPrimary = Color(light: 0x0F172A, dark: 0xF8FAFC)
    public static let textSecondary = Color(light: 0x475569, dark: 0x94A3B8)
    public static let textMuted = Color(light: 0x94A3B8, dark: 0x64748B)
    public static let textInverse = Color.white
    public static let primary = Color(hex: 0x6366F1)
    public static let primaryHover = Color(hex: 0x4F46E5)
    public static let success = Color(hex: 0x10B981)
    public static let danger = Color(hex: 0xF43F5E)
    public static let warning = Color(hex: 0xF59E0B)
    public static let info = Color(hex: 0x0EA5E9)
    public static let border = Color(light: 0x000000, dark: 0xFFFFFF, lightOpacity: 0.08, darkOpacity: 0.10)
    public static let glassTint = Color(light: 0xFFFFFF, dark: 0x111827, lightOpacity: 0.55, darkOpacity: 0.65)
    /// Elevated cards / glass panels (`--bg-card`).
    public static let card = Color(light: 0xFFFFFF, dark: 0x111827, lightOpacity: 0.92, darkOpacity: 0.92)
    public static let cardShadow = Color(light: 0x000000, dark: 0x000000, lightOpacity: 0.04, darkOpacity: 0.45)
    public static let shimmerHighlight = Color(light: 0xFFFFFF, dark: 0x374151, lightOpacity: 0.78, darkOpacity: 0.55)

    public static let successBackground = success.opacity(0.12)
    public static let warningBackground = warning.opacity(0.12)
    public static let dangerBackground = danger.opacity(0.12)
    public static let infoBackground = info.opacity(0.12)
    public static let tertiaryBackground = bgTertiary

    public static let darkBgPrimary = Color(hex: 0x090D16)
    public static let darkBgSecondary = Color(hex: 0x111827)
    public static let darkTextPrimary = Color(hex: 0xF8FAFC)
}

/// User-facing appearance: `system`, `light`, or `dark`. Cached locally so the
/// choice applies before settings finish loading.
@MainActor
@Observable
public final class AppearancePreferences {
    public static let shared = AppearancePreferences()
    private static let storageKey = "meuflux.appearance.theme"

    public var theme: String {
        didSet { UserDefaults.standard.set(theme, forKey: Self.storageKey) }
    }

    public init() {
        theme = Self.normalized(UserDefaults.standard.string(forKey: Self.storageKey))
    }

    public func apply(_ raw: String) {
        let value = Self.normalized(raw)
        guard theme != value else { return }
        theme = value
    }

    public var preferredColorScheme: ColorScheme? {
        switch theme {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }

    private static func normalized(_ raw: String?) -> String {
        switch raw {
        case "light": "light"
        case "dark": "dark"
        default: "system"
        }
    }
}

public struct MeuFluxTheme: Sendable {
    public let colors: ColorTokens
    public let spacing: Spacing
    public let radius: Radius

    public init(colorScheme: ColorScheme = .light) {
        self.colors = ColorTokens(scheme: colorScheme)
        self.spacing = Spacing()
        self.radius = Radius()
    }

    public static let light = MeuFluxTheme(colorScheme: .light)
    public static let dark = MeuFluxTheme(colorScheme: .dark)
}

public struct ColorTokens: Sendable {
    public let background: Color
    public let surface: Color
    public let text: Color
    public let secondaryText: Color
    public let muted: Color
    public let accent: Color
    public let success: Color
    public let danger: Color
    public let warning: Color

    public init(scheme: ColorScheme) {
        // Semantic `MeuFluxColors` already track the environment. Keep explicit
        // dark constants when the theme is constructed for `.dark` so snapshots
        // and previews that pin a scheme still get the night palette.
        switch scheme {
        case .dark:
            background = MeuFluxColors.darkBgPrimary
            surface = MeuFluxColors.darkBgSecondary
            text = MeuFluxColors.darkTextPrimary
            secondaryText = Color(hex: 0x94A3B8)
            muted = Color(hex: 0x64748B)
        default:
            background = Color(hex: 0xF8FAFC)
            surface = Color(hex: 0xFFFFFF)
            text = Color(hex: 0x0F172A)
            secondaryText = Color(hex: 0x475569)
            muted = Color(hex: 0x94A3B8)
        }
        accent = MeuFluxColors.primary
        success = MeuFluxColors.success
        danger = MeuFluxColors.danger
        warning = MeuFluxColors.warning
    }
}

public struct Spacing: Sendable {
    public let xxs: CGFloat = 4
    public let xs: CGFloat = 8
    public let sm: CGFloat = 12
    public let md: CGFloat = 16
    public let lg: CGFloat = 24
    public let xl: CGFloat = 32
    public let xxl: CGFloat = 40
    public let xxxl: CGFloat = 48
    public init() {}
}

public struct Radius: Sendable {
    public let sm: CGFloat = 6
    public let md: CGFloat = 12
    public let lg: CGFloat = 16
    public let xl: CGFloat = 24
    public let chrome: CGFloat = 22
    public let full: CGFloat = 999
    public init() {}
}

public extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }

    init(light: UInt32, dark: UInt32, lightOpacity: Double = 1, darkOpacity: Double = 1) {
        #if canImport(UIKit)
        self.init(uiColor: UIColor { traits in
            let isDark = traits.userInterfaceStyle == .dark
            return UIColor(hex: isDark ? dark : light, opacity: isDark ? darkOpacity : lightOpacity)
        })
        #elseif canImport(AppKit)
        self.init(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            return NSColor(hex: isDark ? dark : light, opacity: isDark ? darkOpacity : lightOpacity)
        })
        #else
        self.init(hex: light, opacity: lightOpacity)
        #endif
    }
}

#if canImport(UIKit)
private extension UIColor {
    convenience init(hex: UInt32, opacity: Double) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: opacity
        )
    }
}
#endif

#if canImport(AppKit) && !os(iOS)
private extension NSColor {
    convenience init(hex: UInt32, opacity: Double) {
        self.init(
            srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: opacity
        )
    }
}
#endif

private struct MeuFluxThemeKey: EnvironmentKey {
    static let defaultValue = MeuFluxTheme.light
}

public extension EnvironmentValues {
    var meuFluxTheme: MeuFluxTheme {
        get { self[MeuFluxThemeKey.self] }
        set { self[MeuFluxThemeKey.self] = newValue }
    }
}
