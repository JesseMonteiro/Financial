import XCTest
import MeuFluxDomain
import MeuFluxData

// Use InMemoryNotificationImportStore from MeuFluxData

private final class MockTxFetcher: ReconciliationTransactionFetching, @unchecked Sendable {
    var transactions: [ReconciliationTransaction] = []

    func fetchTransactions(from: Date, to: Date) async throws -> [ReconciliationTransaction] {
        transactions
    }
}

private final class MockEntityDeleter: ReconcilableEntityDeleting, @unchecked Sendable {
    var deletedMealPurchases: [String] = []
    var deletedManualExpenses: [String] = []

    func deleteMealPurchase(id: String) async throws {
        deletedMealPurchases.append(id)
    }

    func deleteManualExpense(id: String) async throws {
        deletedManualExpenses.append(id)
    }
}

final class OpenFinanceReconcilerTests: XCTestCase {
    func testReconciliationMatchesAndSoftDeletes() async {
        let store = InMemoryNotificationImportStore()
        let fetcher = MockTxFetcher()
        let deleter = MockEntityDeleter()
        let reconciler = OpenFinanceReconciler(
            store: store,
            transactionFetcher: fetcher,
            entityDeleter: deleter
        )

        let purchaseDate = Date()
        let record = NotificationImportRecord(
            id: "rec-1",
            fingerprint: "fp-1",
            status: .imported,
            parsed: ParsedPurchase(
                amount: Money(amount: 150),
                merchant: "Mercado Livre",
                purchasedAt: InstantDate(from: purchaseDate),
                rawTitle: "Nubank",
                rawSubtitle: "",
                rawBody: "150 em Mercado Livre",
                source: .nubank,
                sourceAppName: "Nubank",
                confidence: 1.0
            ),
            createdEntityId: "manual-expense-123",
            createdEntityKind: .manualExpense,
            createdAt: purchaseDate,
            expiresAt: purchaseDate.addingTimeInterval(10 * 24 * 3600)
        )
        await store.upsertRecord(record)

        // Matching transaction arrives via Pluggy: same amount (150.00), within 48h, debit
        fetcher.transactions = [
            ReconciliationTransaction(id: "pluggy-tx-999", amount: 150.00, isDebit: true)
        ]

        await reconciler.reconcile()

        let updated = await store.loadRecords().first(where: { $0.id == "rec-1" })
        XCTAssertNotNil(updated)
        XCTAssertEqual(updated?.status, .reconciledOpenFinance)
        XCTAssertEqual(updated?.reconciledWithTransactionId, "pluggy-tx-999")
        XCTAssertNil(updated?.createdEntityId)
        XCTAssertEqual(deleter.deletedManualExpenses, ["manual-expense-123"])
    }

    func testReconciliationTTLBecomesPermanentWhenExpiredWithoutMatch() async {
        let store = InMemoryNotificationImportStore()
        let fetcher = MockTxFetcher()
        let deleter = MockEntityDeleter()
        let reconciler = OpenFinanceReconciler(
            store: store,
            transactionFetcher: fetcher,
            entityDeleter: deleter
        )

        // Expired purchase (expiresAt is in the past)
        let pastDate = Date().addingTimeInterval(-11 * 24 * 3600)
        let record = NotificationImportRecord(
            id: "rec-expired",
            fingerprint: "fp-2",
            status: .imported,
            parsed: ParsedPurchase(
                amount: Money(amount: 80),
                merchant: "Farmácia",
                purchasedAt: InstantDate(from: pastDate),
                rawTitle: "Nubank",
                rawSubtitle: "",
                rawBody: "80 em Farmácia",
                source: .nubank,
                sourceAppName: "Nubank",
                confidence: 1.0
            ),
            createdEntityId: "manual-expense-456",
            createdEntityKind: .manualExpense,
            createdAt: pastDate,
            expiresAt: Date().addingTimeInterval(-3600) // expired 1h ago
        )
        await store.upsertRecord(record)

        // No transactions from Pluggy
        fetcher.transactions = []

        await reconciler.reconcile()

        let updated = await store.loadRecords().first(where: { $0.id == "rec-expired" })
        XCTAssertNotNil(updated)
        XCTAssertEqual(updated?.status, .imported, "Status permanece imported")
        XCTAssertNil(updated?.expiresAt, "expiresAt é limpo para tornar permanente")
        XCTAssertTrue(deleter.deletedManualExpenses.isEmpty, "Não deve deletar a despesa manual")
    }

    func testReconciliationDoesNotMatchDifferentAmount() async {
        let store = InMemoryNotificationImportStore()
        let fetcher = MockTxFetcher()
        let deleter = MockEntityDeleter()
        let reconciler = OpenFinanceReconciler(
            store: store,
            transactionFetcher: fetcher,
            entityDeleter: deleter
        )

        let purchaseDate = Date()
        let record = NotificationImportRecord(
            id: "rec-diff",
            fingerprint: "fp-3",
            status: .imported,
            parsed: ParsedPurchase(
                amount: Money(amount: 100),
                merchant: "Posto Ipiranga",
                purchasedAt: InstantDate(from: purchaseDate),
                rawTitle: "Nubank",
                rawSubtitle: "",
                rawBody: "100 em Posto Ipiranga",
                source: .nubank,
                sourceAppName: "Nubank",
                confidence: 1.0
            ),
            createdEntityId: "manual-expense-789",
            createdEntityKind: .manualExpense,
            createdAt: purchaseDate,
            expiresAt: purchaseDate.addingTimeInterval(10 * 24 * 3600)
        )
        await store.upsertRecord(record)

        // Transaction with different amount (150 vs 100)
        fetcher.transactions = [
            ReconciliationTransaction(id: "pluggy-tx-other", amount: 150.00, isDebit: true)
        ]

        await reconciler.reconcile()

        let updated = await store.loadRecords().first(where: { $0.id == "rec-diff" })
        XCTAssertEqual(updated?.status, .imported)
        XCTAssertNil(updated?.reconciledWithTransactionId)
        XCTAssertEqual(updated?.createdEntityId, "manual-expense-789")
        XCTAssertTrue(deleter.deletedManualExpenses.isEmpty)
    }
}
