import SwiftUI
import MeuFluxDomain
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
        .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        .background {
            FrostedFill(cornerRadius: Radius().xxl)
        }
        .overlay {
            RoundedRectangle(cornerRadius: Radius().xxl, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        }
        .overlay(alignment: .top) {
            RoundedRectangle(cornerRadius: Radius().xxl, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [Color.white.opacity(0.22), Color.white.opacity(0)],
                        startPoint: .top,
                        endPoint: .center
                    ),
                    lineWidth: 1
                )
                .allowsHitTesting(false)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius().xxl, style: .continuous))
        .shadow(color: MeuFluxColors.cardShadow, radius: 16, y: 8)
        .shadow(color: MeuFluxColors.cardShadowSecondary, radius: 8, y: 3)
    }
}

/// Translucent fill used by frosted cards (material + tinted overlay).
public struct FrostedFill: View {
    public var cornerRadius: CGFloat

    public init(cornerRadius: CGFloat = Radius().xxl) {
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        shape.fill(.ultraThinMaterial)
            .overlay(shape.fill(MeuFluxColors.card))
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
                    topLeadingRadius: Radius().xxl,
                    bottomLeadingRadius: Radius().xxl,
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
        content
            .foregroundStyle(MeuFluxColors.textPrimary)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background {
                ZStack {
                    MeuFluxColors.bgPrimary
                    AmbientBloom()
                }
                .ignoresSafeArea()
                .allowsHitTesting(false)
            }
    }
}

/// Fixed, non-interactive radial blooms behind page content (Liquid Frost layer 0).
public struct AmbientBloom: View {
    public init() {}

    public var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                Circle()
                    .fill(MeuFluxColors.bloomBlue)
                    .frame(width: min(420, geo.size.width * 1.1), height: min(420, geo.size.width * 1.1))
                    .blur(radius: 90)
                    .offset(x: -geo.size.width * 0.28, y: -160)
                Circle()
                    .fill(MeuFluxColors.bloomIndigo)
                    .frame(width: 380, height: 380)
                    .blur(radius: 100)
                    .offset(x: geo.size.width * 0.55, y: geo.size.height * 0.18)
                Circle()
                    .fill(MeuFluxColors.bloomEmerald)
                    .frame(width: 340, height: 340)
                    .blur(radius: 90)
                    .offset(x: -80, y: geo.size.height * 0.58)
                Circle()
                    .fill(MeuFluxColors.bloomCyan)
                    .frame(width: 360, height: 360)
                    .blur(radius: 100)
                    .offset(x: geo.size.width * 0.42, y: geo.size.height * 0.72)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .compositingGroup()
            .clipped()
            .allowsHitTesting(false)
        }
        .clipped()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

public struct BrandWordmark: View {
    public var size: CGFloat

    public init(size: CGFloat = 22) {
        self.size = size
    }

