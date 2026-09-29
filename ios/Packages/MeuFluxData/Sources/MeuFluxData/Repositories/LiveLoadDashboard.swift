import Foundation
import MeuFluxCore
import MeuFluxDomain

public struct LiveLoadDashboard: LoadDashboardUseCase {
    private let bff: BFFClient

    public init(bff: BFFClient) {
        self.bff = bff
    }

    public func execute(month: YearMonth, force: Bool) async throws -> DashboardSnapshot {
        if force {
            _ = try? await bff.refreshSync()
        }
        let dto = try await bff.getDashboard(month: month, force: force)
        var snap = DomainMapper.dashboard(dto)
        if snap.lastSyncedAt == nil {
            if let syncStatus = await bff.getSyncStatus(force: force),
               let parsed = syncStatus.parsedGlobalLastSyncedAt {
                snap.lastSyncedAt = parsed
            }
        }
        return snap
    }
}
