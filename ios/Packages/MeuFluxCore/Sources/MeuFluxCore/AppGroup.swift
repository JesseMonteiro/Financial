import Foundation

/// Shared container between the app and widget extension.
public enum AppGroup {
    public static let identifier = "group.com.meuflux.app"

    /// `true` when the App Group entitlement is present and the shared container exists.
    /// Without this, `UserDefaults(suiteName:)` may still return an object that is **not**
    /// shared with the widget extension — widgets then show "Abra o app…".
    public static var isAvailable: Bool {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) != nil
    }

    public static var userDefaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
    }
}

public enum WidgetKind {
    public static let financialMoment = "FinancialMomentWidget"
    public static let jointFinance = "JointFinanceWidget"
    public static let budget = "BudgetWidget"

    public static let allTimelineKinds: [String] = [financialMoment, jointFinance, budget]
}

public enum WidgetDeepLink {
    public static let financialMoment = URL(string: "meuflux://financial-moment")!
    public static let jointFinance = URL(string: "meuflux://joint-account")!
    public static let budget = URL(string: "meuflux://budget")!

    public static func importReview(id: String) -> URL {
        var components = URLComponents(string: "meuflux://import-review")!
        components.queryItems = [URLQueryItem(name: "id", value: id)]
        return components.url!
    }
}

