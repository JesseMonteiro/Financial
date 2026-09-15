import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public struct GlassCard<Content: View>: View {
    private let title: String?
    private let subtitle: String?
    private let content: Content
    private let padding: CGFloat

    public init(padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.title = nil
        self.subtitle = nil
        self.padding = padding
        self.content = content()
    }

    public init(title: String, subtitle: String? = nil, padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.padding = padding
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundStyle(MeuFluxColors.textPrimary)
                    
                    if let subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textSecondary)
                    }
                }
            }
            
            content
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                .fill(MeuFluxColors.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        )
        .shadow(color: MeuFluxColors.cardShadow, radius: 8, y: 2)
    }
}

public struct GlassPill: View {
    public let title: String
    public var isSelected: Bool
    public var action: () -> Void

    public init(title: String, isSelected: Bool = false, action: @escaping () -> Void = {}) {
        self.title = title
        self.isSelected = isSelected
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? MeuFluxColors.textInverse : MeuFluxColors.textPrimary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background {
                    Capsule()
                        .fill(isSelected ? MeuFluxColors.primary : MeuFluxColors.card)
                }
                .overlay {
                    Capsule().strokeBorder(isSelected ? Color.clear : MeuFluxColors.border, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

public struct MetricCard: View {
    public let title: String
    public let value: String
    public var subtitle: String?
    public var tint: Color
    public var systemImage: String?
    public var leadingAccent: Bool

    public init(
        title: String,
        value: String,
        subtitle: String? = nil,
        tint: Color = MeuFluxColors.primary,
        systemImage: String? = nil,
        leadingAccent: Bool = false
    ) {
        self.title = title
        self.value = value
        self.subtitle = subtitle
        self.tint = tint
        self.systemImage = systemImage
        self.leadingAccent = leadingAccent
    }

    public var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(title)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(MeuFluxColors.textSecondary)
                    Spacer(minLength: 0)
                    if let systemImage {
                        Image(systemName: systemImage)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(tint)
                            .padding(6)
                            .background(tint.opacity(0.12), in: Circle())
                    }
                }
                Text(value)
                    .font(.title3.weight(.bold).monospacedDigit())
                    .foregroundStyle(tint)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .accessibilityLabel("\(title): \(value)")
                if let subtitle {
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(MeuFluxColors.textMuted)
                }
            }
        }
        .overlay(alignment: .leading) {
            if leadingAccent {
                UnevenRoundedRectangle(
                    topLeadingRadius: Radius().lg,
                    bottomLeadingRadius: Radius().lg,
                    bottomTrailingRadius: 0,
                    topTrailingRadius: 0,
                    style: .continuous
                )
                .fill(tint)
                .frame(width: 4)
            }
        }
    }
}

public struct SectionHeader: View {
    public let title: String
    public var subtitle: String?

    public init(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.headline.weight(.semibold))
                .foregroundStyle(MeuFluxColors.textPrimary)
            if let subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(MeuFluxColors.textMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

public struct PageChrome<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        ZStack {
            MeuFluxColors.bgPrimary.ignoresSafeArea()
            content
                .foregroundStyle(MeuFluxColors.textPrimary)
        }
    }
}

public extension View {
    /// Large title in the navigation bar, on the same row as trailing actions.
    func meuFluxPageTitle(_ title: String) -> some View {
        modifier(MeuFluxPageTitleModifier(title: title))
    }

    /// Side inset shared by feature pages (same as Momento Financeiro).
    /// Top inset is 40% tighter than the side/bottom gutter so content sits closer to the nav title.
    func meuFluxPageGutter() -> some View {
        padding(.horizontal, PageLayout.gutter)
            .padding(.bottom, PageLayout.gutter)
            .padding(.top, PageLayout.contentTop)
    }
}

public enum PageLayout {
    public static let gutter: CGFloat = 16
    /// Distance from nav title to first content — 60% of `gutter` (40% tighter).
    public static let contentTop: CGFloat = gutter * 0.6
}

