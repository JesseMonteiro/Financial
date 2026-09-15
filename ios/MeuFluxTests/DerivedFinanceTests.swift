import XCTest
@testable import MeuFluxDomain
@testable import MeuFluxData

final class DerivedFinanceTests: XCTestCase {
    func testDetectsRecurringDebitsAsSubscriptions() {
        let txs = [
            Transaction(
                id: "1",
                accountId: "a",
                description: "NETFLIX",
                amount: Money(amount: 39.9),
                date: InstantDate(year: 2026, month: 7, day: 10),
                kind: .debit
            ),
            Transaction(
                id: "2",
                accountId: "a",
                description: "NETFLIX",
                amount: Money(amount: 39.9),
                date: InstantDate(year: 2026, month: 8, day: 10),
                kind: .debit
            ),
        ]
        let subs = DerivedFinance.detectSubscriptions(transactions: txs, manuals: [])
        XCTAssertEqual(subs.count, 1)
        XCTAssertEqual(subs.first?.name, "NETFLIX")
    }

    func testAgendaIncludesUnpaidBillsInMonth() {
        let month = YearMonth(year: 2026, month: 9)
        let items = DerivedFinance.buildAgenda(
            month: month,
            bills: [
                Bill(
                    id: "b1",
                    accountId: "c1",
                    dueMonth: month,
                    dueDate: InstantDate(year: 2026, month: 9, day: 12),
                    totalAmount: Money(amount: 100),
                    status: .open,
                    isPaid: false
                )
            ],
            manuals: [],
            loans: [],
            receivables: []
        )
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.kind, .bill)
    }
}

