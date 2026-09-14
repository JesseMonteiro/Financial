import Foundation
import Observation
import FinancialDomain
import FinancialDesignSystem

@Observable
@MainActor
public final class SettingsViewModel {
    public private(set) var state: FeatureLoadState<AppSettings> = .idle
    public var settings = AppSettings()
    public var errorMessage: String?
    public var lastInviteCode: String?
    public var telegramURL: URL?

    private let jointRepository: (any JointFinanceRepository)?
    private let settingsRepository: (any SettingsRepository)?
    private var lastLoadedAt: Date?
    private var lastCacheKey: String?

    public init(
        jointRepository: (any JointFinanceRepository)? = nil,
        settingsRepository: (any SettingsRepository)? = nil
    ) {
        self.jointRepository = jointRepository
        self.settingsRepository = settingsRepository
    }

    public func load(force: Bool = false) async {
        let cacheKey = "settings"
        if ScreenCachePolicy.shouldSkipReload(
            force: force,
            lastLoadedAt: lastLoadedAt,
            lastCacheKey: lastCacheKey,
            cacheKey: cacheKey
        ) {
            return
        }

        state.beginLoad(silentIfPossible: true)
        if let settingsRepository {
            do {
                settings = try await settingsRepository.fetchSettings()
            } catch {
                settings = AppSettings()
            }
        } else {
        settings = AppSettings()
        }
        if let jointRepository {
            do {
                if let link = try await jointRepository.fetchLink(force: force), link.isActive {
                    settings.hasJointLink = true
                    settings.partnerName = link.partnerDisplayName
                } else {
                    settings.hasJointLink = false
                    settings.partnerName = nil
                }
            } catch {
                errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
            }
        }
        state = .loaded(settings)
        lastLoadedAt = Date()
        lastCacheKey = cacheKey
    }

    public func retry() async { await load(force: true) }

    public func persistAppearance() async {
        guard let settingsRepository else { return }
        do {
            try await settingsRepository.saveSettings(settings)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func linkTelegram() async {
        guard let settingsRepository else {
            settings.telegramLinked = true
            return
        }
        do {
            let token = try await settingsRepository.createTelegramLinkToken()
            telegramURL = URL(string: "https://t.me/FinancialJesse_bot?start=\(token)")
        settings.telegramLinked = true
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func disconnectTelegram() async {
        guard let settingsRepository else {
            settings.telegramLinked = false
            return
        }
        do {
            try await settingsRepository.disconnectTelegram()
        settings.telegramLinked = false
            telegramURL = nil
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func createJointInvite() async {
        guard let jointRepository else {
            lastInviteCode = String((0..<6).map { _ in String(Int.random(in: 0...9)) }.joined())
            return
        }
        do {
            lastInviteCode = try await jointRepository.createInvite()
            errorMessage = nil
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func acceptJointInvite(_ code: String) async {
        guard code.count == 6 else { return }
        guard let jointRepository else {
            settings.hasJointLink = true
            settings.partnerName = "Parceiro"
            return
        }
        do {
            try await jointRepository.acceptInvite(token: code)
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func unlinkJoint() async {
        guard let jointRepository else {
            settings.hasJointLink = false
            settings.partnerName = nil
            return
        }
        do {
            try await jointRepository.unlink()
            await load(force: true)
        } catch {
            errorMessage = (error as? FinancialError)?.messagePT ?? error.localizedDescription
        }
    }

    public func exportData() async {}
    public func requestAccountDeletion() async {}
}
