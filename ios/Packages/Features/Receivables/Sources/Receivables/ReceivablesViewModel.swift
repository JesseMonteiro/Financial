import Foundation
import Observation
import MeuFluxDomain
import MeuFluxDesignSystem

public enum ReceivableRecurrence: String, CaseIterable, Identifiable, Sendable {
    case single
    case parcelado
    case continuous

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .single: return "Lançamento único"
        case .parcelado: return "Parcelado"
        case .continuous: return "Recorrência contínua"
        }
    }
}

public struct ReceivablePersonGroup: Identifiable, Hashable, Sendable {
    public var id: String { personName.lowercased() }
    public var personName: String
    public var personColor: String
    public var receivables: [Receivable]

    public var totalPending: Money {
        receivables.reduce(Money.zero) { $0.adding($1.pendingAmount) }
    }

    public var totalReceived: Money {
        receivables.reduce(Money.zero) { $0.adding($1.receivedAmount) }
    }

    public var progressPercent: Int {
        let due = totalPending.amount
        let paid = totalReceived.amount
        let denom = due + paid
        guard denom > 0 else { return 100 }
        let ratio = NSDecimalNumber(decimal: (paid / denom) * 100).doubleValue
        return min(100, max(0, Int(ratio.rounded())))
    }
}

@Observable
@MainActor
public final class ReceivablesViewModel {
    public private(set) var state: FeatureLoadState<[Receivable]> = .idle
    public private(set) var receivables: [Receivable] = []
    public private(set) var personGroups: [ReceivablePersonGroup] = []
    public private(set) var isSaving = false
    public var errorMessage: String?
    public var expandedPersonIDs: Set<String> = []
    public var expandedReceivableIDs: Set<String> = []
    public var pendingDelete: Receivable?

    public var draftPerson = ""
    public var draftDescription = ""
    public var draftAmount = ""
    public var draftRecurrence: ReceivableRecurrence = .single
    public var draftInstallments = "2"
    public var draftFirstDue = Date()
    public var draftNotes = ""
    public var editingID: String?
    public var personNameLocked = false

    private let repository: (any ReceivablesRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    private static let palette = [
        "#6366F1", "#8B5CF6", "#EC4899", "#F43F5E",
        "#F97316", "#EAB308", "#22C55E", "#14B8A6",
        "#3B82F6", "#06B6D4",
    ]

    public init(repository: (any ReceivablesRepository)? = nil) {
        self.repository = repository
    }

    public var totalToReceive: Money {
        receivables.reduce(Money.zero) { $0.adding($1.pendingAmount) }
    }

    public var totalReceived: Money {
        receivables.reduce(Money.zero) { $0.adding($1.receivedAmount) }
    }

    public var peopleCount: Int {
        Set(receivables.map { $0.personName.lowercased() }).count
    }

    public var nextDueDate: InstantDate? {
        receivables.compactMap(\.nextPendingDue).sorted().first
    }

    public func load(force: Bool = false) async {
        let cacheKey = "receivables"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) { return }
        state.beginLoad(silentIfPossible: true)
        errorMessage = nil
        guard let repository else {
            state = .empty
            return
        }
        do {
            receivables = try await repository.fetchReceivables(force: force)
            rebuildGroups()
            if expandedPersonIDs.isEmpty {
                expandedPersonIDs = Set(personGroups.map(\.id))
            }
            state = receivables.isEmpty ? .empty : .loaded(receivables)
            lastLoadedAt = Date()
            lastCacheKey = cacheKey
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            if !state.hasContent {
                state = .failed(errorMessage ?? "Não foi possível carregar.")
            }
        }
    }

    public func retry() async { await load(force: true) }

    public func togglePerson(_ id: String) {
        if expandedPersonIDs.contains(id) { expandedPersonIDs.remove(id) }
        else { expandedPersonIDs.insert(id) }
    }

    public func toggleReceivable(_ id: String) {
        if expandedReceivableIDs.contains(id) { expandedReceivableIDs.remove(id) }
        else { expandedReceivableIDs.insert(id) }
    }

    public func resetDraft(prefillPerson: String? = nil) {
        editingID = nil
        draftPerson = prefillPerson ?? ""
        draftDescription = ""
        draftAmount = ""
        draftRecurrence = .single
        draftInstallments = "2"
        draftFirstDue = Date()
        draftNotes = ""
        personNameLocked = prefillPerson != nil
    }

    public func beginEdit(_ receivable: Receivable) {
        editingID = receivable.id
        draftPerson = receivable.personName
        draftDescription = receivable.description
        let amount = receivable.originalTotalAmount ?? (
            receivable.isContinuous
                ? (receivable.installmentHistory.first?.amount ?? receivable.amount)
                : receivable.amount
        )
        draftAmount = NSDecimalNumber(decimal: amount.amount).stringValue
        if receivable.isContinuous {
            draftRecurrence = .continuous
        } else if receivable.installments > 1 {
            draftRecurrence = .parcelado
            draftInstallments = String(receivable.installments)
        } else {
            draftRecurrence = .single
        }
        if let due = receivable.installmentHistory.first?.dueDate.date()
            ?? receivable.dueDate?.date() {
            draftFirstDue = due
        }
        draftNotes = receivable.notes ?? ""
        personNameLocked = true
    }

