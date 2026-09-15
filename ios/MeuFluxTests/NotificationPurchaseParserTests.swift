import XCTest
@testable import MeuFluxDomain

final class NotificationPurchaseParserTests: XCTestCase {
    private let now = InstantDate(year: 2026, month: 9, day: 14).date()!

    func testAleloApprovedPurchase() {
        let result = NotificationPurchaseParser.parse(
            title: "Alelo",
            body: "Compra aprovada: R$ 32,50 em RESTAURANTE XYZ",
            sourceApp: "Alelo",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "32.50"))
        XCTAssertEqual(parsed.merchant, "RESTAURANTE XYZ")
        XCTAssertEqual(parsed.source, .alelo)
        XCTAssertGreaterThanOrEqual(parsed.confidence, NotificationPurchaseParser.autoSaveConfidenceThreshold)
    }

    func testVREstablishment() {
        let result = NotificationPurchaseParser.parse(
            title: "VR Benefícios",
            body: "Você gastou R$ 45,90 no estabelecimento PADARIA ABC",
            sourceApp: "VR Benefícios",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "45.90"))
        XCTAssertEqual(parsed.merchant, "PADARIA ABC")
        XCTAssertEqual(parsed.source, .vr)
    }

    func testTicketPurchase() {
        let result = NotificationPurchaseParser.parse(
            title: "Ticket",
            body: "Compra de R$ 28,00 realizada em LANCHONETE",
            sourceApp: "Ticket",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "28.00"))
        XCTAssertEqual(parsed.merchant, "LANCHONETE")
        XCTAssertEqual(parsed.source, .ticket)
    }

    func testCajuApproved() {
        let result = NotificationPurchaseParser.parse(
            title: "Caju",
            body: "Pagamento de R$ 50,00 aprovado em MERCADO LIVRE",
            sourceApp: "Caju",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "50.00"))
        XCTAssertEqual(parsed.source, .caju)
    }

    func testFlashWithoutMerchantStillParses() {
        let result = NotificationPurchaseParser.parse(
            title: "Flash",
            body: "Sua compra de R$ 15,90 foi aprovada",
            sourceApp: "Flash",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "15.90"))
        XCTAssertEqual(parsed.displayMerchant, "Compra")
        XCTAssertEqual(parsed.source, .flash)
    }

    func testWalletPortuguese() {
        let result = NotificationPurchaseParser.parse(
            title: "Alelo Refeição",
            body: "R$ 22,40 em IFOOD",
            sourceApp: "Carteira",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "22.40"))
        XCTAssertEqual(parsed.merchant, "IFOOD")
        XCTAssertEqual(parsed.source, .wallet)
    }

    func testIfoodBeneficios() {
        let result = NotificationPurchaseParser.parse(
            title: "iFood Benefícios",
            body: "Compra aprovada no iFood Benefícios: R$ 18,90 em RESTAURANTE",
            sourceApp: "iFood Benefícios",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "18.90"))
        XCTAssertEqual(parsed.merchant, "RESTAURANTE")
        XCTAssertEqual(parsed.source, .ifoodBeneficios)
    }

    func testPluxee() {
        let result = NotificationPurchaseParser.parse(
            title: "Pluxee",
            body: "Transação aprovada: R$ 12,00 em MERCADO",
            sourceApp: "Pluxee",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "12.00"))
        XCTAssertEqual(parsed.merchant, "MERCADO")
    }

    func testSwile() {
        let result = NotificationPurchaseParser.parse(
            title: "Swile",
            body: "Você pagou R$ 30,00 em PADARIA",
            sourceApp: "Swile",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "30.00"))
        XCTAssertEqual(parsed.merchant, "PADARIA")
    }

    func testThousandsSeparator() {
        let result = NotificationPurchaseParser.parse(
            title: "Alelo",
            body: "Compra aprovada: R$ 1.234,56 em SUPERMERCADO",
            sourceApp: "Alelo",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.amount.amount, Decimal(string: "1234.56"))
    }

    func testExplicitDate() {
        let result = NotificationPurchaseParser.parse(
            title: "Alelo",
            body: "Compra de R$ 10,00 em PADARIA em 13/09",
            sourceApp: "Alelo",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.purchasedAt, InstantDate(year: 2026, month: 9, day: 13))
    }

    func testYesterday() {
        let result = NotificationPurchaseParser.parse(
            title: "Alelo",
            body: "Compra de R$ 10,00 ontem em PADARIA",
            sourceApp: "Alelo",
            now: now
        )
        guard case .purchase(let parsed) = result else {
            return XCTFail("expected purchase, got \(result)")
        }
        XCTAssertEqual(parsed.purchasedAt, InstantDate(year: 2026, month: 9, day: 13))
    }

    func testIgnoreOTP() {
        let result = NotificationPurchaseParser.parse(
            title: "Alelo",
            body: "Seu código é 123456",
            sourceApp: "Alelo",
            now: now
        )
        guard case .ignored = result else {
            return XCTFail("expected ignored, got \(result)")
        }
    }

    func testIgnoreBalance() {
        let result = NotificationPurchaseParser.parse(
            title: "Alelo",
            body: "Seu saldo é R$ 200,00",
            sourceApp: "Alelo",
            now: now
        )
        guard case .ignored(let reason) = result else {
            return XCTFail("expected ignored, got \(result)")
        }
        XCTAssertTrue(reason.lowercased().contains("saldo"))
    }

    func testIgnoreClosedBill() {
        let result = NotificationPurchaseParser.parse(
            title: "Nubank",
            body: "Fatura fechou em R$ 1.200,00",
            sourceApp: "Nubank",
            now: now
        )
        guard case .ignored = result else {
            return XCTFail("expected ignored, got \(result)")
        }
    }

    func testIgnoreIncomingPix() {
        let result = NotificationPurchaseParser.parse(
            title: "Banco",
            body: "PIX recebido de R$ 50,00",
            sourceApp: "Banco",
            now: now
        )
        guard case .ignored = result else {
            return XCTFail("expected ignored, got \(result)")
        }
    }

    func testIgnoreLogin() {
        let result = NotificationPurchaseParser.parse(
            title: "Alelo",
            body: "Novo acesso à sua conta",
            sourceApp: "Alelo",
            now: now
        )
        guard case .ignored = result else {
            return XCTFail("expected ignored, got \(result)")
        }
    }

    func testIgnoreIncomingTransfer() {
        let result = NotificationPurchaseParser.parse(
            title: "Banco",
            body: "Transferência recebida R$ 10,00",
            sourceApp: "Banco",
            now: now
        )
        guard case .ignored = result else {
            return XCTFail("expected ignored, got \(result)")
        }
    }

    func testLowConfidenceAmountOnly() {
        let result = NotificationPurchaseParser.parse(
            title: "App",
            body: "R$ 10,00",
            sourceApp: "Outro",
            now: now
        )
        guard case .ignored = result else {
            return XCTFail("expected ignored without purchase signal, got \(result)")
        }
    }

    func testFingerprintStableAndDedupWindowConstant() {
        let a = NotificationImportFingerprint.make(
            source: .alelo,
            amount: Decimal(string: "32.50")!,
            merchant: "Restaurante XYZ",
            day: InstantDate(year: 2026, month: 9, day: 14),
            body: "Compra aprovada: R$ 32,50 em RESTAURANTE XYZ"
        )
        let b = NotificationImportFingerprint.make(
            source: .alelo,
            amount: Decimal(string: "32.50")!,
            merchant: "restaurante xyz",
            day: InstantDate(year: 2026, month: 9, day: 14),
            body: "Compra aprovada: R$ 32,50 em RESTAURANTE XYZ"
        )
        XCTAssertEqual(a, b)
        XCTAssertEqual(a.count, 64)
        XCTAssertEqual(NotificationImportFingerprint.duplicateWindow, 48 * 60 * 60)
    }

    func testSourceMatching() {
        XCTAssertEqual(NotificationImportSource.matching(appName: "Carteira"), .wallet)
        XCTAssertEqual(NotificationImportSource.matching(appName: "VR Benefícios"), .vr)
        XCTAssertEqual(NotificationImportSource.matching(appName: "Sodexo"), .pluxee)
        XCTAssertEqual(NotificationImportSource.matching(appName: "Meu Banco"), .generic)
    }

    func testWalletCardRuleMatch() {
        let rule = NotificationImportRule(
            source: .wallet,
            destination: .mealBenefit(id: "va-1"),
            walletCardName: "Alelo Refeição"
        )
        XCTAssertTrue(rule.matches(source: .wallet, title: "Alelo Refeição"))
        XCTAssertFalse(rule.matches(source: .wallet, title: "Nubank"))
        XCTAssertFalse(rule.matches(source: .alelo, title: "Alelo Refeição"))
    }
}