    public var body: some View {
        Text("MeuFlux")
            .font(.system(size: size, weight: .bold))
            .tracking(-0.4)
            .foregroundStyle(
                LinearGradient(
                    colors: MeuFluxColors.brandGradient,
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .accessibilityLabel("MeuFlux")
    }
}

public struct ProBadge: View {
    public init() {}

    public var body: some View {
        Text("PRO")
            .font(.system(size: 10, weight: .bold))
            .tracking(0.6)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(MeuFluxColors.primary)
            .background(MeuFluxColors.primary.opacity(0.12), in: Capsule())
            .overlay(Capsule().strokeBorder(MeuFluxColors.primary.opacity(0.28), lineWidth: 1))
            .accessibilityLabel("Pro")
    }
}

public struct LiveBadge: View {
    public init() {}

    public var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(MeuFluxColors.primary)
                .frame(width: 6, height: 6)
            Text("Ao Vivo")
                .font(.system(size: 11, weight: .semibold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .foregroundStyle(MeuFluxColors.primary)
        .background(MeuFluxColors.primary.opacity(0.10), in: Capsule())
        .overlay(Capsule().strokeBorder(MeuFluxColors.primary.opacity(0.28), lineWidth: 1))
        .accessibilityLabel("Ao vivo")
    }
}

public struct GradientCapsuleButton: View {
    public var title: String
    public var systemImage: String
    public var action: () -> Void

    public init(_ title: String, systemImage: String = "plus", action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    Capsule().fill(
                        LinearGradient(
                            colors: MeuFluxColors.brandGradient,
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                )
                .shadow(color: MeuFluxColors.primary.opacity(0.28), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

public struct ProfileAvatarMark: View {
    public var initials: String?
    public var size: CGFloat

    public init(initials: String? = nil, size: CGFloat = 36) {
        self.initials = initials
        self.size = size
    }

    public var body: some View {
        ZStack {
            Circle().fill(
                LinearGradient(
                    colors: MeuFluxColors.brandGradient,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            if let initials, !initials.isEmpty {
                Text(initials)
                    .font(.system(size: size * 0.38, weight: .bold))
                    .foregroundStyle(Color.white)
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.39, weight: .semibold))
                    .foregroundStyle(Color.white)
            }
        }
        .frame(width: size, height: size)
        .shadow(color: MeuFluxColors.primary.opacity(0.22), radius: size < 32 ? 4 : 6, y: 2)
        .accessibilityHidden(true)
    }
}

public struct ProfileAvatarButton: View {
    public var initials: String?
    public var action: () -> Void

    public init(initials: String? = nil, action: @escaping () -> Void) {
        self.initials = initials
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            ProfileAvatarMark(initials: initials, size: 36)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Conta")
        .accessibilityHint("Mostra nome, e-mail e sair")
    }
}

/// Compact account summary anchored to the profile avatar, like a tooltip.
public struct ProfileAccountMenu: View {
    public var displayName: String
    public var email: String
    public var onSignOut: (() -> Void)?

    @State private var isPresented = false

    public init(
        displayName: String,
        email: String,
        onSignOut: (() -> Void)? = nil
    ) {
        self.displayName = displayName
        self.email = email
        self.onSignOut = onSignOut
    }

    public var body: some View {
        ProfileAvatarButton(initials: initials) {
            withAnimation(MotionTokens.spring) {
                isPresented.toggle()
            }
        }
        .overlay(alignment: .topTrailing) {
            if isPresented {
                ProfileAccountCard(
                    displayName: resolvedName,
                    email: resolvedEmail,
                    initials: initials,
                    onSignOut: {
                        withAnimation(MotionTokens.easeOutFast) { isPresented = false }
                        onSignOut?()
                    }
                )
                .offset(y: 44)
                .transition(.opacity.combined(with: .scale(scale: 0.96, anchor: .topTrailing)))
            }
        }
        .zIndex(isPresented ? 10 : 0)
        .accessibilityElement(children: .contain)
    }

    private var resolvedName: String {
        let trimmed = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Usuário" : trimmed
    }

    private var resolvedEmail: String {
        email.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var initials: String? {
        ProfileAccountMenu.initials(from: resolvedName)
    }

    static func initials(from name: String) -> String? {
        let ignored: Set<String> = ["você", "voce", "usuário", "usuario", "user"]
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !ignored.contains(trimmed.lowercased()) else { return nil }
        let parts = trimmed.split { $0.isWhitespace || $0 == "-" }
        let letters = parts.prefix(2).compactMap(\.first)
        let value = String(letters).uppercased()
        return value.isEmpty ? nil : value
    }
}

struct ProfileAccountCard: View {
    var displayName: String
    var email: String
    var initials: String?
    var onSignOut: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("CONTA")
                .font(.system(size: 10, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(MeuFluxColors.textMuted)

            HStack(alignment: .center, spacing: 12) {
                ProfileAvatarMark(initials: initials, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    Text(displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                        .lineLimit(2)
                    if !email.isEmpty {
                        Text(email)
                            .font(.caption)
                            .foregroundStyle(MeuFluxColors.textMuted)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if onSignOut != nil {
                Divider().opacity(0.45)
                Button(role: .destructive) {
                    onSignOut?()
                } label: {
                    Label("Sair", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.plain)
                .foregroundStyle(MeuFluxColors.danger)
                .background(
                    MeuFluxColors.danger.opacity(0.12),
                    in: RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                )
                .accessibilityLabel("Sair da conta")
            }
        }
        .padding(16)
        .frame(width: 268, alignment: .leading)
        .background {
            FrostedFill(cornerRadius: Radius().lg)
        }
        .overlay {
            RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        }
        .shadow(color: MeuFluxColors.cardShadow, radius: 16, y: 8)
        .shadow(color: MeuFluxColors.cardShadowSecondary, radius: 8, y: 3)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Resumo da conta")
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
    /// Purchase / Pluggy category key — drives the leading circle icon when set.
    public var categoryKey: String?
    public var action: (() -> Void)?

    public init(
        title: String,
        subtitle: String? = nil,
        amountText: String,
        isCredit: Bool,
        badge: String? = nil,
        isPending: Bool = false,
        categoryKey: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.amountText = amountText
        self.isCredit = isCredit
        self.badge = badge
        self.isPending = isPending
        self.categoryKey = categoryKey
        self.action = action
    }

    private var leadingIcon: String {
        if let categoryKey, !categoryKey.isEmpty {
            return PurchaseCategoryCatalog.systemImage(for: categoryKey)
        }
        return isCredit ? "arrow.down.left" : "arrow.up.right"
    }

    private var leadingTint: Color {
        if let categoryKey, !categoryKey.isEmpty,
           let hex = PurchaseCategoryCatalog.color(for: categoryKey),
           let color = Color(hexString: hex) {
            return color
        }
        return isCredit ? MeuFluxColors.success : MeuFluxColors.danger
    }

    public var body: some View {
        let tint = leadingTint
        let row = HStack(spacing: 12) {
            Image(systemName: leadingIcon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 36, height: 36)
                .background(tint.opacity(0.12), in: Circle())
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

/// VA/VR card used on personal and joint financial moment screens.
public struct MealBenefitMomentCard: View {
    public var kindTitle: String
    public var isVR: Bool
    public var provider: String?
    public var remainingText: String
    public var remainingNegative: Bool
    public var creditDay: Int
    public var monthSpentText: String
    public var ownerLabel: String?
    public var onManage: (() -> Void)?

    public init(
        kindTitle: String,
        isVR: Bool = false,
        provider: String? = nil,
        remainingText: String,
        remainingNegative: Bool = false,
        creditDay: Int,
        monthSpentText: String,
        ownerLabel: String? = nil,
        onManage: (() -> Void)? = nil
    ) {
        self.kindTitle = kindTitle
        self.isVR = isVR
        self.provider = provider
        self.remainingText = remainingText
        self.remainingNegative = remainingNegative
        self.creditDay = creditDay
        self.monthSpentText = monthSpentText
        self.ownerLabel = ownerLabel
        self.onManage = onManage
    }

    public var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 12) {
                    HStack(alignment: .center, spacing: 10) {
                        kindIcon
                        VStack(alignment: .leading, spacing: 2) {
                            Text(kindTitle)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(MeuFluxColors.textPrimary)
                            if let provider, !provider.isEmpty {
                                Text(provider)
                                    .font(.caption)
                                    .foregroundStyle(MeuFluxColors.textMuted)
                            }
                        }
                    }
                    Spacer(minLength: 8)
                    if let ownerLabel, !ownerLabel.isEmpty {
                        ownerBadge(ownerLabel)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("SALDO DISPONÍVEL")
                        .font(.caption2.weight(.semibold))
                        .tracking(0.4)
                        .foregroundStyle(MeuFluxColors.textMuted)
                    Text(remainingText)
                        .font(.title.weight(.bold))
                        .foregroundStyle(remainingNegative ? MeuFluxColors.danger : MeuFluxColors.textPrimary)
                    Text("Crédito dia \(creditDay) · gasto no mês \(monthSpentText)")
                        .font(.caption)
                        .foregroundStyle(MeuFluxColors.textMuted)
                }

                if onManage != nil {
                    Button {
                        onManage?()
                    } label: {
                        HStack(spacing: 6) {
                            Text("Gerenciar VA/VR")
                            Image(systemName: "arrow.right")
                                .font(.caption.weight(.bold))
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(MeuFluxColors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(MeuFluxColors.bgTertiary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var kindIcon: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isVR ? Color(hex: 0x9A3412, opacity: 0.85) : Color(hex: 0x166534, opacity: 0.85))
            Image(systemName: "fork.knife")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isVR ? Color(hex: 0xFDBA74) : Color(hex: 0x86EFAC))
        }
        .frame(width: 36, height: 36)
        .accessibilityHidden(true)
    }

    private func ownerBadge(_ label: String) -> some View {
        let first = label.split(whereSeparator: \.isWhitespace).first.map(String.init) ?? label
        return HStack(spacing: 6) {
            ProfileAvatarMark(initials: ProfileAccountMenu.initials(from: label), size: 22)
            Text(first)
                .font(.caption.weight(.semibold))
                .foregroundStyle(MeuFluxColors.textPrimary)
                .lineLimit(1)
        }
        .padding(.leading, 3)
        .padding(.trailing, 8)
        .padding(.vertical, 3)
        .background(MeuFluxColors.bgTertiary)
        .clipShape(Capsule())
        .overlay {
            Capsule().strokeBorder(MeuFluxColors.border, lineWidth: 1)
        }
    }
}
