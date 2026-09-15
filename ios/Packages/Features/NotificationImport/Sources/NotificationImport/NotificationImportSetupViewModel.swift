import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem
#if canImport(UserNotifications)
import UserNotifications
#endif

@Observable
@MainActor
public final class NotificationImportSetupViewModel {
    public private(set) var state: FeatureLoadState<[NotificationImportSource]> = .idle
    public private(set) var rules: [NotificationImportRule] = []
    public private(set) var history: [NotificationImportRecord] = []
    public private(set) var benefits: [MealBenefit] = []
    public private(set) var manualAccounts: [Account] = []
    public private(set) var notificationsGranted = false
    public var errorMessage: String?
    public var pasteText = ""
    public var pasteSourceApp = "Alelo"
    public var lastPasteResult: String?
    public var configuringSource: NotificationImportSource?

    private let importer: (any NotificationImporting)?
    private let mealBenefits: (any MealBenefitsRepository)?
    private let accounts: (any AccountsRepository)?

    public init(
        importer: (any NotificationImporting)? = nil,
        mealBenefits: (any MealBenefitsRepository)? = nil,
        accounts: (any AccountsRepository)? = nil
    ) {
        self.importer = importer
        self.mealBenefits = mealBenefits
        self.accounts = accounts
    }

    public var destinationOptions: [NotificationImportDestinationOption] {
        let mealOptions = benefits.map {
            NotificationImportDestinationOption(
                id: "meal:\($0.id)",
                label: "VA/VR · \($0.displayLabel)",
                destination: .mealBenefit(id: $0.id)
            )
        }
        let accountOptions = manualAccounts.map {
            NotificationImportDestinationOption(
                id: "account:\($0.id)",
                label: "Conta · \($0.name)",
                destination: .manualAccount(id: $0.id)
            )
        }
        return mealOptions + accountOptions
    }

    public func load() async {
        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        await refreshPermission()
        guard let importer else {
            state = .empty
            return
        }
        do {
            async let loadedRules = importer.loadRules()
            async let loadedHistory = importer.loadHistory()
            if let mealBenefits {
                benefits = try await mealBenefits.fetchBenefits(force: false)
            }
            if let accounts {
                let all = try await accounts.fetchAccounts(force: false)
                manualAccounts = all.filter(\.isManual)
            }
            rules = await loadedRules
            history = await loadedHistory
            state = .loaded(NotificationImportSource.allCases)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar.")
            }
        }
    }

    public func rule(for source: NotificationImportSource) -> NotificationImportRule? {
        rules.first { $0.source == source }
    }

    public func isEnabled(_ source: NotificationImportSource) -> Bool {
        rule(for: source)?.enabled == true
    }

    public func destinationLabel(for source: NotificationImportSource) -> String {
        guard let destination = rule(for: source)?.destination else {
            return "Escolher destino"
        }
        return destinationOptions.first { $0.destination == destination }?.label ?? "Destino configurado"
    }

    public func setEnabled(_ source: NotificationImportSource, enabled: Bool) async {
        if enabled, rule(for: source) == nil {
            configuringSource = source
            return
        }
        var next = rules
        if let index = next.firstIndex(where: { $0.source == source }) {
            next[index].enabled = enabled
        }
        await persistRules(next)
    }

    public func assignDestination(_ option: NotificationImportDestinationOption, to source: NotificationImportSource) async {
        var next = rules
        if let index = next.firstIndex(where: { $0.source == source }) {
            next[index].destination = option.destination
            next[index].enabled = true
        } else {
            next.append(
                NotificationImportRule(
                    source: source,
                    destination: option.destination,
                    enabled: true
                )
            )
        }
        configuringSource = nil
        await persistRules(next)
    }

    public func requestNotificationPermission() async {
        #if canImport(UserNotifications)
        do {
            notificationsGranted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
        } catch {
            notificationsGranted = false
        }
        #endif
    }

    public func importPastedText() async {
        guard let importer else { return }
        let text = pasteText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            lastPasteResult = "Cole o texto da notificação."
            return
        }
        let outcome = await importer.importFromNotification(
            title: pasteSourceApp,
            subtitle: "",
            body: text,
            sourceApp: pasteSourceApp,
            now: Date()
        )
        lastPasteResult = outcome.dialogText
        history = await importer.loadHistory()
    }

    public func refreshPermission() async {
        #if canImport(UserNotifications)
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        notificationsGranted = settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional
        #if os(iOS)
        notificationsGranted = notificationsGranted || settings.authorizationStatus == .ephemeral
        #endif
        #endif
    }

    private func persistRules(_ next: [NotificationImportRule]) async {
        guard let importer else { return }
        await importer.saveRules(next)
        rules = await importer.loadRules()
    }
}

