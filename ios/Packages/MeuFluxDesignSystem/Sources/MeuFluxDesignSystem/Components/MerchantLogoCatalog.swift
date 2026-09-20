import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public struct MerchantEntry: Sendable, Equatable, Identifiable {
    public let id: String
    public let name: String
    public let aliases: [String]
    public let brandColorHex: String
    public let assetName: String

    public init(
        id: String,
        name: String,
        aliases: [String],
        brandColorHex: String,
        assetName: String
    ) {
        self.id = id
        self.name = name
        self.aliases = aliases
        self.brandColorHex = brandColorHex
        self.assetName = assetName
    }
}

public enum MerchantLogoImageLoader {
    public static func image(named name: String) -> Image? {
        #if canImport(UIKit)
        if let ui = UIImage(named: name, in: .module, compatibleWith: nil) {
            return Image(uiImage: ui)
        }
        let extensions = ["png", "jpg", "jpeg"]
        let subdirs: [String?] = [nil, "MerchantLogos", "Resources/MerchantLogos"]
        for ext in extensions {
            for subdir in subdirs {
                let url: URL?
                if let subdir {
                    url = Bundle.module.url(forResource: name, withExtension: ext, subdirectory: subdir)
                } else {
                    url = Bundle.module.url(forResource: name, withExtension: ext)
                }
                if let url, let ui = UIImage(contentsOfFile: url.path) {
                    return Image(uiImage: ui)
                }
            }
        }
        #endif
        return nil
    }
}

