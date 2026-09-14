import SwiftUI
import FinancialDesignSystem
import Dashboard
import Accounts
import Transactions
import CreditCards
import Investments
import Loans
import Budget
import Goals
import Receivables
import ManualExpenses
import FinancialMoment
import JointFinance
import Subscriptions
import Agenda
import Reports
import BankConnections
import Settings

struct AdaptiveShell: View {
    @Bindable var composition: AppCompositionRoot
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedTab: AppRoute = .dashboard

    private var phoneTabs: [AppRoute] { [.dashboard, .transactions, .creditCards, .financialMoment] }

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
        .toolbarBackground(.visible, for: .tabBar)
        .onAppear { syncTab(with: composition.selectedRoute) }
        .onChange(of: composition.selectedRoute) { _, route in
            syncTab(with: route)
        }
    }

    @ViewBuilder
    private var moreStack: some View {
        if phoneTabs.contains(composition.selectedRoute) || composition.selectedRoute == .more {
            MoreMenuView(selection: $composition.selectedRoute, routes: visibleSidebar)
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
            .navigationTitle("Financial")
            .listStyle(.sidebar)
            .financialGlassChrome(cornerRadius: 0)
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
                onConnect: { composition.selectedRoute = .bankConnections }
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
                onReceivables: { composition.selectedRoute = .receivables }
            )
        case .loans:
            LoansView(repository: composition.loansRepository)
        case .budget:
            BudgetView(
                repository: composition.budgetRepository,
                transactions: composition.transactionsRepository
            )
        case .receivables:
            ReceivablesView(repository: composition.receivablesRepository)
            case .financialMoment:
                FinancialMomentView(
                    buildFinancialMomentDetail: composition.buildFinancialMomentDetail,
                    manageMonthlySalary: composition.manageMonthlySalary,
                toggleManualExpensePaid: composition.toggleManualExpensePaid,
                onCreateManualExpense: { composition.selectedRoute = .manualExpenses }
                )
        case .jointFinance:
            JointFinanceView(
                repository: composition.jointRepository,
                investments: composition.investmentsRepository,
                toggleManualExpensePaid: composition.toggleManualExpensePaid,
                onOpenSettings: { composition.selectedRoute = .settings }
            )
        case .manualExpenses:
            ManualExpensesView(
                repository: composition.manualExpensesRepository,
                accounts: composition.accountsRepository
            )
        case .subscriptions:
            SubscriptionsView(repository: composition.subscriptionsRepository)
        case .agenda:
            AgendaView(repository: composition.agendaRepository)
        case .goals:
            GoalsView(repository: composition.goalsRepository)
        case .reports:
            ReportsView(
                transactions: composition.transactionsRepository,
                accounts: composition.accountsRepository
            )
        case .bankConnections:
            BankConnectionsView(repository: composition.bankConnectionsRepository)
        case .settings:
            SettingsView(
                jointRepository: composition.jointRepository,
                settingsRepository: composition.settingsRepository,
                onSignOut: { Task { await composition.signOut() } },
                onJointChanged: { Task { await composition.refreshJointNav() } }
            )
        case .more:
            MoreMenuView(selection: $composition.selectedRoute, routes: visibleSidebar)
        }
    }
}

private struct MoreMenuView: View {
    @Binding var selection: AppRoute
    let routes: [AppRoute]

    private var extras: [AppRoute] {
        routes.filter {
        ![AppRoute.dashboard, .transactions, .creditCards, .financialMoment].contains($0)
        }
    }

    var body: some View {
        List(extras) { route in
            Button {
                selection = route
            } label: {
                Label(route.title, systemImage: route.systemImage)
            }
        }
        .navigationTitle("Mais")
    }
}
