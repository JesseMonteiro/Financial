import XCTest
@testable import MeuFluxDomain

final class CalculationVersionTests: XCTestCase {
    func testMatchesCurrentStamp() {
        XCTAssertTrue(CalculationVersion.matches(CalculationVersion.current))
        XCTAssertTrue(CalculationVersion.matches("2026.09.2"))
        XCTAssertTrue(CalculationVersion.matches("2026.9.2"))
    }

    func testMissingStampIsCompatible() {
        XCTAssertTrue(CalculationVersion.matches(nil))
        XCTAssertTrue(CalculationVersion.matches(""))
    }

    func testDifferentStampIsMismatch() {
        XCTAssertFalse(CalculationVersion.matches("2026.09.3"))
        XCTAssertFalse(CalculationVersion.matches("2026.9.3"))
    }
}
