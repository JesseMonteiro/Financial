import SwiftUI

/// Colors mapped from web CSS tokens in `src/styles/variables.css`.
public enum FinancialColors {
    public static let bgPrimary = Color(hex: 0xF8FAFC)
    public static let bgSecondary = Color(hex: 0xFFFFFF)
    public static let bgTertiary = Color(hex: 0xF1F5F9)
    public static let textPrimary = Color(hex: 0x0F172A)
    public static let textSecondary = Color(hex: 0x475569)
    public static let textMuted = Color(hex: 0x94A3B8)
    public static let textInverse = Color.white
    public static let primary = Color(hex: 0x6366F1)
    public static let primaryHover = Color(hex: 0x4F46E5)
    public static let success = Color(hex: 0x10B981)
    public static let danger = Color(hex: 0xF43F5E)
    public static let warning = Color(hex: 0xF59E0B)
    public static let info = Color(hex: 0x0EA5E9)
    public static let border = Color.black.opacity(0.08)
    public static let glassTint = Color.white.opacity(0.55)

    // Background colors for badges and states
    public static let successBackground = success.opacity(0.1)
    public static let warningBackground = warning.opacity(0.1)
    public static let dangerBackground = danger.opacity(0.1)
    public static let infoBackground = info.opacity(0.1)
    public static let tertiaryBackground = Color(hex: 0xF1F5F9)

    // Dark
    public static let darkBgPrimary = Color(hex: 0x090D16)
    public static let darkBgSecondary = Color(hex: 0x111827)
    public static let darkTextPrimary = Color(hex: 0xF8FAFC)
}

public struct FinancialTheme: Sendable {
    public let colors: ColorTokens
    public let spacing: Spacing
    public let radius: Radius

    public init(colorScheme: ColorScheme = .light) {
        self.colors = ColorTokens(scheme: colorScheme)
        self.spacing = Spacing()
        self.radius = Radius()
    }

    public static let light = FinancialTheme(colorScheme: .light)
    public static let dark = FinancialTheme(colorScheme: .dark)
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
        switch scheme {
        case .dark:
            background = FinancialColors.darkBgPrimary
            surface = FinancialColors.darkBgSecondary
            text = FinancialColors.darkTextPrimary
            secondaryText = FinancialColors.textSecondary
            muted = FinancialColors.textMuted
        default:
            background = FinancialColors.bgPrimary
            surface = FinancialColors.bgSecondary
            text = FinancialColors.textPrimary
            secondaryText = FinancialColors.textSecondary
            muted = FinancialColors.textMuted
        }
        accent = FinancialColors.primary
        success = FinancialColors.success
        danger = FinancialColors.danger
        warning = FinancialColors.warning
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
}

private struct FinancialThemeKey: EnvironmentKey {
    static let defaultValue = FinancialTheme.light
}

public extension EnvironmentValues {
    var financialTheme: FinancialTheme {
        get { self[FinancialThemeKey.self] }
        set { self[FinancialThemeKey.self] = newValue }
    }
}
