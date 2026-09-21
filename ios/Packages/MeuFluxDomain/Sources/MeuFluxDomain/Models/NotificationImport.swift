import Foundation
import CryptoKit

public enum NotificationImportSource: String, Sendable, Codable, CaseIterable, Identifiable, Hashable {
    case wallet
    case alelo
    case vr
    case ticket
    case pluxee
    case caju
    case flash
    case swile
    case ifoodBeneficios
    case nubank
    case itau
    case bradesco
    case c6
    case inter
    case picpay
    case btg
    case mercadoPago
    case generic

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .wallet: return "Carteira"
        case .alelo: return "Alelo"
        case .vr: return "VR Benefícios"
        case .ticket: return "Ticket / Edenred"
        case .pluxee: return "Pluxee"
        case .caju: return "Caju"
        case .flash: return "Flash"
        case .swile: return "Swile"
        case .ifoodBeneficios: return "iFood Benefícios"
        case .nubank: return "Nubank"
        case .itau: return "Itaú"
        case .bradesco: return "Bradesco"
        case .c6: return "C6 Bank"
        case .inter: return "Banco Inter"
        case .picpay: return "PicPay"
        case .btg: return "BTG Pactual"
        case .mercadoPago: return "Mercado Pago"
        case .generic: return "Outro app"
        }
    }

    public var systemImage: String {
        switch self {
        case .wallet:
            return "wallet.pass"
        case .alelo, .vr, .ticket, .pluxee, .caju, .flash, .swile, .ifoodBeneficios:
            return "fork.knife"
        case .nubank, .itau, .bradesco, .c6, .inter, .picpay, .btg, .mercadoPago:
            return "creditcard"
        case .generic:
            return "app.badge"
        }
    }

    public var isBankSource: Bool {
        switch self {
        case .nubank, .itau, .bradesco, .c6, .inter, .picpay, .btg, .mercadoPago:
            return true
        default:
            return false
        }
    }

    public var isMealBenefitSource: Bool {
        switch self {
        case .alelo, .vr, .ticket, .pluxee, .caju, .flash, .swile, .ifoodBeneficios:
            return true
        default:
            return false
        }
    }

    /// Institution name tokens as they appear in Pluggy (Open Finance)
    public var openFinanceInstitutionNames: [String] {
        switch self {
        case .nubank:
            return ["nu pagamentos", "nubank", "nu "]
        case .itau:
            return ["itau", "itaú"]
        case .bradesco:
            return ["bradesco", "next"]
        case .c6:
            return ["c6", "c6 bank", "banco c6"]
        case .inter:
            return ["inter", "banco inter"]
        case .picpay:
            return ["picpay", "banco picpay", "original"]
        case .btg:
            return ["btg", "btg pactual"]
        case .mercadoPago:
            return ["mercado pago", "mercadopago"]
        default:
            return []
        }
    }

    /// Names as they typically appear in Shortcuts’ notification trigger.
    public var shortcutsAppNames: [String] {
        switch self {
        case .wallet: return ["Carteira", "Wallet"]
        case .alelo: return ["Alelo"]
        case .vr: return ["VR Benefícios", "VR"]
        case .ticket: return ["Ticket", "Edenred"]
        case .pluxee: return ["Pluxee", "Sodexo"]
        case .caju: return ["Caju"]
        case .flash: return ["Flash"]
        case .swile: return ["Swile"]
        case .ifoodBeneficios: return ["iFood Benefícios", "iFood"]
        case .nubank: return ["Nubank", "Nu"]
        case .itau: return ["Itaú", "Itau", "Itaú Cartões", "íon"]
        case .bradesco: return ["Bradesco", "Bradesco Cartões"]
        case .c6: return ["C6 Bank", "C6"]
        case .inter: return ["Inter", "Banco Inter"]
        case .picpay: return ["PicPay"]
        case .btg: return ["BTG Pactual", "BTG Banking"]
        case .mercadoPago: return ["Mercado Pago"]
        case .generic: return []
        }
    }

    public var suggestedKeywords: [String] {
        ["compra", "aprovada", "R$"]
    }

    public static func matching(appName: String) -> NotificationImportSource {
        let n = appName.notificationImportFolded
        if n.contains("carteira") || n == "wallet" || n.contains("apple wallet") { return .wallet }
        if n.contains("alelo") { return .alelo }
        if n.contains("vr beneficio") || n == "vr" || n.hasPrefix("vr ") { return .vr }
        if n.contains("ticket") || n.contains("edenred") { return .ticket }
        if n.contains("pluxee") || n.contains("sodexo") { return .pluxee }
        if n.contains("caju") { return .caju }
        if n.contains("flash") { return .flash }
        if n.contains("swile") { return .swile }
        if n.contains("ifood") { return .ifoodBeneficios }
        if n.contains("nubank") || n == "nu" { return .nubank }
        if n.contains("itau") || n.contains("itaú") { return .itau }
        if n.contains("bradesco") { return .bradesco }
        if n.contains("c6") { return .c6 }
        if n.contains("inter") && !n.contains("internet") { return .inter }
        if n.contains("picpay") { return .picpay }
        if n.contains("btg") { return .btg }
        if n.contains("mercado pago") || n.contains("mercadopago") { return .mercadoPago }
        return .generic
    }
}

