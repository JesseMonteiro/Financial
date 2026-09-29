import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

public enum NotificationHubFilter: String, CaseIterable, Identifiable, Sendable {
    case all = "Todas"
    case imported = "Importadas"
    case ignored = "Ignoradas"
    case pending = "Pendentes"
    
    public var id: String { rawValue }
}

@Observable
@MainActor
public final class NotificationHubViewModel {
    public private(set) var state: FeatureLoadState<[NotificationImportRecord]> = .idle
    public var selectedFilter: NotificationHubFilter = .all
    public private(set) var busyRecordId: String?
    
    private let importer: any NotificationImporting
    
    public init(importer: any NotificationImporting) {
        self.importer = importer
    }
    
    public var records: [NotificationImportRecord] {
        guard case .loaded(let all) = state else { return [] }
        return all
    }
    
    public var filteredRecords: [NotificationImportRecord] {
        let all = records
        switch selectedFilter {
        case .all: return all
        case .imported: return all.filter { $0.status == .imported }
        case .ignored: return all.filter { $0.status == .ignored || $0.status == .skippedOpenFinance || $0.status == .reconciledOpenFinance }
        case .pending: return all.filter { $0.status == .needsReview || $0.status == .needsDestination || $0.status == .queued }
        }
    }
    
    public var counts: (all: Int, imported: Int, ignored: Int, pending: Int) {
        let all = records
        return (
            all: all.count,
            imported: all.filter { $0.status == .imported }.count,
            ignored: all.filter { $0.status == .ignored || $0.status == .skippedOpenFinance || $0.status == .reconciledOpenFinance }.count,
            pending: all.filter { $0.status == .needsReview || $0.status == .needsDestination || $0.status == .queued }.count
        )
    }
    
    public var pendingCount: Int { counts.pending }
    
    public func load() async {
        state.beginLoad(silentIfPossible: true)
        let history = await importer.loadHistory()
        if history.isEmpty {
            state = .empty
        } else {
            // Sort by most recent first
            state = .loaded(history.sorted { $0.createdAt > $1.createdAt })
        }
    }
    
    public func undoImport(_ record: NotificationImportRecord) async {
        busyRecordId = record.id
        defer { busyRecordId = nil }
        _ = await importer.undo(recordId: record.id)
        await load()
    }

    public func deleteRecord(_ record: NotificationImportRecord) async {
        busyRecordId = record.id
        defer { busyRecordId = nil }
        _ = await importer.delete(recordId: record.id)
        await load()
    }

    public func ignoreRecord(_ record: NotificationImportRecord) async {
        busyRecordId = record.id
        defer { busyRecordId = nil }
        _ = await importer.ignore(recordId: record.id)
        await load()
    }

    public func deleteAllIgnored() async {
        let ignoredRecords = records.filter {
            $0.status == .ignored || $0.status == .skippedOpenFinance || $0.status == .reconciledOpenFinance
        }
        for record in ignoredRecords {
            _ = await importer.delete(recordId: record.id)
        }
        await load()
    }
}
