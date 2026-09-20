// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MeuFlux",
    defaultLocalization: "pt-BR",
    platforms: [
        .iOS(.v26),
        .macOS(.v26),
    ],
    products: [
        .library(name: "MeuFluxCore", targets: ["MeuFluxCore"]),
        .library(name: "MeuFluxDomain", targets: ["MeuFluxDomain"]),
        .library(name: "MeuFluxData", targets: ["MeuFluxData"]),
        .library(name: "MeuFluxDesignSystem", targets: ["MeuFluxDesignSystem"]),
        .library(name: "Authentication", targets: ["Authentication"]),
        .library(name: "Dashboard", targets: ["Dashboard"]),
        .library(name: "Accounts", targets: ["Accounts"]),
        .library(name: "Transactions", targets: ["Transactions"]),
        .library(name: "CreditCards", targets: ["CreditCards"]),
        .library(name: "Investments", targets: ["Investments"]),
        .library(name: "Loans", targets: ["Loans"]),
        .library(name: "Budget", targets: ["Budget"]),
        .library(name: "Goals", targets: ["Goals"]),
        .library(name: "Categories", targets: ["Categories"]),
        .library(name: "MealVouchers", targets: ["MealVouchers"]),
        .library(name: "Receivables", targets: ["Receivables"]),
        .library(name: "ManualExpenses", targets: ["ManualExpenses"]),
        .library(name: "FinancialMoment", targets: ["FinancialMoment"]),
        .library(name: "JointFinance", targets: ["JointFinance"]),
        .library(name: "Subscriptions", targets: ["Subscriptions"]),
        .library(name: "Agenda", targets: ["Agenda"]),
        .library(name: "Reports", targets: ["Reports"]),
        .library(name: "BankConnections", targets: ["BankConnections"]),
        .library(name: "Settings", targets: ["Settings"]),
        .library(name: "NotificationImport", targets: ["NotificationImport"]),
        .library(name: "MeuFluxIntelligence", targets: ["MeuFluxIntelligence"]),
    ],
    targets: [
        .target(
            name: "MeuFluxCore",
            path: "Packages/MeuFluxCore/Sources/MeuFluxCore"
        ),
        .target(
            name: "MeuFluxDomain",
            path: "Packages/MeuFluxDomain/Sources/MeuFluxDomain"
        ),
        .target(
            name: "MeuFluxData",
            dependencies: ["MeuFluxDomain", "MeuFluxCore"],
            path: "Packages/MeuFluxData/Sources/MeuFluxData"
        ),
        .target(
            name: "MeuFluxDesignSystem",
            dependencies: ["MeuFluxCore", "MeuFluxDomain"],
            path: "Packages/MeuFluxDesignSystem/Sources/MeuFluxDesignSystem",
            resources: [
                .process("Resources/CardFaces.xcassets"),
                .process("Resources/CardFaces"),
                .copy("Resources/MerchantLogos"),
                .process("Resources/Brand.xcassets"),
                .copy("Resources/LogoLoading.gif"),
            ]
        ),
        .target(name: "Authentication", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Authentication/Sources/Authentication"),
        .target(name: "Dashboard", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem", "MeuFluxIntelligence"], path: "Packages/Features/Dashboard/Sources/Dashboard"),
        .target(name: "Accounts", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Accounts/Sources/Accounts"),
        .target(name: "Transactions", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Transactions/Sources/Transactions"),
        .target(name: "CreditCards", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/CreditCards/Sources/CreditCards"),
        .target(name: "Investments", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Investments/Sources/Investments"),
        .target(name: "Loans", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Loans/Sources/Loans"),
        .target(name: "Budget", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Budget/Sources/Budget"),
        .target(name: "Goals", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Goals/Sources/Goals"),
        .target(name: "Categories", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Categories/Sources/Categories"),
        .target(name: "MealVouchers", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/MealVouchers/Sources/MealVouchers"),
        .target(name: "Receivables", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Receivables/Sources/Receivables"),
        .target(name: "ManualExpenses", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/ManualExpenses/Sources/ManualExpenses"),
        .target(name: "FinancialMoment", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/FinancialMoment/Sources/FinancialMoment"),
        .target(name: "JointFinance", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem", "MeuFluxCore"], path: "Packages/Features/JointFinance/Sources/JointFinance"),
        .target(name: "Subscriptions", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Subscriptions/Sources/Subscriptions"),
        .target(name: "Agenda", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Agenda/Sources/Agenda"),
        .target(name: "Reports", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/Reports/Sources/Reports"),
        .target(name: "BankConnections", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/BankConnections/Sources/BankConnections"),
        .target(name: "Settings", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem", "MeuFluxIntelligence"], path: "Packages/Features/Settings/Sources/Settings"),
        .target(name: "NotificationImport", dependencies: ["MeuFluxDomain", "MeuFluxDesignSystem"], path: "Packages/Features/NotificationImport/Sources/NotificationImport"),
        .target(
            name: "MeuFluxIntelligence",
            dependencies: ["MeuFluxDomain", "MeuFluxCore"],
            path: "Packages/MeuFluxIntelligence/Sources/MeuFluxIntelligence"
        ),
        .testTarget(
            name: "MeuFluxTests",
            dependencies: ["MeuFluxDomain", "MeuFluxCore", "MeuFluxData", "MeuFluxDesignSystem", "MeuFluxIntelligence", "Dashboard"],
            path: "MeuFluxTests"
        ),
    ]
)
