import XCTest
@testable import FinancialDesignSystem

final class CardFaceCatalogTests: XCTestCase {
    func testUniqueMatchesSantanderUniqueAsset() {
        let style = CardFaceCatalog.style(name: "UNIQUE", institution: "Santander")
        XCTAssertEqual(style.assetName, "santander-unique")
        XCTAssertEqual(style.productLabel, "Unique")
    }

    func testInterGoldUsesConnectorAndMarketingName() {
        let style = CardFaceCatalog.style(
            name: "Gold Mastercard",
            institution: "Credit card",
            marketingName: "Gold",
            connectorName: "Banco Inter"
        )
        XCTAssertEqual(style.assetName, "inter-gold")
        XCTAssertEqual(style.productLabel, "Gold")
    }

    func testNubankFromConnector() {
        let style = CardFaceCatalog.style(
            name: "Cartão de crédito",
            connectorName: "Nubank"
        )
        XCTAssertEqual(style.assetName, "nubank")
        XCTAssertEqual(style.productLabel, "Nubank")
    }

    func testItauClickAlias() {
        let style = CardFaceCatalog.style(name: "Click", institution: "Itaú")
        XCTAssertEqual(style.assetName, "itau-click")
        XCTAssertEqual(style.productLabel, "Click")
    }

    func testMercadoPagoAndMagalu() {
        XCTAssertEqual(
            CardFaceCatalog.style(name: "Cartão", connectorName: "Mercado Pago").assetName,
            "mercado-pago"
        )
        XCTAssertEqual(
            CardFaceCatalog.style(name: "Luiza", connectorName: "Magazine Luiza").assetName,
            "magalu"
        )
    }

    func testIconKeyWins() {
        let style = CardFaceCatalog.style(iconKey: "itau-extra", name: "Visa")
        XCTAssertEqual(style.assetName, "itau-extra")
        XCTAssertEqual(style.productLabel, "Extra")
    }
}

