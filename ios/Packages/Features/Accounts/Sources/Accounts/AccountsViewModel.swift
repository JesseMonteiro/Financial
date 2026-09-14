import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class AccountsViewModel {
    public private(set) var state: FeatureLoadState<[Account]> = .idle
    public var errorMessage: String?
    public private(set) var accounts: [Account] = []
    public var renameTarget: Account?
    public var renameText = ""
    public var draftName = ""
    public var draftInstitution = ""
    public var draftBalance = ""
    public var draftIsCredit = false

    private let repository: (any AccountsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(repository: (any AccountsRepository)? = nil) {
        self.repository = repository
    }

    public func load(force: Bool = false) async {
        let cacheKey = "accounts"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) {
            return
        }

        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        guard let repository else {
            state = .empty
            return
        }
        do {
            let loaded = try await repository.fetchAccounts(force: force)
            accounts = loaded
            state = loaded.isEmpty ? .empty : .loaded(loaded)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar.")
            }
        }
    }

    public func retry() async {
        await load(force: true)
    }

    public func beginRename(_ account: Account) {
        renameTarget = account
        renameText = account.name
    }

    public func saveRename() async {
        guard let repository, let account = renameTarget else { return }
        let name = renameText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        do {
            try await repository.renameAccount(id: account.id, name: name)
            renameTarget = nil
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func saveManual() async {
        guard let repository else { return }
        let name = draftName.trimmingCharacters(in: .whitespacesAndNewlines)
        let amount = Decimal(string: draftBalance.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard !name.isEmpty else {
            errorMessage = "Informe o nome da conta."
            return
        }
        let account = ManualAccount(
            id: UUID().uuidString,
            name: name,
            type: draftIsCredit ? .credit : .manual,
            institutionName: draftInstitution,
            balance: Money(amount: amount),
            billAmount: draftIsCredit ? Money(amount: amount) : nil
        )
        do {
            try await repository.saveManualAccount(account)
            draftName = ""
            draftInstitution = ""
            draftBalance = ""
            draftIsCredit = false
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func deleteManual(_ account: Account) async {
        guard let repository, account.type == .manual || account.connectorId == nil else { return }
        do {
            try await repository.deleteManualAccount(id: account.id)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }
}
