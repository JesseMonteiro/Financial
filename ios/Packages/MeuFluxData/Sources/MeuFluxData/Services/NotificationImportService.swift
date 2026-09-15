import Foundation
import MeuFluxCore
import MeuFluxDomain

public struct NotificationImportService: NotificationImporting, Sendable {
    private let store: any NotificationImportStoring
    private let mealBenefits: any MealBenefitsRepository
    private let manuals: any ManualExpensesRepository
    private let authSession: any AuthSessionActor
    private let logger: AppLogger
    private let categorizer: any PurchaseCategorizing
    private let parseAssistant: (any PurchaseParsingAssisting)?

    public init(
        store: any NotificationImportStoring,
        mealBenefits: any MealBenefitsRepository,
        manuals: any ManualExpensesRepository,
        authSession: any AuthSessionActor,
        logger: AppLogger = AppLogger(),
        categorizer: (any PurchaseCategorizing)? = nil,
        parseAssistant: (any PurchaseParsingAssisting)? = nil
    ) {
        self.store = store
        self.mealBenefits = mealBenefits
        self.manuals = manuals
        self.authSession = authSession
        self.logger = logger
        self.categorizer = categorizer ?? RuleBasedPurchaseCategorizer()
        self.parseAssistant = parseAssistant
    }

    public static func standalone(
        env: EnvConfig = .fromBundle(),
        store: (any NotificationImportStoring)? = nil
    ) -> NotificationImportService {
        let logger = AppLogger(enabled: env.featureFlags.debugLogging)
        let authSession = KeychainAuthSession()
        let authService = SupabaseAuthService(config: env, session: authSession, logger: logger)
        let api = APIClient(
            baseURL: env.apiBaseURL,
            authSession: authSession,
            tokenRefresher: authService,
            logger: logger,
            supabaseAnonKey: env.supabaseAnonKey
        )
        let bff = BFFClient(api: api, cache: CacheActor())
        return NotificationImportService(
            store: store ?? LiveNotificationImportStore(),
            mealBenefits: LiveMealBenefitsRepository(bff: bff),
            manuals: LiveManualExpensesRepository(bff: bff),
            authSession: authSession,
            logger: logger
        )
    }

    public func importFromNotification(
        title: String,
        subtitle: String = "",
        body: String,
        sourceApp: String,
        now: Date = Date()
    ) async -> NotificationImportOutcome {
        let parse = NotificationPurchaseParser.parse(
            title: title,
            subtitle: subtitle,
            body: body,
            sourceApp: sourceApp,
            now: now
        )
        switch parse {
        case .ignored(let reason):
            if let recovered = await recoverWithAssistant(
                title: title,
                subtitle: subtitle,
                body: body,
                sourceApp: sourceApp,
                now: now,
                ignoreReason: reason
            ) {
                return await importParsed(recovered, now: now)
            }
            let record = NotificationImportRecord(
                fingerprint: UUID().uuidString,
                status: .ignored,
                createdAt: now,
                ignoreReason: reason
            )
            await store.upsertRecord(record)
            return .ignored(record)
        case .purchase(let parsed):
            var enriched = parsed
            if enriched.merchant == nil, let recovered = await parseAssistant?.recoverPurchase(
                title: title,
                subtitle: subtitle,
                body: body,
                sourceApp: sourceApp,
                now: now
            ) {
                enriched.merchant = recovered.merchant
            }
            let suggestion = await categorizer.suggest(
                merchant: enriched.merchant,
                source: enriched.source,
                combinedText: enriched.combinedText
            )
            if let merchant = suggestion.merchant {
                enriched.merchant = merchant
            }
            enriched.suggestedCategory = suggestion.kind.rawValue
            return await importParsed(enriched, now: now)
        }
    }

    public func processQueued(now: Date = Date()) async -> [NotificationImportOutcome] {
        guard await authSession.isAuthenticated() else { return [] }
        let pending = await store.drainPending()
        var outcomes: [NotificationImportOutcome] = []
        for payload in pending {
            let outcome = await importFromNotification(
                title: payload.title,
                subtitle: payload.subtitle,
                body: payload.body,
                sourceApp: payload.sourceApp,
                now: payload.receivedAt
            )
            outcomes.append(outcome)
        }
        _ = now
        return outcomes
    }

