import Foundation
import Observation
import WidgetKit
import MeuFluxCore
import MeuFluxData
import MeuFluxDomain
import MeuFluxDesignSystem
import MeuFluxIntelligence
import Authentication

private struct SupabaseAuthSigning: AuthSigning {
    let service: SupabaseAuthService

    func signIn(email: String, password: String) async throws {
        try await mapAuth {
            try await service.signIn(email: email, password: password)
        }
    }

    func signUp(email: String, password: String, fullName: String) async throws {
        try await mapAuth {
            try await service.signUp(email: email, password: password, fullName: fullName)
        }
    }

    func resetPassword(email: String) async throws {
        try await mapAuth {
            try await service.resetPassword(email: email)
        }
    }

    private func mapAuth(_ work: () async throws -> Void) async throws {
        do {
            try await work()
        } catch let error as AppError {
            switch error {
            case .unauthorized:
                throw FinancialError.validation("E-mail ou senha incorretos.")
            case .configuration(let detail):
                throw FinancialError.validation(detail)
            default:
                throw FinancialError.underlying(error.localizedDescriptionPT)
            }
        } catch {
            throw FinancialError.underlying(error.localizedDescription)
        }
    }
}

@Observable
@MainActor
final class AppCompositionRoot {
    let env: EnvConfig
    let logger: AppLogger
    let clock: any Clock
    let locale: LocaleProvider
    let reachability: any NetworkReachability
    let authSession: KeychainAuthSession
    let authService: SupabaseAuthService
    let apiClient: APIClient
    let bff: BFFClient
    let cache: CacheActor
    let offlineQueue: OfflineMutationQueue

    let authViewModel: AuthenticationViewModel

    let accountsRepository: any AccountsRepository
    let transactionsRepository: any TransactionsRepository
    let billsRepository: any BillsRepository
    let investmentsRepository: any InvestmentsRepository
    let loansRepository: any LoansRepository
    let budgetRepository: any BudgetRepository
    let goalsRepository: any GoalsRepository
    let purchaseCategoriesRepository: any PurchaseCategoriesRepository
    let mealBenefitsRepository: any MealBenefitsRepository
    let receivablesRepository: any ReceivablesRepository
    let manualExpensesRepository: any ManualExpensesRepository
    let jointRepository: any JointFinanceRepository
    let subscriptionsRepository: any SubscriptionsRepository
    let agendaRepository: any AgendaRepository
    let reportsRepository: any ReportsRepository
    let profileRepository: any ProfileRepository
    let settingsRepository: any SettingsRepository
    let bankConnectionsRepository: any BankConnectionsRepository
    let creditCardsRepository: any CreditCardsRepository

    let loadDashboard: any LoadDashboardUseCase
    let syncBankItem: any SyncBankItemUseCase
    let buildFinancialMoment: any BuildFinancialMomentUseCase
    let buildFinancialMomentDetail: any BuildFinancialMomentDetailUseCase
    let widgetStore: FinancialMomentWidgetStore
    let siriSnapshotStore: SiriSnapshotStore
    let notificationImportStore: LiveNotificationImportStore
    let notificationImportService: NotificationImportService
    let manageMonthlySalary: any ManageMonthlySalaryUseCase
    let toggleManualExpensePaid: any ToggleManualExpensePaidUseCase
    let summarizeOpenBill: any SummarizeOpenBillUseCase
    let parseBill: any ParseBillUseCase

    var isAuthenticated: Bool = false
    /// `false` until the first session restore finishes — prevents the login flash on cold start.
    var hasBootstrapped: Bool = false
    var isOffline: Bool = false
    var selectedRoute: AppRoute = .dashboard
    var configurationWarning: String?
    var hasJointLink: Bool = false
    var pendingImportReviewId: String?
    private var lastWidgetRefreshAt: Date?

