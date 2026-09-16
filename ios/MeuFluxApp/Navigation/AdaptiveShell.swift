import AppIntents
import SwiftUI
import MeuFluxDesignSystem
import Dashboard
import Accounts
import Transactions
import CreditCards
import Investments
import Loans
import Budget
import Goals
import Categories
import MealVouchers
import Receivables
import ManualExpenses
import FinancialMoment
import JointFinance
import Subscriptions
import Agenda
import Reports
import BankConnections
import Settings
import NotificationImport

struct AdaptiveShell: View {
    @Bindable var composition: AppCompositionRoot
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedTab: AppRoute = .dashboard

    private var phoneTabs: [AppRoute] {
        AppRoute.primaryTabs(hasJointLink: composition.hasJointLink)
    }

    private var visibleSidebar: [AppRoute] {
        AppRoute.sidebarItems(hasJointLink: composition.hasJointLink)
    }

    var body: some View {
        Group {
            if sizeClass == .regular {
                iPadShell
            } else {
                iPhoneShell
            }
        }
        .task {
            await composition.refreshJointNav()
        }
        .onChange(of: composition.hasJointLink) { _, hasLink in
            if !hasLink, composition.selectedRoute == .jointFinance {
                composition.selectedRoute = .more
            }
            // 4th tab swaps joint ↔ manuals; keep selection valid for TabView tags.
            if selectedTab != .more, !phoneTabs.contains(selectedTab) {
                selectedTab = phoneTabs.contains(composition.selectedRoute)
                    ? composition.selectedRoute
                    : .more
            } else {
                syncTab(with: composition.selectedRoute)
            }
        }
        .sheet(isPresented: Binding(
            get: { composition.pendingImportReviewId != nil },
            set: { if !$0 { composition.pendingImportReviewId = nil } }
        )) {
            if let recordId = composition.pendingImportReviewId {
                ImportReviewSheet(
                    recordId: recordId,
                    importer: composition.notificationImportService,
                    mealBenefits: composition.mealBenefitsRepository,
                    accounts: composition.accountsRepository
                )
            }
        }
    }

    private var iPhoneShell: some View {
        TabView(selection: $selectedTab) {
            ForEach(phoneTabs) { route in
                NavigationStack {
                    destination(for: route)
                }
                .tabItem {
                    Label(route.shortTitle, systemImage: route.systemImage)
                }
                .tag(route)
            }

            NavigationStack {
                moreStack
            }
            .tabItem {
                Label(AppRoute.more.shortTitle, systemImage: AppRoute.more.systemImage)
            }
            .tag(AppRoute.more)
        }
        .id(composition.hasJointLink ? "tabs-joint" : "tabs-solo")
        .toolbarBackground(.visible, for: .tabBar)
        .onAppear { syncTab(with: composition.selectedRoute) }
        .onChange(of: composition.selectedRoute) { _, route in
            syncTab(with: route)
        }
        .onChange(of: selectedTab) { _, tab in
            if phoneTabs.contains(tab) {
                composition.selectedRoute = tab
            } else if tab == .more,
                      phoneTabs.contains(composition.selectedRoute) {
                composition.selectedRoute = .more
            }
        }
    }