public enum MerchantLogoCatalog {
    public static let entries: [MerchantEntry] = [
        // Alimentação & Delivery
        .init(id: "ifood", name: "iFood", aliases: ["ifood", "i food", "ifd*"], brandColorHex: "#EA1D2C", assetName: "ifood"),
        .init(id: "rappi", name: "Rappi", aliases: ["rappi"], brandColorHex: "#FF441F", assetName: "rappi"),
        .init(id: "ze-delivery", name: "Zé Delivery", aliases: ["ze delivery", "zedelivery"], brandColorHex: "#FFCC00", assetName: "ze-delivery"),
        .init(id: "mcdonalds", name: "McDonald's", aliases: ["mcdonalds", "mc donalds", "mcdonald", "mequi"], brandColorHex: "#DA291C", assetName: "mcdonalds"),
        .init(id: "burger-king", name: "Burger King", aliases: ["burger king", "bk brasil", "burgerking"], brandColorHex: "#D62300", assetName: "burger-king"),
        .init(id: "starbucks", name: "Starbucks", aliases: ["starbucks"], brandColorHex: "#006241", assetName: "starbucks"),
        .init(id: "outback", name: "Outback", aliases: ["outback", "outback steakhouse"], brandColorHex: "#8B0000", assetName: "outback"),
        .init(id: "habibs", name: "Habib's", aliases: ["habibs", "habib"], brandColorHex: "#C70000", assetName: "habibs"),
        .init(id: "cacau-show", name: "Cacau Show", aliases: ["cacau show", "cacaushow"], brandColorHex: "#4A2311", assetName: "cacau-show"),

        // Transporte & Mobilidade
        .init(id: "uber", name: "Uber", aliases: ["uber", "uber *trip", "uber trip", "uberbr", "uber eats", "uber pendente"], brandColorHex: "#000000", assetName: "uber"),
        .init(id: "99app", name: "99", aliases: ["99app", "99 app", "99pop", "99tecnologia", "99pay"], brandColorHex: "#FFB800", assetName: "99app"),
        .init(id: "shell", name: "Shell", aliases: ["shell", "posto shell", "shell box", "raizen"], brandColorHex: "#FFD700", assetName: "shell"),
        .init(id: "ipiranga", name: "Ipiranga", aliases: ["ipiranga", "posto ipiranga", "abastece ai"], brandColorHex: "#002D72", assetName: "ipiranga"),
        .init(id: "sem-parar", name: "Sem Parar", aliases: ["sem parar", "semparar"], brandColorHex: "#E60000", assetName: "sem-parar"),
        .init(id: "conectcar", name: "ConectCar", aliases: ["conectcar", "conect car"], brandColorHex: "#0090DA", assetName: "conectcar"),
        .init(id: "veloe", name: "Veloe", aliases: ["veloe"], brandColorHex: "#00A3E0", assetName: "veloe"),
        .init(id: "azul", name: "Azul Linhas Aéreas", aliases: ["azul linhas", "voeazul"], brandColorHex: "#002D62", assetName: "azul"),
        .init(id: "gol", name: "Gol Linhas Aéreas", aliases: ["gol linhas", "voegol"], brandColorHex: "#FF5A00", assetName: "gol"),
        .init(id: "latam", name: "LATAM Airlines", aliases: ["latam airlines", "latam pass", "tam linhas"], brandColorHex: "#E31837", assetName: "latam"),

        // Supermercados & Farmácias
        .init(id: "carrefour", name: "Carrefour", aliases: ["carrefour", "carrefour express"], brandColorHex: "#004E9B", assetName: "carrefour"),
        .init(id: "pao-de-acucar", name: "Pão de Açúcar", aliases: ["pao de acucar", "paodeacucar", "gpa", "minuto pao"], brandColorHex: "#006633", assetName: "pao-de-acucar"),
        .init(id: "assai", name: "Assaí", aliases: ["assai", "assai atacadista"], brandColorHex: "#ED1C24", assetName: "assai"),
        .init(id: "atacadao", name: "Atacadão", aliases: ["atacadao"], brandColorHex: "#E30613", assetName: "atacadao"),
        .init(id: "extra", name: "Extra", aliases: ["extra supermercado", "extra mercado", "supermercado extra"], brandColorHex: "#ED1C24", assetName: "extra"),
        .init(id: "oxxo", name: "Oxxo", aliases: ["oxxo", "mercado oxxo"], brandColorHex: "#E60000", assetName: "oxxo"),
        .init(id: "droga-raia", name: "Droga Raia", aliases: ["droga raia", "drogaraia", "raiadrogasil"], brandColorHex: "#0054A6", assetName: "droga-raia"),
        .init(id: "drogasil", name: "Drogasil", aliases: ["drogasil", "droga sil", "rd saude", "rdsaude", "rd farmacia"], brandColorHex: "#ED1C24", assetName: "drogasil"),
        .init(id: "drogaria-sao-paulo", name: "Drogaria São Paulo", aliases: ["drogaria sao paulo", "drogaria sp", "dpsp"], brandColorHex: "#003399", assetName: "drogaria-sao-paulo"),
        .init(id: "pague-menos", name: "Pague Menos", aliases: ["pague menos", "paguemenos"], brandColorHex: "#ED1C24", assetName: "pague-menos"),
        .init(id: "panvel", name: "Panvel", aliases: ["panvel"], brandColorHex: "#003B70", assetName: "panvel"),

        // E-commerce & Varejo
        .init(id: "amazon", name: "Amazon", aliases: ["amazon", "amzn", "amazon prime", "amazon mktplace"], brandColorHex: "#FF9900", assetName: "amazon"),
        .init(id: "mercado-livre", name: "Mercado Livre", aliases: ["mercado livre", "mercadolivre", "mercado pago", "merpago", "mp *"], brandColorHex: "#FFE600", assetName: "mercado-livre"),
        .init(id: "shopee", name: "Shopee", aliases: ["shopee"], brandColorHex: "#EE4D2D", assetName: "shopee"),
        .init(id: "shein", name: "Shein", aliases: ["shein"], brandColorHex: "#000000", assetName: "shein"),
        .init(id: "aliexpress", name: "AliExpress", aliases: ["aliexpress", "alipay"], brandColorHex: "#FF4747", assetName: "aliexpress"),
        .init(id: "magalu", name: "Magalu", aliases: ["magalu", "magazine luiza"], brandColorHex: "#0086FF", assetName: "magalu"),
        .init(id: "americanas", name: "Americanas", aliases: ["americanas", "lojas americanas"], brandColorHex: "#E60014", assetName: "americanas"),
        .init(id: "apple", name: "Apple", aliases: ["apple.com", "apple store", "itunes", "apple.com/bill", "apple"], brandColorHex: "#000000", assetName: "apple"),
        .init(id: "google", name: "Google", aliases: ["google", "google play", "google storage", "gsuite"], brandColorHex: "#4285F4", assetName: "google"),

        // Streaming & Assinaturas
        .init(id: "netflix", name: "Netflix", aliases: ["netflix", "netflix.com"], brandColorHex: "#E50914", assetName: "netflix"),
        .init(id: "spotify", name: "Spotify", aliases: ["spotify"], brandColorHex: "#1DB954", assetName: "spotify"),
        .init(id: "youtube", name: "YouTube", aliases: ["youtube", "yt premium"], brandColorHex: "#FF0000", assetName: "youtube"),
        .init(id: "disney-plus", name: "Disney+", aliases: ["disney plus", "disney+", "disneyplus"], brandColorHex: "#113CCF", assetName: "disney-plus"),
        .init(id: "max", name: "Max", aliases: ["max.com", "hbo max", "hbomax"], brandColorHex: "#0000FF", assetName: "max"),
        .init(id: "globoplay", name: "Globoplay", aliases: ["globoplay", "globo play"], brandColorHex: "#FA3E3E", assetName: "globoplay"),
        .init(id: "deezer", name: "Deezer", aliases: ["deezer"], brandColorHex: "#A238FF", assetName: "deezer"),
        .init(id: "steam", name: "Steam", aliases: ["steam", "steam games", "steampowered"], brandColorHex: "#171A21", assetName: "steam"),
        .init(id: "playstation", name: "PlayStation", aliases: ["playstation", "psn"], brandColorHex: "#003791", assetName: "playstation"),
        .init(id: "xbox", name: "Xbox", aliases: ["xbox", "microsoft*xbox"], brandColorHex: "#107C10", assetName: "xbox"),
        .init(id: "openai", name: "OpenAI", aliases: ["openai", "chatgpt"], brandColorHex: "#00A67E", assetName: "openai"),
        .init(id: "smartfit", name: "Smart Fit", aliases: ["smart fit", "smartfit"], brandColorHex: "#F68B1F", assetName: "smartfit"),
        .init(id: "totalpass", name: "TotalPass", aliases: ["totalpass", "total pass"], brandColorHex: "#1C1C1E", assetName: "totalpass"),
        .init(id: "gympass", name: "Gympass", aliases: ["gympass", "wellhub"], brandColorHex: "#E83D48", assetName: "gympass"),

        // Telecom & Serviços
        .init(id: "claro", name: "Claro", aliases: ["claro", "claro net"], brandColorHex: "#DA291C", assetName: "claro"),
        .init(id: "vivo", name: "Vivo", aliases: ["vivo", "telefonica brasil"], brandColorHex: "#660099", assetName: "vivo"),
        .init(id: "tim", name: "TIM", aliases: ["tim celular", "tim brasil", "tim"], brandColorHex: "#003399", assetName: "tim"),
        .init(id: "recargapay", name: "RecargaPay", aliases: ["recargapay", "recarga pay"], brandColorHex: "#00A650", assetName: "recargapay"),
    ]

