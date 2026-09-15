import Foundation

/// Shared container between the app and widget extension.
public enum AppGroup {
    public static let identifier = "group.com.meuflux.app"

    public static var userDefaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }
}

public enum WidgetKind {
    public static let financialMoment = "FinancialMomentWidget"
}

public enum WidgetDeepLink {
    public static let financialMoment = URL(string: "meuflux://financial-moment")!

    public static func importReview(id: String) -> URL {
        var components = URLComponents(string: "meuflux://import-review")!
        components.queryItems = [URLQueryItem(name: "id", value: id)]
        return components.url!
    }
}

