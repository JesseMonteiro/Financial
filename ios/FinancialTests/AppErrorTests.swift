import XCTest
@testable import FinancialCore

final class AppErrorTests: XCTestCase {
    func testLocalizedDescriptionIsPortuguese() {
        XCTAssertEqual(
            AppError.unauthorized.localizedDescription,
            "Sessão expirada. Faça login novamente."
        )
        XCTAssertEqual(
            AppError.configuration("URL inválida").localizedDescription,
            "Configuração inválida: URL inválida"
        )
        XCTAssertEqual((AppError.unauthorized as NSError).code, 1)
        XCTAssertEqual((AppError.configuration("x") as NSError).code, 5)
    }
}

