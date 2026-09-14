import Foundation
import FinancialDomain

enum DerivedFinance {
    static func detectSubscriptions(
        transactions: [Transaction],
        manuals: [ManualExpense]
    ) -> [Subscription] {
        var groups: [String: [Transaction]] = [:]
        for tx in transactions where tx.kind == .debit {
            let key = normalize(tx.description)
            guard key.count >= 4, !isBlocked(key) else { continue }
            groups[key, default: []].append(tx)
        }

        var results: [Subscription] = []
        for (key, txs) in groups where txs.count >= 2 {
            let amounts = txs.map(\.amount.amount).sorted()
            let median = amounts[amounts.count / 2]
            let billingDay = txs.compactMap(\.date.day).max()
            results.append(
                Subscription(
                    id: key,
                    name: txs.last?.description ?? key,
                    amount: Money(amount: median),
                    billingDay: billingDay,
                    category: txs.last?.category,
                    isActive: true
                )
            )
        }

        for manual in manuals where manual.isRecurring {
            let key = normalize(manual.description)
            if results.contains(where: { normalize($0.name) == key }) { continue }
            results.append(
                Subscription(
                    id: "manual_\(manual.id)",
                    name: manual.description,
                    amount: manual.amount,
                    billingDay: manual.date.day,
                    category: manual.category,
                    isActive: true
                )
            )
        }

        return results.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func buildAgenda(
        month: YearMonth,
        bills: [Bill],
        manuals: [ManualExpense],
        loans: [Loan],
        receivables: [Receivable]
    ) -> [AgendaItem] {
        var items: [AgendaItem] = []

        for bill in bills {
            let date = bill.dueDate ?? InstantDate(year: bill.dueMonth.year, month: bill.dueMonth.month, day: 1)
            guard date.yearMonth == month || (!bill.isPaid && date < InstantDate(from: Date())) else { continue }
            items.append(
                AgendaItem(
                    id: "bill_\(bill.id)",
                    title: "Fatura \(bill.dueMonth.key)",
                    date: date,
                    amount: bill.totalAmount,
                    kind: .bill,
                    isCompleted: bill.isPaid
                )
            )
        }

        for manual in manuals where manual.date.yearMonth == month {
            items.append(
                AgendaItem(
                    id: "manual_\(manual.id)",
                    title: manual.description,
                    date: manual.date,
                    amount: manual.amount,
                    kind: .custom,
                    isCompleted: manual.isPaid
                )
            )
        }

        for loan in loans {
            guard let due = loan.nextDueDate, due.yearMonth == month else { continue }
            items.append(
                AgendaItem(
                    id: "loan_\(loan.id)",
                    title: loan.name,
                    date: due,
                    amount: loan.installmentAmount ?? loan.outstandingBalance,
                    kind: .loan,
                    isCompleted: false
                )
            )
        }

        for receivable in receivables where !receivable.isReceived {
            let date = receivable.dueDate ?? InstantDate(year: month.year, month: month.month, day: 1)
            items.append(
                AgendaItem(
                    id: "recv_\(receivable.id)",
                    title: receivable.counterparty ?? receivable.description,
                    date: date,
                    amount: receivable.amount,
                    kind: .receivable,
                    isCompleted: receivable.isReceived
                )
            )
        }

        return items.sorted { $0.date < $1.date }
    }

    private static func normalize(_ value: String) -> String {
        value
            .folding(options: .diacriticInsensitive, locale: .current)
            .lowercased()
            .replacingOccurrences(of: #"\s*\(\d+/\d+\)"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func isBlocked(_ value: String) -> Bool {
        let blocked = ["uber", "ifood", "rappi", "padaria", "posto", "supermercado", "mercado livre", "shopee"]
        return blocked.contains { value.contains($0) }
    }
}

