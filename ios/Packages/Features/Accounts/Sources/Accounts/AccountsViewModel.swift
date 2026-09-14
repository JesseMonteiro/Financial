import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class AccountsViewModel {
    public enum ManualKind: String, CaseIterable, Identifiable {
        case both
        case account
        case card

        public var id: String { rawValue }

        public var label: String {
            switch self {
            case .both: return "Conta + cartão"
            case .account: return "Conta"
            case .card: return "Cartão"
            }
        }
    }

    public private(set) var state: FeatureLoadState<[Account]> = .idle
    public var errorMessage: String?
    public var statusMessage: String?
    public var statusIsError = false
    public private(set) var accounts: [Account] = []
    public private(set) var isSyncing = false

    public var renameTarget: Account?
    public var renameText = ""
    public var pendingDelete: Account?

    public var draftKind: ManualKind = .both
    public var draftInstitution = ""
    public var draftAccountName = ""
    public var draftAccountBalance = ""
    public var draftCardName = ""
    public var draftCardNumber = ""
    public var draftBillAmount = ""
    public var draftBillDueDay = ""
    public var draftCreditLimit = ""
    public var isSavingManual = false

    private let repository: (any AccountsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public var bankAccounts: [Account] {
        accounts.filter(\.isBankAccount)
    }

    public var creditCards: [Account] {
        accounts.filter(\.isCreditCard)
    }

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
            accounts = loaded.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
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

    public func sync() async {
        isSyncing = true
        statusMessage = "Atualizando saldos…"
        statusIsError = false
        defer { isSyncing = false }
        await load(force: true)
        if let errorMessage {
            statusMessage = errorMessage
            statusIsError = true
        } else {
            statusMessage = "Saldos atualizados. Contas manuais não são alteradas pela sincronização dos bancos."
            statusIsError = false
        }
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
            statusMessage = errorMessage
            statusIsError = true
        }
    }

    public func resetManualDraft() {
        draftKind = .both
        draftInstitution = ""
        draftAccountName = ""
        draftAccountBalance = ""
        draftCardName = ""
        draftCardNumber = ""
        draftBillAmount = ""
        draftBillDueDay = ""
        draftCreditLimit = ""
    }

    public func saveManual() async -> Bool {
        guard let repository else { return false }
        let institution = draftInstitution.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !institution.isEmpty else {
            errorMessage = "Informe a instituição."
            statusMessage = errorMessage
            statusIsError = true
            return false
        }

        isSavingManual = true
        defer { isSavingManual = false }

        do {
            let showAccount = draftKind == .account || draftKind == .both
            let showCard = draftKind == .card || draftKind == .both

            if showAccount {
                let balance = parseMoney(draftAccountBalance)
                let name = draftAccountName.trimmingCharacters(in: .whitespacesAndNewlines)
                let account = ManualAccount(
                    id: UUID().uuidString,
                    name: name.isEmpty ? institution : name,
                    type: .manual,
                    institutionName: institution,
                    balance: Money(amount: balance)
                )
                try await repository.saveManualAccount(account)
            }

            if showCard {
                let bill = parseMoney(draftBillAmount)
                let limit = draftCreditLimit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    ? nil
                    : Money(amount: parseMoney(draftCreditLimit))
                let dueDay = Int(draftBillDueDay.trimmingCharacters(in: .whitespacesAndNewlines))
                let cardName = draftCardName.trimmingCharacters(in: .whitespacesAndNewlines)
                let account = ManualAccount(
                    id: UUID().uuidString,
                    name: cardName.isEmpty ? "\(institution) Cartão" : cardName,
                    type: .credit,
                    institutionName: institution,
                    balance: Money(amount: bill),
                    billAmount: Money(amount: bill),
                    billDueDay: dueDay.flatMap { (1...31).contains($0) ? $0 : nil },
                    creditLimit: limit
                )
                try await repository.saveManualAccount(account)
            }

            resetManualDraft()
            await load(force: true)
            statusMessage = "Conta manual salva."
            statusIsError = false
            return true
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            statusMessage = errorMessage
            statusIsError = true
            return false
        }
    }

    public func deleteManual(_ account: Account) async {
        guard let repository, account.isManual else { return }
        do {
            try await repository.deleteManualAccount(id: account.id)
            pendingDelete = nil
            await load(force: true)
            statusMessage = "Conta excluída."
            statusIsError = false
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            statusMessage = errorMessage
            statusIsError = true
        }
    }

    public static func syncLabel(for date: Date?, now: Date = Date()) -> (text: String, style: StatusBadge.Style)? {
        guard let date else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: date), to: Calendar.current.startOfDay(for: now)).day ?? 0
        let style: StatusBadge.Style
        if days >= 7 { style = .danger }
        else if days >= 2 { style = .warning }
        else { style = .neutral }

        let text: String
        if days <= 0 { text = "Atualizado hoje" }
        else if days == 1 { text = "Atualizado ontem" }
        else {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "pt_BR")
            formatter.dateFormat = "dd/MM/yyyy"
            text = "Atualizado \(formatter.string(from: date))"
        }
        return (text, style)
    }

    private func parseMoney(_ raw: String) -> Decimal {
        Decimal(string: raw.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")) ?? 0
    }
}
