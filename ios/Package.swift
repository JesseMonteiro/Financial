// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "Financial",
    defaultLocalization: "pt-BR",
    platforms: [
        .iOS(.v26),
        .macOS(.v26),
    ],
    products: [
        .library(name: "FinancialCore", targets: ["FinancialCore"]),
        .library(name: "FinancialDomain", targets: ["FinancialDomain"]),
        .library(name: "FinancialData", targets: ["FinancialData"]),
        .library(name: "FinancialDesignSystem", targets: ["FinancialDesignSystem"]),
        .library(name: "Authentication", targets: ["Authentication"]),
        .library(name: "Dashboard", targets: ["Dashboard"]),
        .library(name: "Accounts", targets: ["Accounts"]),
        .library(name: "Transactions", targets: ["Transactions"]),
        .library(name: "CreditCards", targets: ["CreditCards"]),
        .library(name: "Investments", targets: ["Investments"]),
        .library(name: "Loans", targets: ["Loans"]),
        .library(name: "Budget", targets: ["Budget"]),
        .library(name: "Goals", targets: ["Goals"]),
        .library(name: "Receivables", targets: ["Receivables"]),
        .library(name: "ManualExpenses", targets: ["ManualExpenses"]),
        .library(name: "FinancialMoment", targets: ["FinancialMoment"]),
        .library(name: "JointFinance", targets: ["JointFinance"]),
        .library(name: "Subscriptions", targets: ["Subscriptions"]),
        .library(name: "Agenda", targets: ["Agenda"]),
        .library(name: "Reports", targets: ["Reports"]),
        .library(name: "BankConnections", targets: ["BankConnections"]),
        .library(name: "Settings", targets: ["Settings"]),
    ],
    targets: [
        .target(
            name: "FinancialCore",
            path: "Packages/FinancialCore/Sources/FinancialCore"
        ),
        .target(
            name: "FinancialDomain",
            path: "Packages/FinancialDomain/Sources/FinancialDomain"
        ),
        .target(
            name: "FinancialData",
            dependencies: ["FinancialDomain", "FinancialCore"],
            path: "Packages/FinancialData/Sources/FinancialData"
        ),
        .target(
            name: "FinancialDesignSystem",
            dependencies: ["FinancialCore"],
            path: "Packages/FinancialDesignSystem/Sources/FinancialDesignSystem",
            resources: [
                .process("Resources/CardFaces.xcassets"),
                .process("Resources/CardFaces"),
                .process("Resources/Brand.xcassets"),
                .copy("Resources/LogoLoading.gif"),
            ]
        ),
        .target(name: "Authentication", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Authentication/Sources/Authentication"),
        .target(name: "Dashboard", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Dashboard/Sources/Dashboard"),
        .target(name: "Accounts", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Accounts/Sources/Accounts"),
        .target(name: "Transactions", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Transactions/Sources/Transactions"),
        .target(name: "CreditCards", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/CreditCards/Sources/CreditCards"),
        .target(name: "Investments", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Investments/Sources/Investments"),
        .target(name: "Loans", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Loans/Sources/Loans"),
        .target(name: "Budget", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Budget/Sources/Budget"),
        .target(name: "Goals", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Goals/Sources/Goals"),
        .target(name: "Receivables", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Receivables/Sources/Receivables"),
        .target(name: "ManualExpenses", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/ManualExpenses/Sources/ManualExpenses"),
        .target(name: "FinancialMoment", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/FinancialMoment/Sources/FinancialMoment"),
        .target(name: "JointFinance", dependencies: ["FinancialDomain", "FinancialDesignSystem", "FinancialCore"], path: "Packages/Features/JointFinance/Sources/JointFinance"),
        .target(name: "Subscriptions", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Subscriptions/Sources/Subscriptions"),
        .target(name: "Agenda", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Agenda/Sources/Agenda"),
        .target(name: "Reports", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Reports/Sources/Reports"),
        .target(name: "BankConnections", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/BankConnections/Sources/BankConnections"),
        .target(name: "Settings", dependencies: ["FinancialDomain", "FinancialDesignSystem"], path: "Packages/Features/Settings/Sources/Settings"),
        .testTarget(
            name: "FinancialDomainTests",
            dependencies: ["FinancialDomain", "FinancialCore", "FinancialData", "FinancialDesignSystem"],
            path: "FinancialTests"
        ),
    ]
)
