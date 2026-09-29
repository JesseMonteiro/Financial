import XCTest
@testable import MeuFluxDomain
@testable import MeuFluxData

final class SamePersonTransferTests: XCTestCase {
    private let date = InstantDate(year: 2026, month: 9, day: 15)

    func testTransactionDetectsSamePersonTransferByCategory() {
        let tx = Transaction(
            id: "tx-1",
            accountId: "acc-1",
            description: "Transferência recebida",
            amount: Money(amount: 1500),
            date: date,
            category: "Same person transfer",
            kind: .credit
        )
        XCTAssertTrue(tx.isSamePersonTransfer)

        let txPix = Transaction(
            id: "tx-2",
            accountId: "acc-1",
            description: "Pix enviado",
            amount: Money(amount: 500),
            date: date,
            category: "Same person transfer - PIX",
            kind: .debit
        )
        XCTAssertTrue(txPix.isSamePersonTransfer)
    }

    func testTransactionDetectsSamePersonTransferByDescription() {
        let tx = Transaction(
            id: "tx-3",
            accountId: "acc-1",
            description: "TRANSF PROPRIA MESMA TITULARIDADE",
            amount: Money(amount: 800),
            date: date,
            category: "Transfers",
            kind: .debit
        )
        XCTAssertTrue(tx.isSamePersonTransfer)

        let txNormal = Transaction(
            id: "tx-4",
            accountId: "acc-1",
            description: "Supermercado Pão de Açúcar",
            amount: Money(amount: 250),
            date: date,
            category: "Food and drinks",
            kind: .debit
        )
        XCTAssertFalse(txNormal.isSamePersonTransfer)
    }

    func testDomainMapperFiltersSamePersonTransferFromCategoryExpenses() {
        let json = """
        {
            "display_name": "Jesse",
            "selected_month": "2026-09",
            "calculation_version": "2026.09.2",
            "summary": {
                "net_worth": 6000.0,
                "bank_balance": 1000.0,
                "reserved_balance": 0.0,
                "investment_total": 5000.0,
                "credit_debt": 0.0,
                "open_bills_total": 0.0,
                "loans_total": 0.0,
                "total_assets": 6000.0,
                "bank_count": 1,
                "credit_count": 0
            },
            "cashflow": {
                "income": 5000.0,
                "expense": 2000.0,
                "net": 3000.0,
                "savings_rate": 0.6
            },
            "month_over_month": {
                "expense_delta_pct": 0.0,
                "current_expense": 2000.0,
                "previous_expense": 2000.0
            },
            "category_expenses": [
                { "name": "Transferência entre mesma pessoa", "value": 1500.0, "color": "#6366f1" },
                { "name": "Alimentação", "value": 450.0, "color": "#f97316" }
            ],
            "net_worth_series": [],
            "income_expense_series": [],
            "insights": [],
            "weekly_recap": { "total": 450.0, "delta_pct": 0.0 },
            "recent_transactions": [],
            "budget_categories": []
        }
        """.data(using: .utf8)!

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let dto = try! decoder.decode(DashboardDTO.self, from: json)
        let snap = DomainMapper.dashboard(dto)

        XCTAssertEqual(snap.categoryExpenses.count, 1)
        XCTAssertEqual(snap.categoryExpenses.first?.name, "Alimentação")
        XCTAssertEqual(snap.categoryExpenses.first?.value.amount, 450.0)
    }
}
