import XCTest
@testable import MeuFluxDomain

final class CreditLimitUsageTests: XCTestCase {
    func testFreePercentUsesOpenBillWhenBankReportsFullLimit() {
        let percent = CreditLimitUsage.freePercent(
            creditLimit: 10_000,
            reportedAvailable: 10_000,
            outstanding: 0,
            utilizedBills: 2_500
        )
        XCTAssertEqual(percent, 75)

        let available = CreditLimitUsage.available(
            creditLimit: 10_000,
            reportedAvailable: 10_000,
            outstanding: 0,
            utilizedBills: 2_500
        )
        XCTAssertEqual(available.amount, 7_500)
    }

    func testFreePercentPrefersBankUsedLimitOverSmallerOpenBill() {
        let percent = CreditLimitUsage.freePercent(
            creditLimit: 10_000,
            reportedAvailable: 6_000,
            outstanding: 4_000,
            utilizedBills: 1_200
        )
        XCTAssertEqual(percent, 60)
    }

    func testFreePercentRoundsInsteadOfTruncatingSmallUsage() {
        let percent = CreditLimitUsage.freePercent(
            creditLimit: 10_000,
            reportedAvailable: 9_960,
            outstanding: 40,
            utilizedBills: 40
        )
        XCTAssertEqual(percent, 100)

        let halfPercent = CreditLimitUsage.freePercent(
            creditLimit: 1_000,
            reportedAvailable: 995,
            outstanding: 5,
            utilizedBills: 5
        )
        XCTAssertEqual(halfPercent, 99)
    }

    func testScreenResolvesRenamedCardOnStatementLine() {
        let card = CreditCardSummary(
            id: "card-1",
            name: "Cartão do casal",
            institutionName: "Nubank",
            lastFour: "1234",
            outstanding: .zero,
            openTotal: Money(amount: 200),
            creditLimit: Money(amount: 5_000),
            availableLimit: Money(amount: 5_000)
        )
        let openBill = CreditBillBucket(
            dueMonth: "2026-09",
            title: "Setembro",
            type: .currentOpen,
            total: Money(amount: 1_250),
            dueDateShort: "10/09",
            isPaid: false,
            hasOfficial: false,
            items: []
        )
        let screen = CreditCardsScreen(
            cards: [card],
            outstandingTotal: .zero,
            creditLimitTotal: Money(amount: 5_000),
            availableLimitTotal: Money(amount: 5_000),
            periods: [
                "card-1": CreditBillPeriod(openDueKey: "2026-09", bills: [openBill]),
                CreditCardsScreen.allCardsId: CreditBillPeriod(openDueKey: "2026-09", bills: [openBill]),
            ]
        )
        XCTAssertEqual(screen.displayName(forAccountId: "card-1"), "Cartão do casal")
        XCTAssertEqual(screen.limitFreePercent(cardId: "card-1"), 75)
        XCTAssertEqual(screen.resolvedAvailableLimit(cardId: "card-1").amount, 3_750)
    }

    func testYearMonthShortAxisLabelIsReadable() {
        XCTAssertEqual(YearMonth(year: 2026, month: 9).shortAxisLabel, "set/26")
        XCTAssertEqual(YearMonth(year: 2025, month: 1).shortAxisLabel, "jan/25")
    }

    func testUtilizedTotalIgnoresPaidPastBills() {
        let period = CreditBillPeriod(
            openDueKey: "2026-09",
            bills: [
                CreditBillBucket(
                    dueMonth: "2026-08",
                    title: "Agosto",
                    type: .past,
                    total: Money(amount: 800),
                    dueDateShort: "10/08",
                    isPaid: true,
                    hasOfficial: true,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-09",
                    title: "Setembro",
                    type: .currentOpen,
                    total: Money(amount: 1_200),
                    dueDateShort: "10/09",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
                CreditBillBucket(
                    dueMonth: "2026-10",
                    title: "Outubro",
                    type: .future,
                    total: Money(amount: 300),
                    dueDateShort: "10/10",
                    isPaid: false,
                    hasOfficial: false,
                    items: []
                ),
            ]
        )
        XCTAssertEqual(period.utilizedTotal, 1_500)
    }
}
