import Foundation

/// Shared container between the app and widget extension.
public enum AppGroup {
    public static let identifier = "group.com.financehub.financial"
}

public enum WidgetKind {
    public static let financialMoment = "FinancialMomentWidget"
}

public enum WidgetDeepLink {
    public static let financialMoment = URL(string: "financehub://financial-moment")!
}

