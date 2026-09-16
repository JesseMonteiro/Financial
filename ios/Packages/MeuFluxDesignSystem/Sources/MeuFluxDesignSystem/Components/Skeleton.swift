import SwiftUI

// MARK: - Shimmer

private struct SkeletonShimmerPhaseKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

private extension EnvironmentValues {
    var skeletonShimmerPhase: CGFloat {
        get { self[SkeletonShimmerPhaseKey.self] }
        set { self[SkeletonShimmerPhaseKey.self] = newValue }
    }
}

private struct SkeletonShimmerHost<Content: View>: View {
    let content: Content

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: false)) { timeline in
            let period = 1.5
            let t = timeline.date.timeIntervalSinceReferenceDate
            let phase = CGFloat((t.truncatingRemainder(dividingBy: period)) / period)
            content.environment(\.skeletonShimmerPhase, phase)
        }
    }
}

/// Shimmering placeholder block. Matches the web `.skeleton-shimmer` motion.
public struct SkeletonBlock: View {
    @Environment(\.skeletonShimmerPhase) private var phase

    public var width: CGFloat?
    public var height: CGFloat
    public var cornerRadius: CGFloat

    public init(width: CGFloat? = nil, height: CGFloat = 16, cornerRadius: CGFloat = 8) {
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(shimmerFill)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
            .accessibilityHidden(true)
    }

    private var shimmerFill: LinearGradient {
        LinearGradient(
            colors: [
                MeuFluxColors.bgTertiary,
                MeuFluxColors.shimmerHighlight,
                MeuFluxColors.bgTertiary,
            ],
            startPoint: UnitPoint(x: phase * 2 - 0.8, y: 0.5),
            endPoint: UnitPoint(x: phase * 2 + 0.2, y: 0.5)
        )
    }
}

public struct SkeletonCard: View {
    public var lines: Int

    public init(lines: Int = 3) {
        self.lines = lines
    }

    public var body: some View {
        let widths: [CGFloat] = [0.40, 0.70, 0.55, 0.85, 0.45]
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                ForEach(0..<lines, id: \.self) { index in
                    GeometryReader { geo in
                        SkeletonBlock(
                            width: geo.size.width * widths[index % widths.count],
                            height: index == 1 ? 22 : 12
                        )
                    }
                    .frame(height: index == 1 ? 22 : 12)
                }
            }
        }
    }
}

public struct SkeletonListRows: View {
    public var rows: Int

    public init(rows: Int = 6) {
        self.rows = rows
    }

    public var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<rows, id: \.self) { index in
                HStack(spacing: 12) {
                    SkeletonBlock(width: 36, height: 36, cornerRadius: 18)
                    VStack(alignment: .leading, spacing: 6) {
                        GeometryReader { geo in
                            SkeletonBlock(
                                width: geo.size.width * (0.55 + CGFloat(index % 3) * 0.12),
                                height: 14
                            )
                        }
                        .frame(height: 14)
                        GeometryReader { geo in
                            SkeletonBlock(
                                width: geo.size.width * (0.35 + CGFloat(index % 4) * 0.08),
                                height: 10
                            )
                        }
                        .frame(height: 10)
                    }
                    SkeletonBlock(width: 72, height: 16)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 10)
                .background(
                    RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                        .fill(MeuFluxColors.bgSecondary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Radius().md, style: .continuous)
                        .strokeBorder(MeuFluxColors.border, lineWidth: 1)
                )
            }
        }
    }
}

public struct SkeletonTimelineStrip: View {
    public var count: Int
    public var itemWidth: CGFloat
    public var itemHeight: CGFloat

    public init(count: Int = 5, itemWidth: CGFloat = 148, itemHeight: CGFloat = 92) {
        self.count = count
        self.itemWidth = itemWidth
        self.itemHeight = itemHeight
    }

    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(0..<count, id: \.self) { _ in
                    SkeletonBlock(
                        width: itemWidth,
                        height: itemHeight,
                        cornerRadius: Radius().lg
                    )
                }
            }
        }
        .scrollDisabled(true)
    }
}

public struct SkeletonChartPlaceholder: View {
    public var height: CGFloat

    public init(height: CGFloat = 180) {
        self.height = height
    }

    public var body: some View {
        let barHeights: [CGFloat] = [0.46, 0.72, 0.38, 0.88, 0.64, 0.52, 0.78]
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(Array(barHeights.enumerated()), id: \.offset) { _, fraction in
                    SkeletonBlock(
                        height: height * fraction,
                        cornerRadius: Radius().sm
                    )
                }
            }
            .frame(height: height, alignment: .bottom)
            SkeletonBlock(width: 160, height: 10)
        }
    }
}

