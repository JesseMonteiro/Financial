import AppIntents
import SwiftUI
import MeuFluxDesignSystem
import MeuFluxDomain
#if canImport(UIKit)
import UIKit
#endif
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
    @State private var showAssistant = false
    @State private var tabBarWindowFrame: CGRect = .zero
    @State private var windowHeight: CGFloat = 0
    @State private var dashboardCache = DashboardViewModelCache()

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
                Tab(route.shortTitle, systemImage: route.systemImage, value: route) {
                    NavigationStack {
                        destination(for: route)
                    }
                }
            }

            Tab(AppRoute.more.shortTitle, systemImage: AppRoute.more.systemImage, value: AppRoute.more) {
                NavigationStack {
                    moreStack
                }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .overlay(alignment: .bottomTrailing) {
            AssistantCircleButton {
                showAssistant = true
            }
            .padding(.trailing, 16)
            .padding(.bottom, assistantBottomPadding)
            .animation(.easeOut(duration: 0.25), value: assistantBottomPadding)
            .ignoresSafeArea(.container, edges: .bottom)
        }
        .background {
            TabBarFrameProbe { frame, height in
                tabBarWindowFrame = frame
                windowHeight = height
            }
            .frame(width: 0, height: 0)
            .accessibilityHidden(true)
        }
        .sheet(isPresented: $showAssistant) {
            NavigationStack {
                MeuFluxAssistantView(model: composition.makeAssistantViewModel())
                    .navigationBarBackButtonHidden(true)
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button {
                                showAssistant = false
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(MeuFluxColors.textSecondary)
                            }
                            .accessibilityLabel("Fechar")
                        }
                    }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationBackground(MeuFluxColors.bgPrimary)
        }
        .id(composition.hasJointLink ? "tabs-joint" : "tabs-solo")
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

    private var assistantBottomPadding: CGFloat {
        guard tabBarWindowFrame.height > 1, windowHeight > 1 else { return 96 }
        return max(8, windowHeight - tabBarWindowFrame.minY + 8)
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
                viewModel: dashboardCache.viewModel(
                    loadDashboard: composition.loadDashboard,
                    transactions: composition.transactionsRepository,
                    accounts: composition.accountsRepository,
                    creditCards: composition.creditCardsRepository,
                    purchaseCategories: composition.purchaseCategoriesRepository
                ),
                accountName: composition.accountDisplayName,
                accountEmail: composition.accountEmail,
                onConnect: { composition.selectedRoute = .bankConnections },
                onSignOut: { Task { await composition.signOut() } },
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
                accounts: composition.accountsRepository,
                purchaseCategories: composition.purchaseCategoriesRepository
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
                purchaseCategories: composition.purchaseCategoriesRepository,
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
                    onOpenReceivables: { composition.selectedRoute = .receivables },
                    currentUserLabel: composition.accountDisplayName
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

@MainActor
private final class DashboardViewModelCache {
    private var cached: DashboardViewModel?
    private var fingerprint: String = ""

    func viewModel(
        loadDashboard: any LoadDashboardUseCase,
        transactions: (any TransactionsRepository)?,
        accounts: (any AccountsRepository)? = nil,
        creditCards: (any CreditCardsRepository)? = nil,
        purchaseCategories: (any PurchaseCategoriesRepository)? = nil
    ) -> DashboardViewModel {
        let next =
            "tx:\(transactions != nil)|acc:\(accounts != nil)|cards:\(creditCards != nil)|cats:\(purchaseCategories != nil)"
        if let cached, fingerprint == next { return cached }
        fingerprint = next
        let created = DashboardViewModel(
            loadDashboard: loadDashboard,
            transactions: transactions,
            accounts: accounts,
            creditCards: creditCards,
            purchaseCategories: purchaseCategories
        )
        cached = created
        return created
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

private struct AssistantCircleButton: View {
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "sparkles")
                .font(.body.weight(.semibold))
                .symbolRenderingMode(.hierarchical)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.circle)
        .controlSize(.large)
        .accessibilityLabel("Conversar com o assistente")
    }
}