    @ViewBuilder
    private var moreStack: some View {
        if phoneTabs.contains(composition.selectedRoute) || composition.selectedRoute == .more {
            MoreMenuView(
                selection: $composition.selectedRoute,
                routes: visibleSidebar,
                primaryTabs: phoneTabs
            )
        } else {
            destination(for: composition.selectedRoute)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Mais") {
                            composition.selectedRoute = .more
                        }
                    }
                }
        }
    }

    private var iPadShell: some View {
        NavigationSplitView {
            List(visibleSidebar, selection: sidebarSelection) { route in
                Label(route.title, systemImage: route.systemImage)
            }
            .navigationTitle("MeuFlux")
            .listStyle(.sidebar)
            .meuFluxGlassChrome(cornerRadius: 0)
        } detail: {
            NavigationStack {
                destination(for: composition.selectedRoute)
            }
        }
    }

    private func syncTab(with route: AppRoute) {
        selectedTab = phoneTabs.contains(route) ? route : .more
    }

    private var sidebarSelection: Binding<AppRoute?> {
        Binding(
            get: { composition.selectedRoute },
            set: { if let route = $0 { composition.selectedRoute = route } }
        )
    }

    @ViewBuilder
    private func destination(for route: AppRoute) -> some View {
        switch route {
        case .dashboard:
            DashboardView(
                loadDashboard: composition.loadDashboard,
                transactions: composition.transactionsRepository,
                assistantFactory: { composition.makeAssistantViewModel() },
                onConnect: { composition.selectedRoute = .bankConnections },
                onTransactions: { composition.selectedRoute = .transactions },
                onCreditCards: { composition.selectedRoute = .creditCards },
                onInvestments: { composition.selectedRoute = .investments },
                onAgenda: { composition.selectedRoute = .agenda },
                onBudget: { composition.selectedRoute = .budget }
            )
        case .accounts:
            AccountsView(
                repository: composition.accountsRepository,
                onConnect: { composition.selectedRoute = .bankConnections },
                onInvestments: { composition.selectedRoute = .investments }
            )
        case .transactions:
            TransactionsView(
                transactions: composition.transactionsRepository,
                accounts: composition.accountsRepository
            )
        case .investments:
            InvestmentsView(
                repository: composition.investmentsRepository,
                jointRepository: composition.jointRepository,
                hasJointLink: composition.hasJointLink
            )
        case .creditCards:
            CreditCardsView(
                repository: composition.creditCardsRepository,
                manuals: composition.manualExpensesRepository,
                parseBill: composition.parseBill,
                receivables: composition.receivablesRepository,
                transactions: composition.transactionsRepository,
                onReceivables: { composition.selectedRoute = .receivables }
            )
        case .loans:
            LoansView(repository: composition.loansRepository)
        case .budget:
            BudgetView(
                repository: composition.budgetRepository,
                transactions: composition.transactionsRepository,
                purchaseCategories: composition.purchaseCategoriesRepository
            )
        case .receivables:
            ReceivablesView(repository: composition.receivablesRepository)
            case .financialMoment:
                FinancialMomentView(
                    buildFinancialMomentDetail: composition.buildFinancialMomentDetail,
                    manageMonthlySalary: composition.manageMonthlySalary,
                    toggleManualExpensePaid: composition.toggleManualExpensePaid,
                    manuals: composition.manualExpensesRepository,
                    receivables: composition.receivablesRepository,
                    purchaseCategories: composition.purchaseCategoriesRepository,
                    onCreateManualExpense: { composition.selectedRoute = .manualExpenses },
                    onOpenMealVouchers: { composition.selectedRoute = .mealVouchers },
                    onOpenReceivables: { composition.selectedRoute = .receivables }
                )
        case .jointFinance:
            JointFinanceView(
                repository: composition.jointRepository,
                investments: composition.investmentsRepository,
                toggleManualExpensePaid: composition.toggleManualExpensePaid,
                manuals: composition.manualExpensesRepository,
                receivables: composition.receivablesRepository,
                purchaseCategories: composition.purchaseCategoriesRepository,
                onOpenSettings: { composition.selectedRoute = .settings },
                onOpenMealVouchers: { composition.selectedRoute = .mealVouchers },
                onOpenManualExpenses: { composition.selectedRoute = .manualExpenses },
                onOpenReceivables: { composition.selectedRoute = .receivables }
            )
        case .manualExpenses:
            ManualExpensesView(
                repository: composition.manualExpensesRepository,
                accounts: composition.accountsRepository,
                togglePaid: composition.toggleManualExpensePaid,
                purchaseCategories: composition.purchaseCategoriesRepository
            )
        case .categories:
            CategoriesView(repository: composition.purchaseCategoriesRepository)
        case .subscriptions:
            SubscriptionsView(repository: composition.subscriptionsRepository)
        case .agenda:
            AgendaView(
                repository: composition.agendaRepository,
                togglePaid: composition.toggleManualExpensePaid
            )
        case .goals:
            GoalsView(repository: composition.goalsRepository)
        case .mealVouchers:
            MealVouchersView(repository: composition.mealBenefitsRepository)
        case .reports:
            ReportsView(repository: composition.reportsRepository)
        case .bankConnections:
            BankConnectionsView(repository: composition.bankConnectionsRepository)
        case .settings:
            SettingsView(
                jointRepository: composition.jointRepository,
                settingsRepository: composition.settingsRepository,
                onSignOut: { Task { await composition.signOut() } },
                onJointChanged: { Task { await composition.refreshJointNav() } },
                notificationImportDestination: AnyView(
                    NotificationImportSetupView(
                        importer: composition.notificationImportService,
                        mealBenefits: composition.mealBenefitsRepository,
                        accounts: composition.accountsRepository
                    )
                ),
                siriShortcutsTip: AnyView(SiriBalanceTip())
            )
        case .more:
            MoreMenuView(
                selection: $composition.selectedRoute,
                routes: visibleSidebar,
                primaryTabs: phoneTabs
            )
        }
    }
}

private struct MoreMenuView: View {
    @Binding var selection: AppRoute
    let routes: [AppRoute]
    let primaryTabs: [AppRoute]

    private var extras: [AppRoute] {
        let primary = Set(primaryTabs)
        return routes.filter { !primary.contains($0) }
    }

    var body: some View {
        List(extras) { route in
            Button {
                selection = route
            } label: {
                Label(route.title, systemImage: route.systemImage)
            }
        }
        .meuFluxPageTitle("Mais")
    }
}

private struct SiriBalanceTip: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SiriTipView(intent: GetBalanceIntent())
            SiriTipView(intent: GetTopCardSpendIntent())
            ShortcutsLink()
        }
    }
}
