import SwiftUI
import UIKit

enum WidgetPalette {
    static let textPrimary = Color(light: 0x0F172A, dark: 0xF8FAFC)
    static let textSecondary = Color(light: 0x475569, dark: 0x94A3B8)
    static let textMuted = Color(light: 0x94A3B8, dark: 0x64748B)
    static let success = Color(red: 0.063, green: 0.725, blue: 0.506)
    static let danger = Color(red: 0.957, green: 0.247, blue: 0.369)
    static let warning = Color(red: 0.961, green: 0.620, blue: 0.043)
    static let primary = Color(red: 0.388, green: 0.400, blue: 0.945)
    static let border = Color(light: 0x000000, dark: 0xFFFFFF, lightOpacity: 0.08, darkOpacity: 0.10)
    static let card = Color(light: 0xFFFFFF, dark: 0x111827, lightOpacity: 0.92, darkOpacity: 0.92)
    static let bgPrimary = Color(light: 0xF8FAFC, dark: 0x090D16)
}

extension Color {
    init(light: UInt32, dark: UInt32, lightOpacity: Double = 1, darkOpacity: Double = 1) {
        self.init(uiColor: UIColor { traits in
            let isDark = traits.userInterfaceStyle == .dark
            let hex = isDark ? dark : light
            let alpha = isDark ? darkOpacity : lightOpacity
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: alpha
            )
        })
    }
}

struct WidgetStatusPanel: View {
    let systemImage: String
    let title: String
    let message: String
    let accessibilityLabel: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: systemImage)
                .font(.title3)
                .foregroundStyle(WidgetPalette.primary)
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(WidgetPalette.textPrimary)
            Text(message)
                .font(.caption2)
                .foregroundStyle(WidgetPalette.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityLabel(accessibilityLabel)
    }
}

struct WidgetMonthHeader: View {
    let kicker: String
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(kicker)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(WidgetPalette.textMuted)
                .tracking(0.5)
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(WidgetPalette.textPrimary)
                .lineLimit(1)
        }
    }
}

struct WidgetKPICell: View {
    let title: String
    let value: String
    let color: Color
    var subtitle: String? = nil

    var body: some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(color)
                .frame(width: 3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(WidgetPalette.textMuted)
                    .tracking(0.3)
                Text(value)
                    .font(.caption.weight(.heavy).monospacedDigit())
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 9))
                        .foregroundStyle(WidgetPalette.textSecondary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(WidgetPalette.card)
    }
}

struct WidgetUtilizationBar: View {
    let percent: Int
    let over: Bool

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(WidgetPalette.border)
                Capsule()
                    .fill(over ? WidgetPalette.danger : WidgetPalette.primary)
                    .frame(width: max(0, geometry.size.width * CGFloat(min(100, max(0, percent))) / 100))
            }
        }
        .frame(height: 6)
        .accessibilityHidden(true)
    }
}
