import XCTest
@testable import MeuFluxDomain

final class MoneyTests: XCTestCase {
    func testBRLFormattingUsesDecimalNotDouble() {
        let money = Money(amount: Decimal(string: "1234.56")!, currencyCode: "BRL")
        let formatted = money.formatted(locale: Locale(identifier: "pt_BR"))
        XCTAssertTrue(formatted.contains("1.234,56") || formatted.contains("1234,56"))
        XCTAssertEqual(money.amount, Decimal(string: "1234.56")!)
    }

    func testAddingAndSubtracting() {
        let a = Money(amount: Decimal(string: "10.00")!)
        let b = Money(amount: Decimal(string: "2.50")!)
        XCTAssertEqual(a.adding(b).amount, Decimal(string: "12.50")!)
        XCTAssertEqual(a.subtracting(b).amount, Decimal(string: "7.50")!)
    }

    func testComparison() {
        XCTAssertTrue(Money(amount: 1) < Money(amount: 2))
        XCTAssertTrue(Money.zero.isZero)
    }

    func testStringInitAvoidsBinaryFloat() {
        let money = Money(string: "0.1")
        XCTAssertEqual(money.amount, Decimal(string: "0.1")!)
    }
}