    init(env: EnvConfig = .fromBundle()) {
        self.env = env
        self.logger = AppLogger(enabled: env.featureFlags.debugLogging)
        self.clock = SystemClock()
        self.locale = .brazil
        self.reachability = AlwaysOnlineReachability()
        self.authSession = KeychainAuthSession()
        self.authService = SupabaseAuthService(config: env, session: authSession, logger: logger)
        self.apiClient = APIClient(
            baseURL: env.apiBaseURL,
            authSession: authSession,
            tokenRefresher: authService,
            logger: logger,
            supabaseAnonKey: env.supabaseAnonKey
        )
        self.cache = CacheActor()
        self.bff = BFFClient(api: apiClient, cache: cache)
        self.offlineQueue = OfflineMutationQueue(logger: logger)

        self.accountsRepository = LiveAccountsRepository(bff: bff)
        self.transactionsRepository = LiveTransactionsRepository(bff: bff)
        self.billsRepository = LiveBillsRepository(bff: bff)
        self.investmentsRepository = LiveInvestmentsRepository(bff: bff)
        self.loansRepository = LiveLoansRepository(bff: bff)
        self.budgetRepository = LiveBudgetRepository(bff: bff)
        self.goalsRepository = LiveGoalsRepository(bff: bff)
        self.purchaseCategoriesRepository = LivePurchaseCategoriesRepository(bff: bff)
        self.mealBenefitsRepository = LiveMealBenefitsRepository(bff: bff)
        self.receivablesRepository = LiveReceivablesRepository(bff: bff)
        self.manualExpensesRepository = LiveManualExpensesRepository(bff: bff)
        self.jointRepository = LiveJointFinanceRepository(bff: bff)
        self.subscriptionsRepository = LiveSubscriptionsRepository(bff: bff)
        self.agendaRepository = LiveAgendaRepository(bff: bff)
        self.reportsRepository = LiveReportsRepository(bff: bff)
        self.profileRepository = LiveProfileRepository(bff: bff)
        self.settingsRepository = LiveSettingsRepository(bff: bff)
        self.bankConnectionsRepository = LiveBankConnectionsRepository(bff: bff)
        self.creditCardsRepository = LiveCreditCardsRepository(bff: bff)
        self.notificationImportStore = LiveNotificationImportStore()
        self.notificationImportService = NotificationImportService(
            store: notificationImportStore,
            mealBenefits: mealBenefitsRepository,
            manuals: manualExpensesRepository,
            authSession: authSession,
            logger: logger,
            categorizer: PurchaseCategorizer(),
            parseAssistant: NotificationParseAssistant()
        )

        self.siriSnapshotStore = SiriSnapshotStore()
        self.loadDashboard = IntelligencePublishingDashboard(
            inner: LiveLoadDashboard(bff: bff),
            store: siriSnapshotStore,
            narrator: InsightNarrator(),
            onIndexed: { snapshot in
                await SpotlightFinanceIndexer.index(snapshot)
            }
        )
        self.syncBankItem = LiveSyncBankItem(bff: bff)
        self.parseBill = LiveParseBill(bff: bff)
        self.widgetStore = FinancialMomentWidgetStore()
        self.buildFinancialMomentDetail = WidgetPublishingFinancialMomentDetail(
            inner: LiveBuildFinancialMomentDetail(bffClient: bff),
            store: widgetStore,
            clock: clock,
            enabled: env.featureFlags.widgetsEnabled
        )
        self.buildFinancialMoment = LiveBuildFinancialMoment(detail: buildFinancialMomentDetail)
        self.manageMonthlySalary = LiveManageMonthlySalary(bffClient: bff)
        self.toggleManualExpensePaid = LiveToggleManualExpensePaid(bffClient: bff)
        self.summarizeOpenBill = StubSummarizeOpenBill()

        self.authViewModel = AuthenticationViewModel(auth: SupabaseAuthSigning(service: authService))
        if !env.isConfigured {
            configurationWarning =
                "Secrets.xcconfig incompleto: defina SUPABASE_URL, SUPABASE_ANON_KEY e API_BASE_URL."
            authViewModel.configurationHint = configurationWarning
        }
    }

    func bootstrap() async {
        if await authSession.isAuthenticated() {
            do {
                _ = try await authService.validAccessToken()
                isAuthenticated = true
            } catch {
                logger.error("Sessão inválida no bootstrap: \(error.localizedDescription)", category: .auth)
                try? await authSession.clear()
                isAuthenticated = false
            }
        } else {
            isAuthenticated = false
        }
        isOffline = await !reachability.isOnline
        // Unlock the splash/login as soon as the session is known. Spotlight and
        // widget I/O can stall on a cold launch and must not block first paint.
        hasBootstrapped = true
        IntentRuntime.shared.bind(self)
        Task { await completeBootstrapSideEffects() }
    }

    private func completeBootstrapSideEffects() async {
        if isAuthenticated {
            await refreshAppearance()
            await refreshJointNav()
            await refreshWidgetSnapshot()
            await NotificationImportRuntime.shared.register(notificationImportService)
            _ = await notificationImportService.processQueued(now: Date())
        } else {
            hasJointLink = false
            await NotificationImportRuntime.shared.register(notificationImportService)
            await clearWidgetSnapshot()
            await clearSiriSnapshot()
        }
    }

    func signOut() async {
        try? await authService.signOut()
        await cache.clear()
        await clearWidgetSnapshot()
        await clearSiriSnapshot()
        authViewModel.isAuthenticated = false
        isAuthenticated = false
        hasJointLink = false
        selectedRoute = .dashboard
    }

    func handleDeepLink(_ url: URL) {
        switch AppDeepLink.parse(url) {
        case .importReview(let id):
            pendingImportReviewId = id
        case .route(let route):
            selectedRoute = route
        case nil:
            break
        }
    }

    func refreshJointNav() async {
        do {
            let link = try await jointRepository.fetchLink(force: true)
            hasJointLink = link?.isActive == true
        } catch {
            hasJointLink = false
        }
    }

    private func refreshAppearance() async {
        do {
            let settings = try await settingsRepository.fetchSettings()
            AppearancePreferences.shared.apply(settings.theme)
        } catch {
            logger.error(
                "Falha ao carregar tema: \(error.localizedDescription)",
                category: .ui
            )
        }
    }

    func refreshWidgetSnapshot(force: Bool = false) async {
        guard env.featureFlags.widgetsEnabled else { return }
        if await !authSession.isAuthenticated() {
            await clearWidgetSnapshot()
            return
        }
        if !force, let last = lastWidgetRefreshAt, clock.now().timeIntervalSince(last) < 15 * 60 {
            await reloadWidgetTimelines()
            return
        }
        widgetStore.setAuthenticated(true)
        do {
            _ = try await buildFinancialMomentDetail.execute(
                month: YearMonth(from: clock.now()),
                force: force
            )
            lastWidgetRefreshAt = clock.now()
        } catch {
            logger.error(
                "Falha ao atualizar widget do momento financeiro: \(error.localizedDescription)",
                category: .cache
            )
            await reloadWidgetTimelines()
        }
    }

    func clearWidgetSnapshot() async {
        widgetStore.clear()
        lastWidgetRefreshAt = nil
        await reloadWidgetTimelines()
    }

    func clearSiriSnapshot() async {
        siriSnapshotStore.clear()
        await SpotlightFinanceIndexer.clear()
    }

    private func reloadWidgetTimelines() async {
        await MainActor.run {
            WidgetCenter.shared.reloadTimelines(ofKind: WidgetKind.financialMoment)
        }
    }
}