public enum NotificationImportDestination: Sendable, Hashable, Codable {
    case mealBenefit(id: String)
    case manualAccount(id: String)

    public var id: String {
        switch self {
        case .mealBenefit(let id), .manualAccount(let id):
            return id
        }
    }

    public var isMealBenefit: Bool {
        if case .mealBenefit = self { return true }
        return false
    }

    private enum CodingKeys: String, CodingKey {
        case kind, id
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .mealBenefit(let id):
            try container.encode("mealBenefit", forKey: .kind)
            try container.encode(id, forKey: .id)
        case .manualAccount(let id):
            try container.encode("manualAccount", forKey: .kind)
            try container.encode(id, forKey: .id)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(String.self, forKey: .kind)
        let id = try container.decode(String.self, forKey: .id)
        switch kind {
        case "mealBenefit": self = .mealBenefit(id: id)
        case "manualAccount": self = .manualAccount(id: id)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .kind,
                in: container,
                debugDescription: "Unknown destination kind \(kind)"
            )
        }
    }
}

public struct NotificationImportRule: Sendable, Identifiable, Hashable, Codable {
    public var id: String
    public var source: NotificationImportSource
    public var destination: NotificationImportDestination
    public var enabled: Bool
    public var extraKeywords: [String]
    /// When source is Wallet, optionally match the notification title (card name).
    public var walletCardName: String?

    public init(
        id: String = UUID().uuidString,
        source: NotificationImportSource,
        destination: NotificationImportDestination,
        enabled: Bool = true,
        extraKeywords: [String] = [],
        walletCardName: String? = nil
    ) {
        self.id = id
        self.source = source
        self.destination = destination
        self.enabled = enabled
        self.extraKeywords = extraKeywords
        self.walletCardName = walletCardName
    }

    public func matches(source: NotificationImportSource, title: String) -> Bool {
        guard enabled, self.source == source else { return false }
        guard source == .wallet, let needle = walletCardName?.trimmingCharacters(in: .whitespacesAndNewlines),
              !needle.isEmpty else {
            return true
        }
        return title.notificationImportFolded.contains(needle.notificationImportFolded)
    }
}

public enum NotificationImportStatus: String, Sendable, Codable, Hashable {
    case imported
    case ignored
    case undone
    case parseFailed
    case needsDestination
    case needsReview
    case queued
    case skippedOpenFinance
}

public enum NotificationImportEntityKind: String, Sendable, Codable, Hashable {
    case mealPurchase
    case manualExpense
}

