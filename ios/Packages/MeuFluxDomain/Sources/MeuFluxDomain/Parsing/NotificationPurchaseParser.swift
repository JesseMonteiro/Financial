import Foundation

public enum NotificationPurchaseParser {
    public static let autoSaveConfidenceThreshold = 0.55

    public static func parse(
        title: String,
        subtitle: String = "",
        body: String,
        sourceApp: String,
        now: Date = Date(),
        calendar: Calendar = .notificationImport
    ) -> NotificationParseResult {
        let source = NotificationImportSource.matching(appName: sourceApp)
        let combined = [title, subtitle, body]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
        let folded = combined.notificationImportFolded

        if let reason = ignoreReason(folded: folded) {
            return .ignored(reason: reason)
        }

        guard let amount = extractAmount(from: combined) else {
            return .ignored(reason: "Nenhum valor de compra encontrado.")
        }

        let hasPurchaseSignal = containsPurchaseSignal(folded)
        var merchant = extractMerchant(from: combined, source: source)
        merchant = sanitizeMerchant(merchant)

        var confidence = 0.4
        if hasPurchaseSignal { confidence += 0.3 }
        if merchant != nil { confidence += 0.2 }
        if source != .generic { confidence += 0.1 }
        confidence = min(1, confidence)

        if !hasPurchaseSignal && merchant == nil {
            return .ignored(reason: "Texto não parece uma compra.")
        }

        let purchasedAt = extractDate(from: combined, now: now, calendar: calendar)
            ?? InstantDate(from: now, calendar: calendar)

        return .purchase(
            ParsedPurchase(
                amount: Money(amount: amount),
                merchant: merchant,
                purchasedAt: purchasedAt,
                rawTitle: title,
                rawSubtitle: subtitle,
                rawBody: body,
                source: source,
                sourceAppName: sourceApp,
                confidence: confidence
            )
        )
    }

    // MARK: - Ignore

