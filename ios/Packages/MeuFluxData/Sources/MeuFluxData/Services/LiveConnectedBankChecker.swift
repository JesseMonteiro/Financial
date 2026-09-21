import Foundation
import MeuFluxDomain

public struct LiveConnectedBankChecker: ConnectedBankChecking, Sendable {
    private let bankConnections: any BankConnectionsRepository

    public init(bankConnections: any BankConnectionsRepository) {
        self.bankConnections = bankConnections
    }

    public func isConnectedViaOpenFinance(source: NotificationImportSource) async -> Bool {
        guard source.isBankSource else { return false }
        let targetNames = source.openFinanceInstitutionNames
        guard !targetNames.isEmpty else { return false }

        do {
            let items = try await bankConnections.fetchItems(force: false)
            let activeItems = items.filter { item in
                let status = item.status.uppercased()
                return status != "LOGIN_ERROR" && status != "OUTDATED"
            }

            return activeItems.contains { item in
                let normalizedInstitution = item.institutionName.notificationImportFolded
                return targetNames.contains { target in
                    normalizedInstitution.contains(target.notificationImportFolded)
                }
            }
        } catch {
            return false
        }
    }
}