    public func undo(recordId: String) async -> NotificationImportOutcome {
        guard var record = await store.record(id: recordId) else {
            return .failed("Lançamento não encontrado.")
        }
        do {
            try await deleteCreatedEntity(record)
            record.status = .undone
            record.createdEntityId = nil
            record.createdEntityKind = nil
            await store.upsertRecord(record)
            return .undone(record)
        } catch {
            logger.error("Undo import failed: \(error.localizedDescription)", category: .sync)
            return .failed((error as? FinancialError)?.messagePT ?? error.localizedDescription)
        }
    }

    public func applyReview(
        recordId: String,
        amount: Decimal,
        merchant: String,
        date: InstantDate,
        destination: NotificationImportDestination,
        category: String?
    ) async -> NotificationImportOutcome {
        guard var record = await store.record(id: recordId) else {
            return .failed("Lançamento não encontrado.")
        }
        var parsed = record.parsed ?? ParsedPurchase(
            amount: Money(amount: amount),
            merchant: merchant,
            purchasedAt: date,
            rawTitle: "",
            rawSubtitle: "",
            rawBody: "",
            source: .generic,
            sourceAppName: "",
            confidence: 1
        )
        parsed.amount = Money(amount: amount)
        parsed.merchant = merchant
        parsed.purchasedAt = date
        if let category, !category.isEmpty {
            parsed.suggestedCategory = category
        }
        record.parsed = parsed
        do {
            if record.createdEntityId != nil, record.destination != destination {
                try await deleteCreatedEntity(record)
                record.createdEntityId = nil
                record.createdEntityKind = nil
            }
            try await persist(parsed: parsed, destination: destination, onto: &record)
            record.status = .imported
            await store.upsertRecord(record)
            return .imported(record)
        } catch {
            logger.error("Review import failed: \(error.localizedDescription)", category: .sync)
            return .failed((error as? FinancialError)?.messagePT ?? error.localizedDescription)
        }
    }

    // MARK: - Private

    private func recoverWithAssistant(
        title: String,
        subtitle: String,
        body: String,
        sourceApp: String,
        now: Date,
        ignoreReason: String
    ) async -> ParsedPurchase? {
        let blocked = ignoreReason.contains("Código")
            || ignoreReason.contains("acesso")
            || ignoreReason.contains("saldo")
            || ignoreReason.contains("fatura")
            || ignoreReason.contains("Crédito")
        guard !blocked, parseAssistant != nil else { return nil }
        return await parseAssistant?.recoverPurchase(
            title: title,
            subtitle: subtitle,
            body: body,
            sourceApp: sourceApp,
            now: now
        )
    }

    public func loadRecord(id: String) async -> NotificationImportRecord? {
        await store.record(id: id)
    }

    public func loadHistory() async -> [NotificationImportRecord] {
        await store.loadRecords()
    }

    public func loadRules() async -> [NotificationImportRule] {
        await store.loadRules()
    }

    public func saveRules(_ rules: [NotificationImportRule]) async {
        await store.saveRules(rules)
    }

    // MARK: - Private