#if os(iOS)
private struct TabBarFrameProbe: UIViewRepresentable {
    var onChange: (CGRect, CGFloat) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onChange: onChange)
    }

    func makeUIView(context: Context) -> ProbeView {
        let view = ProbeView()
        view.coordinator = context.coordinator
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ uiView: ProbeView, context: Context) {
        context.coordinator.onChange = onChange
        uiView.coordinator = context.coordinator
    }

    final class Coordinator {
        var onChange: (CGRect, CGFloat) -> Void
        var observations: [NSKeyValueObservation] = []

        init(onChange: @escaping (CGRect, CGFloat) -> Void) {
            self.onChange = onChange
        }
    }

    final class ProbeView: UIView {
        var coordinator: Coordinator?
        private var attachScheduled = false
        private var isApplying = false
        private weak var pinnedView: UIView?
        private var displayTarget: DisplayTarget?
        private var displayLinkUntil: CFTimeInterval = 0

        override func didMoveToWindow() {
            super.didMoveToWindow()
            if window == nil {
                stopTracking()
            }
            scheduleAttach()
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            scheduleAttach()
            report()
        }

        private func scheduleAttach() {
            guard !attachScheduled else { return }
            attachScheduled = true
            DispatchQueue.main.async { [weak self] in
                self?.attachScheduled = false
                self?.attach()
            }
        }

        private func attach() {
            guard let coordinator, let tabBar = findTabBar() else { return }
            coordinator.observations = [
                tabBar.observe(\.bounds, options: [.new, .initial]) { [weak self] _, _ in
                    DispatchQueue.main.async { self?.report(keepTracking: true) }
                },
                tabBar.observe(\.center, options: [.new]) { [weak self] _, _ in
                    DispatchQueue.main.async { self?.report(keepTracking: true) }
                },
            ]
            installLayoutHook(on: tabBar)
            report()
        }

        private func installLayoutHook(on tabBar: UITabBar) {
            let tag = 719_431
            guard tabBar.viewWithTag(tag) == nil else { return }
            let hook = LayoutHook()
            hook.tag = tag
            hook.probe = self
            hook.isUserInteractionEnabled = false
            hook.frame = .zero
            hook.autoresizingMask = []
            tabBar.addSubview(hook)
        }

        fileprivate func report(keepTracking: Bool = false) {
            guard let coordinator, let tabBar = findTabBar(), let window else { return }
            let dockFrame = pinMinimizedDock(tabBar, in: window)
            coordinator.onChange(dockFrame, window.bounds.height)
            if keepTracking {
                trackAnimation()
            }
        }

        @discardableResult
        private func pinMinimizedDock(_ tabBar: UITabBar, in window: UIWindow) -> CGRect {
            guard !isApplying else {
                if let pinnedView {
                    return pinnedView.convert(pinnedView.bounds, to: window)
                }
                return tabBar.convert(tabBar.bounds, to: window)
            }
            isApplying = true
            defer { isApplying = false }

            pinnedView?.transform = .identity

            let tabFrame = tabBar.convert(tabBar.bounds, to: window)
            if tabFrame.width < 220 {
                pinnedView = tabBar
                applyTrailingTransform(to: tabBar, in: window)
                return tabBar.convert(tabBar.bounds, to: window)
            }

            guard let capsule = leadingCapsule(around: tabBar, in: window) else {
                pinnedView = nil
                return tabFrame
            }

            pinnedView = capsule
            applyTrailingTransform(to: capsule, in: window)
            return capsule.convert(capsule.bounds, to: window)
        }

        private func leadingCapsule(around tabBar: UITabBar, in window: UIWindow) -> UIView? {
            var views: [UIView] = []
            collect(tabBar, into: &views)
            if let container = tabBar.superview {
                for sibling in container.subviews where sibling !== tabBar {
                    let name = NSStringFromClass(type(of: sibling))
                    if name.contains("Tab") {
                        collect(sibling, into: &views)
                    }
                }
            }

            let compact = views.filter { view in
                guard view !== tabBar, view.tag != 719_431 else { return false }
                guard !view.isHidden, view.alpha > 0.05 else { return false }
                let frame = view.convert(view.bounds, to: window)
                return frame.width >= 44
                    && frame.width <= 180
                    && frame.height >= 40
                    && frame.height <= 100
                    && frame.maxY > window.bounds.height - 140
            }

            let outermost = compact.filter { view in
                !compact.contains { other in
                    other !== view && view.isDescendant(of: other)
                }
            }
            guard !outermost.isEmpty else { return nil }

            let trailingExists = outermost.contains { view in
                view.convert(view.bounds, to: window).minX > window.bounds.width * 0.45
            }
            if trailingExists { return nil }

            return outermost.min { lhs, rhs in
                lhs.convert(lhs.bounds, to: window).minX < rhs.convert(rhs.bounds, to: window).minX
            }
        }

        private func applyTrailingTransform(to view: UIView, in window: UIWindow) {
            let frame = view.convert(view.bounds, to: window)
            let targetX = window.bounds.width - frame.width - 16
            let dx = targetX - frame.minX
            view.transform = abs(dx) > 0.5
                ? CGAffineTransform(translationX: dx, y: 0)
                : .identity
        }

        private func collect(_ view: UIView, into result: inout [UIView]) {
            result.append(view)
            for subview in view.subviews {
                collect(subview, into: &result)
            }
        }

        private func trackAnimation() {
            displayLinkUntil = CACurrentMediaTime() + 0.8
            guard displayTarget == nil else { return }
            let target = DisplayTarget(probe: self)
            let link = CADisplayLink(target: target, selector: #selector(DisplayTarget.tick))
            target.link = link
            link.add(to: .main, forMode: .common)
            displayTarget = target
        }

        fileprivate func handleDisplayLink() {
            report()
            if CACurrentMediaTime() >= displayLinkUntil {
                stopTracking()
            }
        }

        fileprivate func stopTracking() {
            displayTarget?.link?.invalidate()
            displayTarget?.link = nil
            displayTarget = nil
        }

        private func findTabBar() -> UITabBar? {
            guard let root = window else { return nil }
            return search(root)
        }

        private func search(_ view: UIView) -> UITabBar? {
            if let tabBar = view as? UITabBar { return tabBar }
            for subview in view.subviews {
                if let tabBar = search(subview) { return tabBar }
            }
            return nil
        }
    }

    final class LayoutHook: UIView {
        weak var probe: ProbeView?

        override func layoutSubviews() {
            super.layoutSubviews()
            probe?.report()
        }
    }

    final class DisplayTarget: NSObject {
        weak var probe: ProbeView?
        var link: CADisplayLink?

        init(probe: ProbeView) {
            self.probe = probe
        }

        @objc func tick() {
            guard let probe else {
                link?.invalidate()
                link = nil
                return
            }
            probe.handleDisplayLink()
        }
    }
}
#endif

private struct SiriBalanceTip: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            SiriTipView(intent: GetBalanceIntent())
            SiriTipView(intent: GetTopCardSpendIntent())
            ShortcutsLink()
        }
    }
}
