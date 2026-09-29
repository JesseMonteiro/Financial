import SwiftUI

public struct NotificationBellButton: View {
    public let pendingCount: Int
    public let onTap: () -> Void

    public init(pendingCount: Int, onTap: @escaping () -> Void) {
        self.pendingCount = pendingCount
        self.onTap = onTap
    }

    public var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .topTrailing) {
                Image(systemName: pendingCount > 0 ? "bell.badge.fill" : "bell.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .frame(width: 36, height: 36)
                    .background(MeuFluxColors.bgSecondary.opacity(0.6), in: Circle())

                if pendingCount > 0 {
                    Text(pendingCount > 99 ? "99+" : "\(pendingCount)")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4)
                        .frame(minWidth: 16, minHeight: 16)
                        .background(MeuFluxColors.danger, in: Capsule())
                        .offset(x: 6, y: -4)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Notificações")
        .accessibilityValue(pendingCount > 0 ? "\(pendingCount) pendentes" : "Nenhuma pendente")
    }
}