    public func saveDraft() async -> Bool {
        guard let repository else { return false }
        let person = draftPerson.trimmingCharacters(in: .whitespacesAndNewlines)
        let description = draftDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let amountValue = parseMoney(draftAmount)
        guard !person.isEmpty, amountValue > 0 else {
            errorMessage = "Informe o nome da pessoa e o valor."
            return false
        }

        isSaving = true
        defer { isSaving = false }

        let isContinuous = draftRecurrence == .continuous
        let installments = isContinuous
            ? 24
            : (draftRecurrence == .parcelado ? max(2, Int(draftInstallments) ?? 2) : 1)
        let history = buildHistory(
            total: amountValue,
            installments: installments,
            isContinuous: isContinuous,
            firstDue: InstantDate(from: draftFirstDue),
            preserve: editingID.flatMap { id in receivables.first(where: { $0.id == id })?.installmentHistory }
        )
        let paidCount = history.filter(\.isPaid).count
        let storedTotal = isContinuous ? amountValue * 24 : amountValue
        let color = colorForPerson(person)

        let item = Receivable(
            id: editingID ?? UUID().uuidString,
            description: description.isEmpty ? person : description,
            amount: Money(amount: storedTotal),
            dueDate: history.first?.dueDate,
            isReceived: !isContinuous && paidCount >= installments,
            counterparty: person,
            installments: installments,
            paidInstallments: paidCount,
            isContinuous: isContinuous,
            personColor: color,
            originalTotalAmount: Money(amount: amountValue),
            notes: draftNotes.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
            installmentHistory: history
        )

        do {
            try await repository.saveReceivable(item)
            resetDraft()
            await load(force: true)
            return true
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            return false
        }
    }

    public func markInstallmentPaid(receivableID: String, number: Int) async {
        guard let repository,
              var receivable = receivables.first(where: { $0.id == receivableID }) else { return }
        guard let index = receivable.installmentHistory.firstIndex(where: { $0.installmentNumber == number }),
              !receivable.installmentHistory[index].isPaid else { return }

        receivable.installmentHistory[index].paidAt = InstantDate(from: Date())
        receivable.paidInstallments = receivable.installmentHistory.filter(\.isPaid).count
        if !receivable.isContinuous {
            receivable.isReceived = receivable.paidInstallments >= receivable.installments
        }
        do {
            try await repository.saveReceivable(receivable)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func delete(_ receivable: Receivable) async {
        guard let repository else { return }
        do {
            try await repository.deleteReceivable(id: receivable.id)
            pendingDelete = nil
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    // MARK: - Private

    private func rebuildGroups() {
        var map: [String: ReceivablePersonGroup] = [:]
        for receivable in receivables {
            let key = receivable.personName.lowercased()
            if var group = map[key] {
                group.receivables.append(receivable)
                map[key] = group
            } else {
                map[key] = ReceivablePersonGroup(
                    personName: receivable.personName,
                    personColor: receivable.personColor ?? Self.palette[abs(key.hashValue) % Self.palette.count],
                    receivables: [receivable]
                )
            }
        }

        personGroups = map.values
            .map { group in
                var copy = group
                copy.receivables.sort { lhs, rhs in
                    sortKey(lhs).localizedCompare(sortKey(rhs)) == .orderedAscending
                }
                return copy
            }
            .sorted { lhs, rhs in
                let keyA = lhs.receivables.first.map(sortKey) ?? "2"
                let keyB = rhs.receivables.first.map(sortKey) ?? "2"
                if keyA != keyB { return keyA < keyB }
                return lhs.personName.localizedCaseInsensitiveCompare(rhs.personName) == .orderedAscending
            }
    }

    private func sortKey(_ receivable: Receivable) -> String {
        if let pending = receivable.nextPendingDue {
            return "0_\(pending.isoString)"
        }
        let last = receivable.installmentHistory.map(\.dueDate.isoString).sorted().last ?? "9999-12-31"
        return "1_\(last)"
    }

    private func colorForPerson(_ name: String) -> String {
        if let existing = receivables.first(where: { $0.personName.caseInsensitiveCompare(name) == .orderedSame })?.personColor {
            return existing
        }
        return Self.palette[abs(name.lowercased().hashValue) % Self.palette.count]
    }

    private func buildHistory(
        total: Decimal,
        installments: Int,
        isContinuous: Bool,
        firstDue: InstantDate,
        preserve: [ReceivableInstallment]?
    ) -> [ReceivableInstallment] {
        let per = isContinuous ? total : roundMoney(total / Decimal(installments))
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        let base = firstDue.date(calendar: calendar) ?? Date()
        let paidByNumber = (preserve ?? []).reduce(into: [Int: InstantDate?]()) { dict, inst in
            guard inst.isPaid else { return }
            dict[inst.installmentNumber] = inst.paidAt
        }

        return (0..<installments).map { index in
            let date = calendar.date(byAdding: .month, value: index, to: base) ?? base
            let amount: Decimal
            if isContinuous || installments == 1 {
                amount = per
            } else if index == installments - 1 {
                amount = roundMoney(total - per * Decimal(installments - 1))
            } else {
                amount = per
            }
            return ReceivableInstallment(
                installmentNumber: index + 1,
                amount: Money(amount: amount),
                dueDate: InstantDate(from: date, calendar: calendar),
                paidAt: paidByNumber[index + 1] ?? nil
            )
        }
    }

    private func roundMoney(_ value: Decimal) -> Decimal {
        var value = value
        var result = Decimal()
        NSDecimalRound(&result, &value, 2, .plain)
        return result
    }

    private func parseMoney(_ raw: String) -> Decimal {
        Decimal(string: raw.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")) ?? 0
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
