import Foundation
import OSLog
import MeuFluxDomain

public protocol ReconciliationTransactionFetching: Sendable {
    func fetchTransactions(from: Date, to: Date) async throws -> [ReconciliationTransaction]
}

public struct ReconciliationTransaction: Sendable {
    public let id: String
    public let amount: Decimal
    public let isDebit: Bool
    
    public init(id: String, amount: Decimal, isDebit: Bool) {
        self.id = id
        self.amount = amount
        self.isDebit = isDebit
    }
}

public protocol ReconcilableEntityDeleting: Sendable {
    func deleteMealPurchase(id: String) async throws
    func deleteManualExpense(id: String) async throws
}

public struct OpenFinanceReconciler: Sendable {
    private let store: any NotificationImportStoring
    private let transactionFetcher: any ReconciliationTransactionFetching
    private let entityDeleter: any ReconcilableEntityDeleting
    private let logger: Logger

    public init(
        store: any NotificationImportStoring,
        transactionFetcher: any ReconciliationTransactionFetching,
        entityDeleter: any ReconcilableEntityDeleting,
        logger: Logger = Logger(subsystem: "com.meuflux.app", category: "sync")
    ) {
        self.store = store
        self.transactionFetcher = transactionFetcher
        self.entityDeleter = entityDeleter
        self.logger = logger
    }

    /// Run reconciliation: match imported purchases against Pluggy transactions.
    /// - Purchases with `expiresAt` set are provisional.
    /// - If a matching Pluggy transaction is found, soft-delete the manual entry.
    /// - If TTL expires without a match, the purchase becomes permanent.
    public func reconcile() async {
        let records = await store.loadRecords()
        let candidates = records.filter { record in
            record.status == .imported
                && record.expiresAt != nil
                && record.reconciledWithTransactionId == nil
        }

        guard !candidates.isEmpty else { return }
        logger.info("OpenFinanceReconciler: verificando \(candidates.count) compras provisórias")

        for var record in candidates {
            if let expiry = record.expiresAt, Date() > expiry {
                logger.info("Compra provisória expirou sem match. Tornando permanente.")
                record.expiresAt = nil
                await store.upsertRecord(record)
                continue
            }

            guard let parsed = record.parsed,
                  let purchaseDate = parsed.purchasedAt.date() else { continue }

            let windowSeconds: TimeInterval = 48 * 3600 // ±48h
            let from = purchaseDate.addingTimeInterval(-windowSeconds)
            let to = purchaseDate.addingTimeInterval(windowSeconds)

            do {
                let transactions = try await transactionFetcher.fetchTransactions(from: from, to: to)
                let match = transactions.first { tx in
                    let txAmount = abs(tx.amount)
                    let recordAmount = abs(parsed.amount.amount)
                    return abs(txAmount - recordAmount) < Decimal(string: "0.02")!
                        && tx.isDebit
                }

                if let match {
                    record.status = .reconciledOpenFinance
                    record.reconciledWithTransactionId = match.id

                    if let entityId = record.createdEntityId,
                       let kind = record.createdEntityKind {
                        do {
                            switch kind {
                            case .mealPurchase:
                                try await entityDeleter.deleteMealPurchase(id: entityId)
                            case .manualExpense:
                                try await entityDeleter.deleteManualExpense(id: entityId)
                            }
                        } catch {
                            logger.error("Falha ao excluir entidade reconciliada \(entityId): \(error.localizedDescription)")
                        }
                    }

                    record.createdEntityId = nil
                    record.createdEntityKind = nil
                    await store.upsertRecord(record)
                    logger.info("Compra reconciliada → tx \(match.id)")
                }
            } catch {
                logger.error("Erro ao buscar transações para reconciliação: \(error.localizedDescription)")
            }
        }
    }
}

public struct LiveReconciliationTransactionFetcher: ReconciliationTransactionFetching {
    private let bff: BFFClient

    public init(bff: BFFClient) {
        self.bff = bff
    }

    public func fetchTransactions(from: Date, to: Date) async throws -> [ReconciliationTransaction] {
        let formatter = ISO8601DateFormatter()
        let fromStr = formatter.string(from: from)
        let toStr = formatter.string(from: to)
        let dtos = try await bff.getTransactions(from: fromStr, to: toStr, force: true)
        return dtos.map { dto in
            ReconciliationTransaction(
                id: dto.id,
                amount: dto.amount,
                isDebit: (dto.type ?? "DEBIT").uppercased() == "DEBIT"
            )
        }
    }
}

public struct LiveReconcilableEntityDeleter: ReconcilableEntityDeleting {
    private let mealBenefits: any MealBenefitsRepository
    private let manuals: any ManualExpensesRepository

    public init(mealBenefits: any MealBenefitsRepository, manuals: any ManualExpensesRepository) {
        self.mealBenefits = mealBenefits
        self.manuals = manuals
    }

    public func deleteMealPurchase(id: String) async throws {
        try await mealBenefits.deletePurchase(id: id)
    }

    public func deleteManualExpense(id: String) async throws {
        try await manuals.deleteExpense(id: id)
    }
}

extension OpenFinanceReconciler {
    public static func live(
        store: any NotificationImportStoring,
        bff: BFFClient,
        mealBenefits: any MealBenefitsRepository,
        manuals: any ManualExpensesRepository
    ) -> OpenFinanceReconciler {
        OpenFinanceReconciler(
            store: store,
            transactionFetcher: LiveReconciliationTransactionFetcher(bff: bff),
            entityDeleter: LiveReconcilableEntityDeleter(mealBenefits: mealBenefits, manuals: manuals)
        )
    }
}

