import XCTest
import MeuFluxDomain
import NotificationImport

private final class MockImporter: NotificationImporting, @unchecked Sendable {
    var history: [NotificationImportRecord] = []
    var undoneIds: [String] = []

    func loadHistory() async -> [NotificationImportRecord] {
        history
    }

    func loadRecord(id: String) async -> NotificationImportRecord? {
        history.first(where: { $0.id == id })
    }

    func undo(recordId: String) async -> NotificationImportOutcome {
        undoneIds.append(recordId)
        if let idx = history.firstIndex(where: { $0.id == recordId }) {
            history[idx].status = .undone
            return .undone(history[idx])
        }
        return .failed("Not found")
    }

    func importFromNotification(title: String, subtitle: String, body: String, sourceApp: String, now: Date) async -> NotificationImportOutcome {
        .failed("Stub")
    }

    func importDirectTransaction(amount: Decimal, merchant: String, cardName: String, date: Date) async -> NotificationImportOutcome {
        .failed("Stub")
    }

    var deletedIds: [String] = []

    func delete(recordId: String) async -> Bool {
        deletedIds.append(recordId)
        history.removeAll { $0.id == recordId }
        return true
    }

    func ignore(recordId: String) async -> NotificationImportOutcome {
        if let idx = history.firstIndex(where: { $0.id == recordId }) {
            history[idx].status = .ignored
            return .ignored(history[idx])
        }
        return .failed("Not found")
    }

    func processQueued(now: Date) async -> [NotificationImportOutcome] { [] }
    func loadRules() async -> [NotificationImportRule] { [] }
    func saveRules(_ rules: [NotificationImportRule]) async {}
    func applyReview(
        recordId: String,
        amount: Decimal,
        merchant: String,
        date: InstantDate,
        destination: NotificationImportDestination,
        category: String?
    ) async -> NotificationImportOutcome {
        .failed("Stub")
    }
}

final class NotificationHubViewModelTests: XCTestCase {
    @MainActor
    func testNotificationHubViewModelFiltersAndCounts() async {
        let importer = MockImporter()
        let now = Date()

        let recImported = NotificationImportRecord(
            id: "rec-1",
            fingerprint: "fp-1",
            status: .imported,
            createdAt: now.addingTimeInterval(-100)
        )
        let recPending = NotificationImportRecord(
            id: "rec-2",
            fingerprint: "fp-2",
            status: .needsReview,
            createdAt: now.addingTimeInterval(-50)
        )
        let recIgnored = NotificationImportRecord(
            id: "rec-3",
            fingerprint: "fp-3",
            status: .ignored,
            createdAt: now.addingTimeInterval(-200)
        )
        let recReconciled = NotificationImportRecord(
            id: "rec-4",
            fingerprint: "fp-4",
            status: .reconciledOpenFinance,
            createdAt: now
        )

        importer.history = [recImported, recPending, recIgnored, recReconciled]

        let viewModel = NotificationHubViewModel(importer: importer)
        await viewModel.load()

        // Counts
        XCTAssertEqual(viewModel.counts.all, 4)
        XCTAssertEqual(viewModel.counts.imported, 1)
        XCTAssertEqual(viewModel.counts.pending, 1)
        XCTAssertEqual(viewModel.counts.ignored, 2, "Ignored includes .ignored and .reconciledOpenFinance")
        XCTAssertEqual(viewModel.pendingCount, 1)

        // Filter: All (sorted newest first)
        viewModel.selectedFilter = .all
        XCTAssertEqual(viewModel.filteredRecords.count, 4)
        XCTAssertEqual(viewModel.filteredRecords.first?.id, "rec-4")

        // Filter: Imported
        viewModel.selectedFilter = .imported
        XCTAssertEqual(viewModel.filteredRecords.count, 1)
        XCTAssertEqual(viewModel.filteredRecords.first?.id, "rec-1")

        // Filter: Pending
        viewModel.selectedFilter = .pending
        XCTAssertEqual(viewModel.filteredRecords.count, 1)
        XCTAssertEqual(viewModel.filteredRecords.first?.id, "rec-2")

        // Filter: Ignored
        viewModel.selectedFilter = .ignored
        XCTAssertEqual(viewModel.filteredRecords.count, 2)
    }

    @MainActor
    func testUndoImport() async {
        let importer = MockImporter()
        let rec = NotificationImportRecord(
            id: "rec-to-undo",
            fingerprint: "fp-undo",
            status: .imported,
            createdAt: Date()
        )
        importer.history = [rec]

        let viewModel = NotificationHubViewModel(importer: importer)
        await viewModel.load()
        XCTAssertEqual(viewModel.records.first?.status, .imported)

        await viewModel.undoImport(rec)

        XCTAssertEqual(importer.undoneIds, ["rec-to-undo"])
        XCTAssertEqual(viewModel.records.first?.status, .undone)
    }

    @MainActor
    func testDeleteIgnoredNotification() async {
        let importer = MockImporter()
        let recIgnored = NotificationImportRecord(
            id: "rec-ignored-1",
            fingerprint: "fp-ign-1",
            status: .ignored,
            createdAt: Date()
        )
        importer.history = [recIgnored]

        let viewModel = NotificationHubViewModel(importer: importer)
        await viewModel.load()
        XCTAssertEqual(viewModel.counts.ignored, 1)

        await viewModel.deleteRecord(recIgnored)

        XCTAssertEqual(importer.deletedIds, ["rec-ignored-1"])
        XCTAssertEqual(viewModel.counts.ignored, 0)
        XCTAssertTrue(viewModel.records.isEmpty)
    }

    @MainActor
    func testDeleteAllIgnored() async {
        let importer = MockImporter()
        let rec1 = NotificationImportRecord(
            id: "ign-1",
            fingerprint: "fp-1",
            status: .ignored,
            createdAt: Date()
        )
        let rec2 = NotificationImportRecord(
            id: "ign-2",
            fingerprint: "fp-2",
            status: .skippedOpenFinance,
            createdAt: Date()
        )
        let recImported = NotificationImportRecord(
            id: "imp-1",
            fingerprint: "fp-3",
            status: .imported,
            createdAt: Date()
        )
        importer.history = [rec1, rec2, recImported]

        let viewModel = NotificationHubViewModel(importer: importer)
        await viewModel.load()
        XCTAssertEqual(viewModel.counts.ignored, 2)
        XCTAssertEqual(viewModel.counts.imported, 1)

        await viewModel.deleteAllIgnored()

        XCTAssertTrue(importer.deletedIds.contains("ign-1"))
        XCTAssertTrue(importer.deletedIds.contains("ign-2"))
        XCTAssertFalse(importer.deletedIds.contains("imp-1"))
        XCTAssertEqual(viewModel.counts.ignored, 0)
        XCTAssertEqual(viewModel.counts.imported, 1)
    }
}
