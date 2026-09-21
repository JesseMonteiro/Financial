import SwiftUI

/// Adds a fluid, staggered arrival animation for cards and page sections.
/// Matches Liquid Glass physics and respects `accessibilityReduceMotion`.
public struct CardEntranceModifier: ViewModifier {
    public var index: Int
    public var delay: Double?
    public var offset: CGFloat
    public var scale: CGFloat
    public var trigger: AnyHashable?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var hasAppeared = false

    public init(
        index: Int = 0,
        delay: Double? = nil,
        offset: CGFloat = 18,
        scale: CGFloat = 0.97,
        trigger: AnyHashable? = nil
    ) {
        self.index = index
        self.delay = delay
        self.offset = offset
        self.scale = scale
        self.trigger = trigger
    }

    public func body(content: Content) -> some View {
        content
            .opacity(hasAppeared ? 1 : 0)
            .scaleEffect(hasAppeared || reduceMotion ? 1 : scale)
            .offset(y: hasAppeared || reduceMotion ? 0 : offset)
            .onAppear {
                animateIn()
            }
            .onChange(of: trigger) { _, _ in
                hasAppeared = false
                animateIn()
            }
    }

    private func animateIn() {
        guard !hasAppeared else { return }
        if reduceMotion {
            withAnimation(.easeOut(duration: MotionTokens.fast)) {
                hasAppeared = true
            }
        } else {
            let stagger = delay ?? min(Double(max(0, index)) * MotionTokens.staggerDelay, MotionTokens.maxStaggerDelay)
            withAnimation(MotionTokens.cardEntrance.delay(stagger)) {
                hasAppeared = true
            }
        }
    }
}

public extension View {
    /// Applies a smooth spring arrival animation with staggered timing.
    ///
    /// - Parameters:
    ///   - index: Zero-based position in the cascade order (0 = first to appear).
    ///   - offset: Initial vertical displacement in points (default: 18).
    ///   - scale: Initial scale factor (default: 0.97).
    ///   - delay: Explicit delay in seconds (overrides `index * staggerDelay` if provided).
    ///   - trigger: Optional value whose changes re-trigger the entrance animation.
    func cardEntrance(
        index: Int = 0,
        offset: CGFloat = 18,
        scale: CGFloat = 0.97,
        delay: Double? = nil,
        trigger: AnyHashable? = nil
    ) -> some View {
        modifier(
            CardEntranceModifier(
                index: index,
                delay: delay,
                offset: offset,
                scale: scale,
                trigger: trigger
            )
        )
    }

    /// Convenience for staggered entrance within a list or grid.
    func staggeredEntrance(index: Int, offset: CGFloat = 18) -> some View {
        cardEntrance(index: index, offset: offset)
    }
}