private struct MeuFluxPageTitleModifier: ViewModifier {
    let title: String

    private var titleFont: Font {
        #if canImport(UIKit)
        let size = UIFont.preferredFont(forTextStyle: .largeTitle).pointSize * 0.8
        return .system(size: size, weight: .bold)
        #else
        return .title.weight(.bold)
        #endif
    }

    func body(content: Content) -> some View {
        content
            .navigationTitle(title)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarRole(.editor)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(title)
                        .font(titleFont)
                        .foregroundStyle(MeuFluxColors.textPrimary)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                }
            }
            #endif
    }
}

public struct TransactionRow: View {
    public let title: String
    public let subtitle: String?
    public let amountText: String
    public let isCredit: Bool
    public var badge: String?
    public var isPending: Bool
    public var action: (() -> Void)?

    public init(
        title: String,
        subtitle: String? = nil,
        amountText: String,
        isCredit: Bool,
        badge: String? = nil,
        isPending: Bool = false,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.amountText = amountText
        self.isCredit = isCredit
        self.badge = badge
        self.isPending = isPending
        self.action = action
    }

    public var body: some View {
        let row = HStack(spacing: 12) {
            Image(systemName: isCredit ? "arrow.down.left" : "arrow.up.right")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isCredit ? MeuFluxColors.success : MeuFluxColors.danger)
                .frame(width: 36, height: 36)
                .background(
                    (isCredit ? MeuFluxColors.success : MeuFluxColors.danger).opacity(0.12),
                    in: Circle()
                )
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let subtitle {
                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textMuted)
                            .lineLimit(1)
                    }
                    if let badge {
                        StatusBadge(badge, style: .neutral)
                    }
                    if isPending {
                        StatusBadge("Pendente", style: .warning)
                    }
                }
            }
            Spacer(minLength: 8)
            Text(isCredit ? "+\(amountText)" : "-\(amountText)")
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(isCredit ? MeuFluxColors.success : MeuFluxColors.danger)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)

        if let action {
            row
                .contentShape(Rectangle())
                .onTapGesture(perform: action)
                .accessibilityAddTraits(.isButton)
        } else {
            row
        }
    }
}

public struct AccountRow: View {
    public let title: String
    public let subtitle: String?
    public let amountText: String
    public var systemImage: String
    public var tint: Color

    public init(
        title: String,
        subtitle: String? = nil,
        amountText: String,
        systemImage: String = "building.columns.fill",
        tint: Color = MeuFluxColors.primary
    ) {
        self.title = title
        self.subtitle = subtitle
        self.amountText = amountText
        self.systemImage = systemImage
        self.tint = tint
    }

    public var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 36, height: 36)
                .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(1)
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            Text(amountText)
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(MeuFluxColors.textPrimary)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

public struct MoneyText: View {
    public let amount: Decimal
    public var currencyCode: String
    public var emphasize: Bool

    public init(amount: Decimal, currencyCode: String = "BRL", emphasize: Bool = false) {
        self.amount = amount
        self.currencyCode = currencyCode
        self.emphasize = emphasize
    }

    public var body: some View {
        Text(formatted)
            .font(emphasize ? .title3.weight(.bold).monospacedDigit() : .body.monospacedDigit())
            .foregroundStyle(amount < 0 ? MeuFluxColors.danger : MeuFluxColors.textPrimary)
            .accessibilityLabel(formatted)
    }

    private var formatted: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        formatter.locale = Locale(identifier: "pt_BR")
        return formatter.string(from: amount as NSDecimalNumber) ?? "\(amount)"
    }
}

public struct StatusBadge: View {
    public enum Style {
        case success, danger, warning, info, neutral
    }

    public let text: String
    public let style: Style

    public init(_ text: String, style: Style = .neutral) {
        self.text = text
        self.style = style
    }