/// Full-page loading layout so screens never sit blank while data loads.
public struct PageLoadingSkeleton: View {
    public enum Style: Sendable {
        /// KPI grid + chart + list (Início, Relatórios).
        case dashboard
        /// Month chips + KPIs + cards (Momento Financeiro, Conta conjunta).
        case moment
        /// Card carousel + KPIs + bill chips + statement.
        case creditCards
        /// Summary header + list rows.
        case summaryList
        /// Transaction / account style rows.
        case list
        /// Form sections (Configurações).
        case form
    }

    public var style: Style
    /// When true, skip the page ScrollView / gutter — the parent already provides them.
    public var embedded: Bool

    public init(style: Style, embedded: Bool = false) {
        self.style = style
        self.embedded = embedded
    }

    public var body: some View {
        SkeletonShimmerHost(content: chrome)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Carregando")
            .accessibilityAddTraits(.updatesFrequently)
    }

    @ViewBuilder
    private var chrome: some View {
        if embedded {
            skeleton
        } else {
            ScrollView {
                skeleton
                    .meuFluxPageGutter()
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(MeuFluxColors.bgPrimary)
        }
    }

    @ViewBuilder
    private var skeleton: some View {
        switch style {
        case .dashboard:
            dashboardSkeleton
        case .moment:
            momentSkeleton
        case .creditCards:
            creditCardsSkeleton
        case .summaryList:
            summaryListSkeleton
        case .list:
            listSkeleton
        case .form:
            formSkeleton
        }
    }

    private var dashboardSkeleton: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                SkeletonBlock(width: 120, height: 22)
                SkeletonBlock(width: 220, height: 18)
                SkeletonBlock(width: 260, height: 12)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(0..<2, id: \.self) { _ in
                    SkeletonCard(lines: 5)
                }
            }
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(width: 140, height: 16)
                    SkeletonBlock(width: 180, height: 22)
                    SkeletonChartPlaceholder(height: 140)
                }
            }
            VStack(spacing: 12) {
                SkeletonBlock(width: 100, height: 16)
                SkeletonCard(lines: 3)
                SkeletonCard(lines: 3)
            }
        }
    }

    private var momentSkeleton: some View {
        VStack(alignment: .leading, spacing: 16) {
            SkeletonTimelineStrip(count: 6, itemWidth: 92, itemHeight: 44)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in
                    SkeletonCard(lines: 3)
                }
            }
            GlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    SkeletonBlock(width: 150, height: 14)
                    SkeletonBlock(height: 10, cornerRadius: 5)
                    SkeletonBlock(width: 200, height: 10)
                }
            }
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(width: 180, height: 14)
                    SkeletonListRows(rows: 4)
                }
            }
        }
    }

    private var creditCardsSkeleton: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                SkeletonBlock(width: 200, height: 20)
                SkeletonBlock(width: 110, height: 12)
            }
            SkeletonTimelineStrip(count: 4, itemWidth: 188, itemHeight: 118)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(0..<4, id: \.self) { _ in
                    SkeletonCard(lines: 3)
                }
            }
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(width: 120, height: 14)
                    SkeletonTimelineStrip(count: 5, itemWidth: 108, itemHeight: 64)
                }
            }
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(width: 160, height: 14)
                    SkeletonListRows(rows: 5)
                }
            }
        }
    }

    private var summaryListSkeleton: some View {
        VStack(alignment: .leading, spacing: 16) {
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(width: 120, height: 12)
                    SkeletonBlock(width: 160, height: 22)
                    SkeletonBlock(width: 200, height: 10)
                }
            }
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    SkeletonBlock(width: 140, height: 14)
                    SkeletonListRows(rows: 6)
                }
            }
        }
    }

    private var listSkeleton: some View {
        VStack(alignment: .leading, spacing: 16) {
            GlassCard {
                SkeletonListRows(rows: 8)
            }
        }
    }

    private var formSkeleton: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(0..<4, id: \.self) { _ in
                GlassCard {
                    VStack(alignment: .leading, spacing: 12) {
                        SkeletonBlock(width: 110, height: 12)
                        SkeletonBlock(height: 18)
                        SkeletonBlock(width: 180, height: 14)
                        SkeletonBlock(height: 18)
                    }
                }
            }
        }
    }
}

/// Single shimmer bar. Prefer `PageLoadingSkeleton` for full screens.
public struct SkeletonView: View {
    public var height: CGFloat
    public var cornerRadius: CGFloat

    public init(height: CGFloat = 20, cornerRadius: CGFloat = 8) {
        self.height = height
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        SkeletonShimmerHost(content: SkeletonBlock(height: height, cornerRadius: cornerRadius))
            .accessibilityLabel("Carregando")
    }
}