    private struct CompiledAlias: Sendable {
        let entry: MerchantEntry
        let normalized: String
        let isShort: Bool
    }

    private static let compiledAliases: [CompiledAlias] = {
        var list: [CompiledAlias] = []
        for entry in entries {
            for alias in entry.aliases {
                let clean = normalize(alias)
                if !clean.isEmpty {
                    list.append(CompiledAlias(entry: entry, normalized: clean, isShort: clean.count <= 3))
                }
            }
        }
        list.sort { $0.normalized.count > $1.normalized.count }
        return list
    }()

    public static func normalize(_ text: String) -> String {
        let folded = text
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
        var result = ""
        var lastWasSpace = false
        for ch in folded {
            if ch.isLetter || ch.isNumber {
                result.append(ch)
                lastWasSpace = false
            } else if !lastWasSpace {
                result.append(" ")
                lastWasSpace = true
            }
        }
        return result.trimmingCharacters(in: .whitespaces)
    }

    public static func match(text: String?) -> MerchantEntry? {
        guard let text, !text.isEmpty else { return nil }
        let clean = normalize(text)
        guard !clean.isEmpty else { return nil }

        let padded = " \(clean) "
        for item in compiledAliases {
            if item.isShort {
                if padded.contains(" \(item.normalized) ") {
                    return item.entry
                }
            } else {
                if clean.contains(item.normalized) {
                    return item.entry
                }
            }
        }
        return nil
    }
}

public struct MerchantLogoView: View {
    public let entry: MerchantEntry
    public var size: CGFloat

    public init(entry: MerchantEntry, size: CGFloat = 36) {
        self.entry = entry
        self.size = size
    }

    public var body: some View {
        let brandColor = Color(hexString: entry.brandColorHex) ?? MeuFluxColors.bgSecondary
        ZStack {
            Circle()
                .fill(brandColor.opacity(0.15))
                .frame(width: size, height: size)
                .overlay(
                    Circle()
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )

            if let image = MerchantLogoImageLoader.image(named: entry.assetName) {
                image
                    .resizable()
                    .scaledToFit()
                    .frame(width: size * 0.72, height: size * 0.72)
                    .clipShape(Circle())
            } else {
                Text(String(entry.name.prefix(1)))
                    .font(.system(size: size * 0.45, weight: .bold))
                    .foregroundStyle(brandColor)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