    public var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .foregroundStyle(foreground)
            .background(background, in: Capsule())
            .fixedSize(horizontal: true, vertical: true)
    }

    private var foreground: Color {
        switch style {
        case .success: return MeuFluxColors.success
        case .danger: return MeuFluxColors.danger
        case .warning: return MeuFluxColors.warning
        case .info: return MeuFluxColors.info
        case .neutral: return MeuFluxColors.textSecondary
        }
    }

    private var background: Color {
        foreground.opacity(0.12)
    }
}

public struct WrappingHStack: Layout {
    public var spacing: CGFloat
    public var lineSpacing: CGFloat

    public init(spacing: CGFloat = 6, lineSpacing: CGFloat = 4) {
        self.spacing = spacing
        self.lineSpacing = lineSpacing
    }

    public func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        layout(proposal: proposal, subviews: subviews).size
    }

    public func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let frames = layout(proposal: ProposedViewSize(width: bounds.width, height: bounds.height), subviews: subviews).frames
        for (index, frame) in frames.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + frame.minX, y: bounds.minY + frame.minY),
                proposal: ProposedViewSize(frame.size)
            )
        }
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, frames: [CGRect]) {
        var maxWidth = proposal.width ?? 320
        if maxWidth.isInfinite { maxWidth = 320 }
        var frames: [CGRect] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var width: CGFloat = 0

        for subview in subviews {
            var size = subview.sizeThatFits(.unspecified)
            // Never demand more width than offered, otherwise the enclosing
            // page grows wider than its container and loses its side insets.
            size.width = min(size.width, maxWidth)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + lineSpacing
                rowHeight = 0
            }
            frames.append(CGRect(origin: CGPoint(x: x, y: y), size: size))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            width = min(max(width, x - spacing), maxWidth)
        }

        let height = y + rowHeight
        return (CGSize(width: width, height: height), frames)
    }
}

public struct EmptyState: View {
    public let title: String
    public let message: String
    public var systemImage: String
    public var actionTitle: String?
    public var action: (() -> Void)?

    public init(
        title: String,
        message: String,
        systemImage: String = "tray",
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.message = message
        self.systemImage = systemImage
        self.actionTitle = actionTitle
        self.action = action
    }

    public var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.largeTitle)
                .foregroundStyle(MeuFluxColors.textMuted)
            Text(title)
                .font(.headline)
                .foregroundStyle(MeuFluxColors.textPrimary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(MeuFluxColors.textSecondary)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
                    .tint(MeuFluxColors.primary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

public struct ErrorState: View {
    public let message: String
    public var retry: (() -> Void)?

    public init(message: String, retry: (() -> Void)? = nil) {
        self.message = message
        self.retry = retry
    }

    public var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(MeuFluxColors.warning)
            Text("Algo deu errado")
                .font(.headline)
                .foregroundStyle(MeuFluxColors.textPrimary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(MeuFluxColors.textSecondary)
                .multilineTextAlignment(.center)
            if let retry {
                Button("Tentar novamente", action: retry)
                    .buttonStyle(.borderedProminent)
                    .tint(MeuFluxColors.primary)
            }
        }
        .padding()
    }
}

public struct OfflineBanner: View {
    public var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash")
            Text("Você está offline")
                .font(.subheadline.weight(.semibold))
            Spacer()
        }
        .foregroundStyle(MeuFluxColors.textInverse)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(MeuFluxColors.warning)
        .accessibilityLabel("Banner: você está offline")
    }
}

public struct MonthStrip: View {
    public let months: [String]
    public var selectedIndex: Int
    public var onSelect: (Int) -> Void

