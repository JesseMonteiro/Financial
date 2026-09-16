import Foundation

/// Shared icon ids stored on `PurchaseCategory.icon` (iOS SF Symbol + web Lucide).
public struct CategoryIconOption: Sendable, Hashable, Identifiable, Codable {
    public let id: String
    public let systemImage: String
    public let label: String

    public init(id: String, systemImage: String, label: String) {
        self.id = id
        self.systemImage = systemImage
        self.label = label
    }
}

public enum CategoryIconCatalog {
    public static let options: [CategoryIconOption] = [
        .init(id: "utensils", systemImage: "fork.knife", label: "Alimentação"),
        .init(id: "cart", systemImage: "cart.fill", label: "Supermercado"),
        .init(id: "bag", systemImage: "bag.fill", label: "Sacola"),
        .init(id: "cup", systemImage: "cup.and.saucer.fill", label: "Café"),
        .init(id: "takeout", systemImage: "takeoutbag.and.cup.and.straw.fill", label: "Delivery"),
        .init(id: "wineglass", systemImage: "wineglass.fill", label: "Bar"),
        .init(id: "home", systemImage: "house.fill", label: "Casa"),
        .init(id: "building", systemImage: "building.2.fill", label: "Prédio"),
        .init(id: "sofa", systemImage: "sofa.fill", label: "Móveis"),
        .init(id: "bolt", systemImage: "bolt.fill", label: "Energia"),
        .init(id: "drop", systemImage: "drop.fill", label: "Água"),
        .init(id: "flame", systemImage: "flame.fill", label: "Gás"),
        .init(id: "wifi", systemImage: "wifi", label: "Internet"),
        .init(id: "phone", systemImage: "phone.fill", label: "Telefone"),
        .init(id: "car", systemImage: "car.fill", label: "Carro"),
        .init(id: "bus", systemImage: "bus.fill", label: "Ônibus"),
        .init(id: "tram", systemImage: "tram.fill", label: "Metrô"),
        .init(id: "fuelpump", systemImage: "fuelpump.fill", label: "Combustível"),
        .init(id: "bicycle", systemImage: "bicycle", label: "Bicicleta"),
        .init(id: "airplane", systemImage: "airplane", label: "Viagem"),
        .init(id: "bed", systemImage: "bed.double.fill", label: "Hotel"),
        .init(id: "ticket", systemImage: "ticket.fill", label: "Ingresso"),
        .init(id: "film", systemImage: "film.fill", label: "Cinema"),
        .init(id: "gamecontroller", systemImage: "gamecontroller.fill", label: "Games"),
        .init(id: "music", systemImage: "music.note", label: "Música"),
        .init(id: "tv", systemImage: "tv.fill", label: "Streaming"),
        .init(id: "party", systemImage: "party.popper.fill", label: "Festa"),
        .init(id: "heart", systemImage: "heart.fill", label: "Saúde"),
        .init(id: "crosscase", systemImage: "cross.case.fill", label: "Farmácia"),
        .init(id: "pills", systemImage: "pills.fill", label: "Remédios"),
        .init(id: "figure", systemImage: "figure.run", label: "Esporte"),
        .init(id: "graduationcap", systemImage: "graduationcap.fill", label: "Educação"),
        .init(id: "book", systemImage: "book.fill", label: "Livros"),
        .init(id: "pencil", systemImage: "pencil", label: "Estudos"),
        .init(id: "briefcase", systemImage: "briefcase.fill", label: "Trabalho"),
        .init(id: "creditcard", systemImage: "creditcard.fill", label: "Cartão"),
        .init(id: "banknote", systemImage: "banknote.fill", label: "Dinheiro"),
        .init(id: "chart", systemImage: "chart.line.uptrend.xyaxis", label: "Investimentos"),
        .init(id: "percent", systemImage: "percent", label: "Juros"),
        .init(id: "gift", systemImage: "gift.fill", label: "Presente"),
        .init(id: "pawprint", systemImage: "pawprint.fill", label: "Pets"),
        .init(id: "tshirt", systemImage: "tshirt.fill", label: "Roupas"),
        .init(id: "scissors", systemImage: "scissors", label: "Beleza"),
        .init(id: "wrench", systemImage: "wrench.and.screwdriver.fill", label: "Serviços"),
        .init(id: "hammer", systemImage: "hammer.fill", label: "Reforma"),
        .init(id: "leaf", systemImage: "leaf.fill", label: "Natureza"),
        .init(id: "baby", systemImage: "figure.and.child.holdinghands", label: "Família"),
        .init(id: "stroller", systemImage: "stroller.fill", label: "Bebê"),
        .init(id: "handraised", systemImage: "hand.raised.fill", label: "Doação"),
        .init(id: "shield", systemImage: "shield.fill", label: "Seguro"),
        .init(id: "doc", systemImage: "doc.text.fill", label: "Documentos"),
        .init(id: "envelope", systemImage: "envelope.fill", label: "Correios"),
        .init(id: "cartbadge", systemImage: "cart.badge.plus", label: "Compras+"),
        .init(id: "storefront", systemImage: "storefront.fill", label: "Loja"),
        .init(id: "tag", systemImage: "tag.fill", label: "Etiqueta"),
        .init(id: "star", systemImage: "star.fill", label: "Favorito"),
        .init(id: "sparkles", systemImage: "sparkles", label: "Destaque"),
        .init(id: "ellipsis", systemImage: "ellipsis.circle.fill", label: "Outros"),
    ]

    public static func option(id: String?) -> CategoryIconOption? {
        guard let id, !id.isEmpty else { return nil }
        return options.first { $0.id == id }
    }

    public static func systemImage(forIconId id: String?) -> String {
        option(id: id)?.systemImage ?? ExpenseCategoryKind.other.systemImage
    }

    public static func defaultIconId(forKey key: String) -> String {
        if let kind = ExpenseCategoryKind(rawValue: key) {
            return defaultIconId(for: kind)
        }
        if let kind = PurchaseCategoryCatalog.kind(forPluggyOrKey: key) {
            return defaultIconId(for: kind)
        }
        return "ellipsis"
    }

    public static func defaultIconId(for kind: ExpenseCategoryKind) -> String {
        switch kind {
        case .food: return "utensils"
        case .groceries: return "cart"
        case .rent: return "home"
        case .utilities: return "bolt"
        case .transport: return "car"
        case .entertainment: return "ticket"
        case .health: return "crosscase"
        case .education: return "graduationcap"
        case .other: return "ellipsis"
        }
    }
}
