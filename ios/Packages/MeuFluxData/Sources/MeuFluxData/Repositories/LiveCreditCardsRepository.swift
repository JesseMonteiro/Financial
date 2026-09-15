import Foundation
import MeuFluxDomain

public struct LiveCreditCardsRepository: CreditCardsRepository {
    private let bff: BFFClient

    public init(bff: BFFClient) {
        self.bff = bff
    }

    public func fetchScreen(force: Bool) async throws -> CreditCardsScreen {
        let dto = try await bff.getCreditCardsScreen(force: force)
        return await Task.detached(priority: .userInitiated) {
            DomainMapper.creditCardsScreen(dto)
        }.value
    }
}