    private func importParsed(_ parsed: ParsedPurchase, now: Date) async -> NotificationImportOutcome {
        let fingerprint = NotificationImportFingerprint.make(
            source: parsed.source,
            amount: parsed.amount.amount,
            merchant: parsed.merchant,
            day: parsed.purchasedAt,
            body: parsed.combinedText
        )
        if let duplicate = await store.findDuplicate(
            fingerprint: fingerprint,
            now: now,
            window: NotificationImportFingerprint.duplicateWindow
        ) {
            return .duplicate(duplicate)
        }

        if parsed.confidence < NotificationPurchaseParser.autoSaveConfidenceThreshold {
            let record = NotificationImportRecord(
                fingerprint: fingerprint,
                status: .needsReview,
                parsed: parsed,
                createdAt: now
            )
            await store.upsertRecord(record)
            return .needsReview(record)
        }

        guard await authSession.isAuthenticated() else {
            await store.enqueuePending(
                NotificationImportPendingPayload(
                    title: parsed.rawTitle,
                    subtitle: parsed.rawSubtitle,
                    body: parsed.rawBody,
                    sourceApp: parsed.sourceAppName,
                    receivedAt: now
                )
            )
            let record = NotificationImportRecord(
                fingerprint: fingerprint,
                status: .queued,
                parsed: parsed,
                createdAt: now
            )
            await store.upsertRecord(record)
            return .queued(record)
        }

        let rules = await store.loadRules()
        let rule = rules.first { $0.matches(source: parsed.source, title: parsed.rawTitle) }
            ?? rules.first { $0.enabled && $0.source == .generic && parsed.source == .generic }

        guard let destination = rule?.destination else {
            let record = NotificationImportRecord(
                fingerprint: fingerprint,
                status: .needsDestination,
                parsed: parsed,
                createdAt: now
            )
            await store.upsertRecord(record)
            return .needsDestination(record)
        }

        var record = NotificationImportRecord(
            fingerprint: fingerprint,
            status: .imported,
            parsed: parsed,
            createdAt: now,
            destination: destination
        )
        do {
            try await persist(parsed: parsed, destination: destination, onto: &record)
            await store.upsertRecord(record)
            return .imported(record)
        } catch {
            logger.error("Import persist failed: \(error.localizedDescription)", category: .sync)
            return .failed((error as? FinancialError)?.messagePT ?? error.localizedDescription)
        }
    }

    private func deleteCreatedEntity(_ record: NotificationImportRecord) async throws {
        guard let entityId = record.createdEntityId, let kind = record.createdEntityKind else { return }
        switch kind {
        case .mealPurchase:
            try await mealBenefits.deletePurchase(id: entityId)
        case .manualExpense:
            try await manuals.deleteExpense(id: entityId)
        }
    }

    private func persist(
        parsed: ParsedPurchase,
        destination: NotificationImportDestination,
        onto record: inout NotificationImportRecord
    ) async throws {
        switch destination {
        case .mealBenefit(let benefitId):
            let kind = resolvedCategory(for: parsed)
            let purchase = MealBenefitPurchase(
                id: record.createdEntityId ?? UUID().uuidString,
                benefitId: benefitId,
                amount: parsed.amount,
                purchasedAt: parsed.purchasedAt,
                description: parsed.displayMerchant,
                category: kind.mealBudgetCategory(merchant: parsed.merchant)
            )
            try await mealBenefits.savePurchase(purchase)
            record.createdEntityId = purchase.id
            record.createdEntityKind = .mealPurchase
            record.destination = destination
        case .manualAccount(let accountId):
            let kind = resolvedCategory(for: parsed)
            let expense = ManualExpense(
                id: record.createdEntityId ?? UUID().uuidString,
                description: parsed.displayMerchant,
                amount: parsed.amount,
                date: parsed.purchasedAt,
                category: kind.rawValue,
                accountId: accountId,
                isPaid: true,
                originalDescription: originalDescription(from: parsed),
                paidAt: parsed.purchasedAt
            )
            if record.createdEntityId == nil {
                let saved = try await manuals.createExpense(expense)
                record.createdEntityId = saved.id
            } else {
                try await manuals.updateExpense(expense)
                record.createdEntityId = expense.id
            }
            record.createdEntityKind = .manualExpense
            record.destination = destination
        }
    }

    private func resolvedCategory(for parsed: ParsedPurchase) -> ExpenseCategoryKind {
        if let stored = parsed.suggestedCategory {
            return ExpenseCategoryKind.fromStorage(stored)
        }
        return RuleBasedPurchaseCategorizer.heuristic(
            merchant: parsed.merchant,
            source: parsed.source,
            combinedText: parsed.combinedText
        )
    }

    private func originalDescription(from parsed: ParsedPurchase) -> String {
        let raw = parsed.combinedText.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return "notificação" }
        return "notificação: \(raw)"
    }
}

public actor NotificationImportRuntime {
    public static let shared = NotificationImportRuntime()
    private var service: NotificationImportService?

    public func register(_ service: NotificationImportService) {
        self.service = service
    }

    public func resolve() -> NotificationImportService {
        service ?? .standalone()
    }
}