    private static func ignoreReason(folded: String) -> String? {
        let negatives: [(needles: [String], reason: String)] = [
            (["codigo de", "seu codigo", "otp", "token de", "senha"], "Código de verificação ignorado."),
            (["novo acesso", "tentativa de acesso", "login na sua"], "Alerta de acesso ignorado."),
            (["seu saldo", "saldo disponivel", "saldo atual"], "Aviso de saldo ignorado."),
            (["fatura fechou", "fatura fechada", "fatura disponivel", "fatura paga"], "Aviso de fatura ignorado."),
            (["pix recebido", "transferencia recebida", "voce recebeu"], "Crédito recebido ignorado."),
            (["rendimento", "rende mais", "cdb", "investimento rendeu"], "Alerta de investimento ignorado."),
            (["limite disponivel", "limite do cartao", "seu limite aumentou"], "Aviso de limite ignorado."),
            (["boleto agendado"], "Aviso de agendamento ignorado."),
        ]
        let hasPurchase = containsPurchaseSignal(folded)
        for group in negatives where group.needles.contains(where: { folded.contains($0) }) {
            if hasPurchase && group.reason.contains("saldo") { continue }
            return group.reason
        }
        if folded.range(of: #"\b\d{6}\b"#, options: .regularExpression) != nil,
           extractAmount(from: folded) == nil {
            return "Código de verificação ignorado."
        }
        return nil
    }

    private static func containsPurchaseSignal(_ folded: String) -> Bool {
        let signals = [
            "compra", "aprovada", "aprovado", "debitada", "debito", "debito",
            "pagou", "pagamento", "gastou", "transacao", "transacao", "voce gastou",
            "realizada em", "realizada", "purchase", "paid",
            "credito", "credito", "cartao", "cartao", "no valor",
            "pix realizado", "transferencia enviada", "transferencia enviada"
        ]
        return signals.contains(where: { folded.contains($0) })
    }

    // MARK: - Amount

    static func extractAmount(from text: String) -> Decimal? {
        let patterns = [
            #"R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)[,.](\d{2})"#,
            #"\$\s*(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})"#,
        ]
        for pattern in patterns {
            if let amount = firstAmount(in: text, pattern: pattern) { return amount }
        }
        if containsPurchaseSignal(text.notificationImportFolded) {
            return firstAmount(in: text, pattern: #"(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})"#)
        }
        return nil
    }

    private static func firstAmount(in text: String, pattern: String) -> Decimal? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return nil }
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        guard let match = regex.firstMatch(in: text, options: [], range: range),
              match.numberOfRanges >= 3,
              match.range(at: 1).location != NSNotFound,
              match.range(at: 2).location != NSNotFound else { return nil }
        let integer = ns.substring(with: match.range(at: 1)).replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: "")
        let fraction = ns.substring(with: match.range(at: 2))
        return Decimal(string: "\(integer).\(fraction)")
    }

    // MARK: - Merchant

    static func extractMerchant(from text: String, source: NotificationImportSource) -> String? {
        let patterns: [String]
        switch source {
        case .vr:
            patterns = [
                #"(?i)no estabelecimento\s+(.+)"#,
                #"(?i)em\s+(.+)$"#,
            ]
        case .wallet:
            patterns = [
                #"(?i)em\s+(.+)$"#,
                #"(?i)\bat\s+(.+)$"#,
                #"(?i)no estabelecimento\s+(.+)"#,
            ]
        case .caju, .flash, .swile:
            patterns = [
                #"(?i)em\s+(.+)$"#,
                #"(?i)aprovad[oa]\s+em\s+(.+)"#,
            ]
        case .nubank:
            patterns = [
                #"(?i)(?:compra|pagamento)\s+(?:no\s+)?(?:d[ée]bito|cr[ée]dito)\s*[-:]?\s*(.+?)\s*-\s*R\$"#,
                #"(?i)em\s+(.+?)(?:\s+-\s+R\$|\s+com\s|\s+no\s+valor|\s*$)"#,
                #"(?i)para\s+(.+?)(?:\s+-\s+R\$|\s+no\s+valor|\s*$)"#,
                #"(?i)compra\s+aprovada\s+em\s+(.+)"#,
                #"(?i)transfer[êe]ncia\s+enviada.*?para\s+(.+)"#,
            ]
        case .itau:
            patterns = [
                #"(?i)(?:em|no)\s+(.+?)(?:\s+no\s+valor|\s+com\s+Cart[aã]o|\s+aprovad|\s*$)"#,
                #"(?i)realizada\s+em\s+(.+?)(?:\s+no\s+valor|\s+com\s+Cart[aã]o|\s*$)"#,
                #"(?i)aprovada(?:[^R\n]*R\$[^\n]*?)?\s+em\s+(.+)"#,
                #"(?i)em\s+(.+)$"#,
            ]
        case .c6:
            patterns = [
                #"(?i)aprovada\s+em\s+(.+)"#,
                #"(?i)em\s+(.+?)(?:\s+no\s+valor|\s+foi|\s*$)"#,
            ]
        case .inter:
            patterns = [
                #"(?i)para\s+(.+?)(?:\s+no\s+valor|\s*-\s*R\$|\s*$)"#,
                #"(?i)em\s+(.+?)(?:\s+no\s+valor|\s*-\s*R\$|\s*$)"#,
                #"(?i)aprovad[oa]\s+em\s+(.+)"#,
            ]
        case .bradesco:
            patterns = [
                #"(?i)realizada\s+em\s+(.+?)(?:\s+com\s+cart|\s+no\s+valor|\s*$)"#,
                #"(?i)aprovada:\s*R\$[^\n]+?\s+em\s+(.+)"#,
                #"(?i)em\s+(.+)$"#,
            ]
        case .picpay:
            patterns = [
                #"(?i)aprovado\s+em\s+(.+)"#,
                #"(?i)para\s+(.+?)(?:\s+no\s+valor|\s*$)"#,
                #"(?i)em\s+(.+)$"#,
            ]
        case .btg:
            patterns = [
                #"(?i)aprovada:\s*R\$[^\n]+?\s+em\s+(.+)"#,
                #"(?i)aprovada\s+em\s+(.+)"#,
                #"(?i)em\s+(.+)$"#,
            ]
        case .mercadoPago:
            patterns = [
                #"(?i)realizado\s+em\s+(.+)"#,
                #"(?i)aprovado\s+em\s+(.+)"#,
                #"(?i)em\s+(.+)$"#,
            ]
        case .alelo, .ticket, .pluxee, .ifoodBeneficios, .generic:
            patterns = [
                #"(?i)no estabelecimento\s+(.+)"#,
                #"(?i)realizada em\s+(.+)"#,
                #"(?i)aprovada(?:[^R\n]*R\$[^\n]*?)?\s+em\s+(.+)"#,
                #"(?i):\s*R\$[^\n]+?\s+em\s+(.+)"#,
                #"(?i)em\s+(.+)$"#,
            ]
        }
        let lines = text.split(whereSeparator: \.isNewline).map(String.init)
        let candidates = [text] + lines
        for candidate in candidates {
            for pattern in patterns {
                if let value = firstCapture(in: candidate, pattern: pattern) {
                    return value
                }
            }
        }
        return nil
    }

    private static func sanitizeMerchant(_ raw: String?) -> String? {
        guard var value = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        let cutTokens = [
            " com seu", " no cartao", " no cartão", " usando", " com o cartao", " com o cartão",
            " com cartao", " com cartão", " final ", " cartao final", " cartão final",
            " no valor", " — ", " - R$", " de R$", " de r$", " aprovada", " aprovado",
            " realizada", " realizado", " foi aprovada", " foi aprovado"
        ]
        let folded = value.notificationImportFolded
        for token in cutTokens {
            if let range = folded.range(of: token.notificationImportFolded) {
                let prefixCount = folded.distance(from: folded.startIndex, to: range.lowerBound)
                let idx = value.index(value.startIndex, offsetBy: min(prefixCount, value.count))
                value = String(value[..<idx])
                break
            }
        }
        value = value.trimmingCharacters(in: CharacterSet(charactersIn: ".-–—: "))
        if value.isEmpty { return nil }
        if extractAmount(from: value) != nil && value.count < 12 { return nil }
        if value.notificationImportFolded.hasPrefix("r$") { return nil }
        return value
    }

    // MARK: - Date

    static func extractDate(from text: String, now: Date, calendar: Calendar) -> InstantDate? {
        let folded = text.notificationImportFolded
        if folded.contains("ontem") {
            let yesterday = calendar.date(byAdding: .day, value: -1, to: now) ?? now
            return InstantDate(from: yesterday, calendar: calendar)
        }
        if folded.contains("hoje") {
            return InstantDate(from: now, calendar: calendar)
        }
        guard let regex = try? NSRegularExpression(pattern: #"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b"#) else {
            return nil
        }
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        guard let match = regex.firstMatch(in: text, options: [], range: range) else { return nil }
        let day = Int(ns.substring(with: match.range(at: 1))) ?? 0
        let month = Int(ns.substring(with: match.range(at: 2))) ?? 0
        guard (1...31).contains(day), (1...12).contains(month) else { return nil }
        let nowInstant = InstantDate(from: now, calendar: calendar)
        var year = nowInstant.year
        if match.numberOfRanges > 3, match.range(at: 3).location != NSNotFound {
            let rawYear = Int(ns.substring(with: match.range(at: 3))) ?? year
            year = rawYear < 100 ? 2000 + rawYear : rawYear
        }
        var parsed = InstantDate(year: year, month: month, day: day)
        if parsed > nowInstant, match.numberOfRanges <= 3 || match.range(at: 3).location == NSNotFound {
            parsed = InstantDate(year: year - 1, month: month, day: day)
        }
        return parsed
    }

    private static func firstCapture(in text: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else { return nil }
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        guard let match = regex.firstMatch(in: text, options: [], range: range) else { return nil }
        let last = (1..<match.numberOfRanges).reversed().first { match.range(at: $0).location != NSNotFound } ?? 1
        guard match.range(at: last).location != NSNotFound else { return nil }
        return ns.substring(with: match.range(at: last))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

public extension Calendar {
    static var notificationImport: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo") ?? .current
        calendar.locale = Locale(identifier: "pt_BR")
        return calendar
    }
}
