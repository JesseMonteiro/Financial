import Foundation
import MeuFluxCore
import MeuFluxDomain

public actor LiveNotificationImportStore: NotificationImportStoring {
    private let defaults: UserDefaults
    private let rulesKey = "notificationImport.rules"
    private let recordsKey = "notificationImport.records"
    private let pendingKey = "notificationImport.pending"
    private let maxRecords = 500

    public init(defaults: UserDefaults = AppGroup.userDefaults) {
        self.defaults = defaults
    }

    public func loadRules() async -> [NotificationImportRule] {
        decode([NotificationImportRule].self, key: rulesKey) ?? []
    }

    public func saveRules(_ rules: [NotificationImportRule]) async {
        encode(rules, key: rulesKey)
    }

    public func loadRecords() async -> [NotificationImportRecord] {
        decode([NotificationImportRecord].self, key: recordsKey) ?? []
    }

    public func upsertRecord(_ record: NotificationImportRecord) async {
        var records = await loadRecords()
        if let index = records.firstIndex(where: { $0.id == record.id }) {
            records[index] = record
        } else {
            records.insert(record, at: 0)
        }
        records.sort { $0.createdAt > $1.createdAt }
        if records.count > maxRecords {
            records = Array(records.prefix(maxRecords))
        }
        encode(records, key: recordsKey)
    }

    public func record(id: String) async -> NotificationImportRecord? {
        await loadRecords().first { $0.id == id }
    }

    public func findDuplicate(
        fingerprint: String,
        now: Date,
        window: TimeInterval
    ) async -> NotificationImportRecord? {
        await loadRecords().first { record in
            record.fingerprint == fingerprint
                && record.status == .imported
                && now.timeIntervalSince(record.createdAt) <= window
        }
    }

    public func enqueuePending(_ payload: NotificationImportPendingPayload) async {
        var pending = decode([NotificationImportPendingPayload].self, key: pendingKey) ?? []
        pending.append(payload)
        encode(pending, key: pendingKey)
    }

    public func drainPending() async -> [NotificationImportPendingPayload] {
        let pending = decode([NotificationImportPendingPayload].self, key: pendingKey) ?? []
        defaults.removeObject(forKey: pendingKey)
        return pending
    }

    private func decode<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    private func encode<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        defaults.set(data, forKey: key)
    }
}

public actor InMemoryNotificationImportStore: NotificationImportStoring {
    private var rules: [NotificationImportRule] = []
    private var records: [NotificationImportRecord] = []
    private var pending: [NotificationImportPendingPayload] = []

    public init() {}

    public func loadRules() async -> [NotificationImportRule] { rules }

    public func saveRules(_ rules: [NotificationImportRule]) async {
        self.rules = rules
    }

    public func loadRecords() async -> [NotificationImportRecord] { records }

    public func upsertRecord(_ record: NotificationImportRecord) async {
        if let index = records.firstIndex(where: { $0.id == record.id }) {
            records[index] = record
        } else {
            records.insert(record, at: 0)
        }
    }

    public func record(id: String) async -> NotificationImportRecord? {
        records.first { $0.id == id }
    }

    public func findDuplicate(
        fingerprint: String,
        now: Date,
        window: TimeInterval
    ) async -> NotificationImportRecord? {
        records.first { record in
            record.fingerprint == fingerprint
                && record.status == .imported
                && now.timeIntervalSince(record.createdAt) <= window
        }
    }

    public func enqueuePending(_ payload: NotificationImportPendingPayload) async {
        pending.append(payload)
    }

    public func drainPending() async -> [NotificationImportPendingPayload] {
        let drained = pending
        pending = []
        return drained
    }
}