public struct ParsedPurchase: Sendable, Hashable, Codable {
    public var amount: Money
    public var merchant: String?
    public var purchasedAt: InstantDate
    public var rawTitle: String
    public var rawSubtitle: String
    public var rawBody: String
    public var source: NotificationImportSource
    public var sourceAppName: String
    public var confidence: Double
    public var suggestedCategory: String?

    public init(
        amount: Money,
        merchant: String?,
        purchasedAt: InstantDate,
        rawTitle: String,
        rawSubtitle: String,
        rawBody: String,
        source: NotificationImportSource,
        sourceAppName: String,
        confidence: Double,
        suggestedCategory: String? = nil
    ) {
        self.amount = amount
        self.merchant = merchant
        self.purchasedAt = purchasedAt
        self.rawTitle = rawTitle
        self.rawSubtitle = rawSubtitle
        self.rawBody = rawBody
        self.source = source
        self.sourceAppName = sourceAppName
        self.confidence = confidence
        self.suggestedCategory = suggestedCategory
    }

    public var displayMerchant: String {
        let trimmed = merchant?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "Compra" : trimmed
    }

    public var combinedText: String {
        [rawTitle, rawSubtitle, rawBody]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
    }
}

public struct NotificationImportRecord: Sendable, Identifiable, Hashable, Codable {
    public var id: String
    public var fingerprint: String
    public var status: NotificationImportStatus
    public var parsed: ParsedPurchase?
    public var createdEntityId: String?
    public var createdEntityKind: NotificationImportEntityKind?
    public var createdAt: Date
    public var destination: NotificationImportDestination?
    public var ignoreReason: String?

    public init(
        id: String = UUID().uuidString,
        fingerprint: String,
        status: NotificationImportStatus,
        parsed: ParsedPurchase? = nil,
        createdEntityId: String? = nil,
        createdEntityKind: NotificationImportEntityKind? = nil,
        createdAt: Date = Date(),
        destination: NotificationImportDestination? = nil,
        ignoreReason: String? = nil
    ) {
        self.id = id
        self.fingerprint = fingerprint
        self.status = status
        self.parsed = parsed
        self.createdEntityId = createdEntityId
        self.createdEntityKind = createdEntityKind
        self.createdAt = createdAt
        self.destination = destination
        self.ignoreReason = ignoreReason
    }
}

public struct NotificationImportPendingPayload: Sendable, Identifiable, Hashable, Codable {
    public var id: String
    public var title: String
    public var subtitle: String
    public var body: String
    public var sourceApp: String
    public var receivedAt: Date

    public init(
        id: String = UUID().uuidString,
        title: String,
        subtitle: String,
        body: String,
        sourceApp: String,
        receivedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.body = body
        self.sourceApp = sourceApp
        self.receivedAt = receivedAt
    }
}

public enum NotificationParseResult: Sendable, Equatable {
    case purchase(ParsedPurchase)
    case ignored(reason: String)
}

public enum NotificationImportFingerprint {
    public static let duplicateWindow: TimeInterval = 48 * 60 * 60

