import Foundation
import MeuFluxCore
import MeuFluxDomain

public struct LiveLoadDashboard: LoadDashboardUseCase {
    private let bff: BFFClient

    public init(bff: BFFClient) {
        self.bff = bff
    }

    public func execute(month: YearMonth, force: Bool) async throws -> DashboardSnapshot {
        let dto = try await bff.getDashboard(month: month, force: force)
        return DomainMapper.dashboard(dto)
    }
}
