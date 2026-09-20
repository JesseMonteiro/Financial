import XCTest
@testable import MeuFluxDesignSystem

final class MerchantLogoCatalogTests: XCTestCase {
    func testIFoodMatching() {
        let match1 = MerchantLogoCatalog.match(text: "iFood *Restaurante")
        XCTAssertEqual(match1?.id, "ifood")
        XCTAssertEqual(match1?.name, "iFood")

        let match2 = MerchantLogoCatalog.match(text: "IFOOD BRASIL")
        XCTAssertEqual(match2?.id, "ifood")

        let match3 = MerchantLogoCatalog.match(text: "IFD*RESTAURANTE SAO PAULO")
        XCTAssertEqual(match3?.id, "ifood")
    }

    func testTransportAndMobilityMatching() {
        let uber1 = MerchantLogoCatalog.match(text: "Uber * Viagem Urbana")
        XCTAssertEqual(uber1?.id, "uber")

        let uber2 = MerchantLogoCatalog.match(text: "UBER *TRIP")
        XCTAssertEqual(uber2?.id, "uber")

        let app99 = MerchantLogoCatalog.match(text: "99App *Corrida")
        XCTAssertEqual(app99?.id, "99app")

        let shell = MerchantLogoCatalog.match(text: "Posto Shell Combustível")
        XCTAssertEqual(shell?.id, "shell")
    }

    func testStreamingAndEntertainmentMatching() {
        let netflix = MerchantLogoCatalog.match(text: "Netflix Assinatura Mensal")
        XCTAssertEqual(netflix?.id, "netflix")

        let spotify = MerchantLogoCatalog.match(text: "SPOTIFY BRASIL")
        XCTAssertEqual(spotify?.id, "spotify")

        let steam = MerchantLogoCatalog.match(text: "STEAM GAMES VALV")
        XCTAssertEqual(steam?.id, "steam")
    }

    func testRetailAndSupermarketMatching() {
        let carrefour = MerchantLogoCatalog.match(text: "Carrefour Supermercado")
        XCTAssertEqual(carrefour?.id, "carrefour")

        let amazon = MerchantLogoCatalog.match(text: "AMAZON PRIME BR")
        XCTAssertEqual(amazon?.id, "amazon")

        let mercadoLivre = MerchantLogoCatalog.match(text: "COMPRA MERCADOLIVRE")
        XCTAssertEqual(mercadoLivre?.id, "mercado-livre")

        let mcDonalds = MerchantLogoCatalog.match(text: "MC DONALDS SHOPPING")
        XCTAssertEqual(mcDonalds?.id, "mcdonalds")

        let rdSaude = MerchantLogoCatalog.match(text: "COMPRA RD SAUDE")
        XCTAssertEqual(rdSaude?.id, "drogasil")

        let drogasil = MerchantLogoCatalog.match(text: "DROGASIL FILIAL 123")
        XCTAssertEqual(drogasil?.id, "drogasil")
    }

    func testShortWordBoundaryMatching() {
        // "tim" should match when whole word, but not inside "intimidade" or "vitima"
        let tim = MerchantLogoCatalog.match(text: "FATURA TIM CELULAR")
        XCTAssertEqual(tim?.id, "tim")

        let notTim = MerchantLogoCatalog.match(text: "INTIMIDADE MODA INTIMA")
        XCTAssertNotEqual(notTim?.id, "tim")
    }

    func testFallbackOnGenericTransactions() {
        XCTAssertNil(MerchantLogoCatalog.match(text: "PAGAMENTO DE SALARIO"))
        XCTAssertNil(MerchantLogoCatalog.match(text: "TED RECEBIDA JOAO SILVA"))
        XCTAssertNil(MerchantLogoCatalog.match(text: "RENDIMENTO POUPANCA / CDB"))
        XCTAssertNil(MerchantLogoCatalog.match(text: ""))
        XCTAssertNil(MerchantLogoCatalog.match(text: nil))
    }
}