    public static func make(
        source: NotificationImportSource,
        amount: Decimal,
        merchant: String?,
        day: InstantDate,
        body: String
    ) -> String {
        let merchantKey = (merchant ?? "").notificationImportNormalizedMerchant
        let bodyKey = String(body.notificationImportFolded.prefix(80))
        let amountKey = NSDecimalNumber(decimal: amount).stringValue
        let canonical = "\(source.rawValue)|\(amountKey)|\(merchantKey)|\(day.isoString)|\(bodyKey)"
        let digest = SHA256.hash(data: Data(canonical.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

public enum NotificationImportOutcome: Sendable, Equatable {
    case imported(NotificationImportRecord)
    case duplicate(NotificationImportRecord)
    case ignored(NotificationImportRecord)
    case needsDestination(NotificationImportRecord)
    case needsReview(NotificationImportRecord)
    case queued(NotificationImportRecord)
    case skippedOpenFinance(NotificationImportRecord)
    case undone(NotificationImportRecord)
    case failed(String)

    public var record: NotificationImportRecord? {
        switch self {
        case .imported(let record),
             .duplicate(let record),
             .ignored(let record),
             .needsDestination(let record),
             .needsReview(let record),
             .queued(let record),
             .skippedOpenFinance(let record),
             .undone(let record):
            return record
        case .failed:
            return nil
        }
    }

    public var dialogText: String {
        switch self {
        case .imported(let record):
            let merchant = record.parsed?.displayMerchant ?? "compra"
            let amount = record.parsed?.amount.formatted() ?? ""
            return "Importamos \(amount) em \(merchant). Toque na notificação para editar."
        case .duplicate:
            return "Esta compra já tinha sido importada."
        case .ignored(let record):
            return record.ignoreReason ?? "Notificação ignorada."
        case .needsDestination:
            return "Compra reconhecida. Toque para escolher a conta."
        case .needsReview:
            return "Não entendi esta compra. Toque para revisar o texto."
        case .queued:
            return "Compra guardada. Entraremos quando você abrir o app."
        case .skippedOpenFinance:
            return "Compra não importada: este cartão está conectado via Open Finance e a transação será sincronizada automaticamente."
        case .undone:
            return "Lançamento desfeito."
        case .failed(let message):
            return message
        }
    }

    public var shouldNotify: Bool {
        switch self {
        case .imported, .needsDestination, .needsReview, .queued, .failed:
            return true
        case .duplicate, .ignored, .undone, .skippedOpenFinance:
            return false
        }
    }
}

public protocol NotificationImporting: Sendable {
    func importFromNotification(
        title: String,
        subtitle: String,
        body: String,
        sourceApp: String,
        now: Date
    ) async -> NotificationImportOutcome
    func importDirectTransaction(
        amount: Decimal,
        merchant: String,
        cardName: String,
        date: Date
    ) async -> NotificationImportOutcome
    func processQueued(now: Date) async -> [NotificationImportOutcome]
    func undo(recordId: String) async -> NotificationImportOutcome
    func applyReview(
        recordId: String,
        amount: Decimal,
        merchant: String,
        date: InstantDate,
        destination: NotificationImportDestination,
        category: String?
    ) async -> NotificationImportOutcome
    func loadRecord(id: String) async -> NotificationImportRecord?
    func loadHistory() async -> [NotificationImportRecord]
    func loadRules() async -> [NotificationImportRule]
    func saveRules(_ rules: [NotificationImportRule]) async
}

public extension NotificationImporting {
    func importDirectTransaction(
        amount: Decimal,
        merchant: String,
        cardName: String,
        date: Date = Date()
    ) async -> NotificationImportOutcome {
        await importFromNotification(
            title: cardName.isEmpty ? "Carteira" : cardName,
            subtitle: "",
            body: "\(amount) em \(merchant)",
            sourceApp: cardName.isEmpty ? "Carteira" : cardName,
            now: date
        )
    }
}

public protocol NotificationImportStoring: Sendable {
    func loadRules() async -> [NotificationImportRule]
    func saveRules(_ rules: [NotificationImportRule]) async
    func loadRecords() async -> [NotificationImportRecord]
    func upsertRecord(_ record: NotificationImportRecord) async
    func record(id: String) async -> NotificationImportRecord?
    func findDuplicate(fingerprint: String, now: Date, window: TimeInterval) async -> NotificationImportRecord?
    func enqueuePending(_ payload: NotificationImportPendingPayload) async
    func drainPending() async -> [NotificationImportPendingPayload]
}

public protocol ConnectedBankChecking: Sendable {
    func isConnectedViaOpenFinance(source: NotificationImportSource) async -> Bool
}

public extension String {
    var notificationImportFolded: String {
        folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "pt_BR"))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var notificationImportNormalizedMerchant: String {
        notificationImportFolded
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    }
}
