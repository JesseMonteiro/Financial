import SwiftUI

/// A status dot indicator showing Open Finance cache freshness in iOS
public struct SyncStatusDot: View {
    public let color: Color
    public let label: String?
    public let showPulse: Bool

    public init(color: Color, label: String? = nil, showPulse: Bool = false) {
        self.color = color
        self.label = label
        self.showPulse = showPulse
    }

    public static func forFreshness(level: String, label: String? = nil) -> SyncStatusDot {
        let color: Color
        switch level {
        case "fresh": color = MeuFluxColors.success
        case "aging": color = MeuFluxColors.warning
        case "stale": color = MeuFluxColors.danger
        default: color = MeuFluxColors.textMuted
        }
        return SyncStatusDot(color: color, label: label, showPulse: level == "fresh")
    }

    public var body: some View {
        HStack(spacing: 6) {
            ZStack {
                if showPulse {
                    Circle()
                        .fill(color.opacity(0.3))
                        .frame(width: 14, height: 14)
                }
                Circle()
                    .fill(color)
                    .frame(width: 7, height: 7)
            }

            if let label {
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(MeuFluxColors.textSecondary)
            }
        }
        .padding(.horizontal, label != nil ? 8 : 4)
        .padding(.vertical, 3)
        .background(MeuFluxColors.bgSecondary.opacity(0.4), in: Capsule())
    }
}