    public init(months: [String], selectedIndex: Int, onSelect: @escaping (Int) -> Void) {
        self.months = months
        self.selectedIndex = selectedIndex
        self.onSelect = onSelect
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            ScrollViewReader { proxy in
                HStack(spacing: 8) {
                    ForEach(Array(months.enumerated()), id: \.offset) { index, title in
                        MonthChip(
                            text: title,
                            isSelected: index == selectedIndex
                        ) {
                            onSelect(index)
                        }
                        .id(index)
                    }
                }
                .padding(.horizontal, 4)
                .onChange(of: selectedIndex) { _, newValue in
                    withAnimation(.easeInOut(duration: 0.3)) {
                        proxy.scrollTo(newValue, anchor: .center)
                    }
                }
            }
        }
        .accessibilityLabel("Seletor de mês")
    }
}

public struct PaidToggle: View {
    @Binding public var isPaid: Bool
    public var label: String

    public init(isPaid: Binding<Bool>, label: String = "Pago") {
        self._isPaid = isPaid
        self.label = label
    }

    public var body: some View {
        Toggle(label, isOn: $isPaid)
            .tint(MeuFluxColors.success)
            .accessibilityLabel("\(label): \(isPaid ? "sim" : "não")")
    }
}

public struct ConfirmationSheet: View {
    public let title: String
    public let message: String
    public var confirmTitle: String
    public var cancelTitle: String
    public var onConfirm: () -> Void
    public var onCancel: () -> Void

    public init(
        title: String,
        message: String,
        confirmTitle: String = "Confirmar",
        cancelTitle: String = "Cancelar",
        onConfirm: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.title = title
        self.message = message
        self.confirmTitle = confirmTitle
        self.cancelTitle = cancelTitle
        self.onConfirm = onConfirm
        self.onCancel = onCancel
    }

    public var body: some View {
        VStack(spacing: 16) {
            Text(title)
                .font(.headline)
                .foregroundStyle(MeuFluxColors.textPrimary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(MeuFluxColors.textSecondary)
                .multilineTextAlignment(.center)
            HStack {
                Button(cancelTitle, action: onCancel)
                    .buttonStyle(.bordered)
                Button(confirmTitle, action: onConfirm)
                    .buttonStyle(.borderedProminent)
                    .tint(MeuFluxColors.primary)
            }
        }
        .padding(24)
    }
}

// MARK: - Financial Moment Components

public struct Badge: View {
    let text: String
    let style: BadgeStyle
    
    public enum BadgeStyle {
        case neutral, success, warning, danger, info
    }
    
    public init(_ text: String, style: BadgeStyle = .neutral) {
        self.text = text
        self.style = style
    }
    
    public var body: some View {
        Text(text)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .foregroundStyle(textColor)
            .clipShape(Capsule())
    }
    
    private var backgroundColor: Color {
        switch style {
        case .neutral: return MeuFluxColors.tertiaryBackground
        case .success: return MeuFluxColors.successBackground
        case .warning: return MeuFluxColors.warningBackground
        case .danger: return MeuFluxColors.dangerBackground
        case .info: return MeuFluxColors.infoBackground
        }
    }
    
    private var textColor: Color {
        switch style {
        case .neutral: return MeuFluxColors.textPrimary
        case .success: return MeuFluxColors.success
        case .warning: return MeuFluxColors.warning
        case .danger: return MeuFluxColors.danger
        case .info: return MeuFluxColors.info
        }
    }
}


public struct MonthChip: View {
    let text: String
    let isSelected: Bool
    let onTap: () -> Void
    
    public init(text: String, isSelected: Bool, onTap: @escaping () -> Void) {
        self.text = text
        self.isSelected = isSelected
        self.onTap = onTap
    }
    
    public var body: some View {
        Button(action: onTap) {
            Text(text)
                .font(.caption)
                .fontWeight(isSelected ? .semibold : .medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(isSelected ? MeuFluxColors.primary : Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(MeuFluxColors.primary, lineWidth: 1)
                        )
                )
                .foregroundStyle(isSelected ? .white : MeuFluxColors.primary)
        }
        .buttonStyle(.plain)
    }
}