public struct NotificationImportDestinationOption: Identifiable, Hashable, Sendable {
    public var id: String
    public var label: String
    public var destination: NotificationImportDestination

    public init(id: String, label: String, destination: NotificationImportDestination) {
        self.id = id
        self.label = label
        self.destination = destination
    }
}

@Observable
@MainActor
public final class ImportReviewViewModel {
    public private(set) var record: NotificationImportRecord?
    public var amountText = ""
    public var merchant = ""
    public var date = Date()
    public var selectedDestinationId: String?
    public var selectedCategory: ExpenseCategoryKind = .other
    public var errorMessage: String?
    public var isSaving = false

    public private(set) var destinationOptions: [NotificationImportDestinationOption] = []
    private let importer: (any NotificationImporting)?
    private let mealBenefits: (any MealBenefitsRepository)?
    private let accounts: (any AccountsRepository)?
    private let recordId: String

    public init(
        recordId: String,
        importer: (any NotificationImporting)? = nil,
        mealBenefits: (any MealBenefitsRepository)? = nil,
        accounts: (any AccountsRepository)? = nil
    ) {
        self.recordId = recordId
        self.importer = importer
        self.mealBenefits = mealBenefits
        self.accounts = accounts
    }

    public func load() async {
        destinationOptions = await Self.loadDestinationOptions(
            mealBenefits: mealBenefits,
            accounts: accounts
        )
        guard let importer else { return }
        record = await importer.loadRecord(id: recordId)
        guard let parsed = record?.parsed else { return }
        amountText = NSDecimalNumber(decimal: parsed.amount.amount).stringValue
        merchant = parsed.displayMerchant
        date = parsed.purchasedAt.date() ?? Date()
        selectedCategory = ExpenseCategoryKind.fromStorage(parsed.suggestedCategory)
        if selectedCategory == .other {
            selectedCategory = RuleBasedPurchaseCategorizer.heuristic(
                merchant: parsed.merchant,
                source: parsed.source,
                combinedText: parsed.combinedText
            )
        }
        if let destination = record?.destination {
            selectedDestinationId = destinationOptions.first { $0.destination == destination }?.id
        } else {
            selectedDestinationId = destinationOptions.first?.id
        }
    }

    public func save() async -> Bool {
        guard let importer, let option = destinationOptions.first(where: { $0.id == selectedDestinationId }) else {
            errorMessage = "Escolha a conta de destino."
            return false
        }
        let amount = Decimal(string: amountText.replacingOccurrences(of: ",", with: ".")) ?? 0
        guard amount > 0 else {
            errorMessage = "Informe o valor da compra."
            return false
        }
        isSaving = true
        defer { isSaving = false }
        let outcome = await importer.applyReview(
            recordId: recordId,
            amount: amount,
            merchant: merchant.trimmingCharacters(in: .whitespacesAndNewlines),
            date: InstantDate(from: date),
            destination: option.destination,
            category: selectedCategory.rawValue
        )
        if case .failed(let message) = outcome {
            errorMessage = message
            return false
        }
        return true
    }

    public func undo() async -> Bool {
        guard let importer else { return false }
        let outcome = await importer.undo(recordId: recordId)
        if case .failed(let message) = outcome {
            errorMessage = message
            return false
        }
        return true
    }

    public static func loadDestinationOptions(
        mealBenefits: (any MealBenefitsRepository)?,
        accounts: (any AccountsRepository)?
    ) async -> [NotificationImportDestinationOption] {
        var options: [NotificationImportDestinationOption] = []
        if let mealBenefits {
            let benefits = (try? await mealBenefits.fetchBenefits(force: false)) ?? []
            options.append(contentsOf: benefits.map {
                NotificationImportDestinationOption(
                    id: "meal:\($0.id)",
                    label: "VA/VR · \($0.displayLabel)",
                    destination: .mealBenefit(id: $0.id)
                )
            })
        }
        if let accounts {
            let all = (try? await accounts.fetchAccounts(force: false)) ?? []
            options.append(contentsOf: all.filter(\.isManual).map {
                NotificationImportDestinationOption(
                    id: "account:\($0.id)",
                    label: "Conta · \($0.name)",
                    destination: .manualAccount(id: $0.id)
                )
            })
        }
        return options
    }
}
