import Foundation
import UserNotifications
import MeuFluxDomain
import MeuFluxCore

enum ImportLocalNotifications {
    static let categoryId = "meuflux.import.review"
    static let editActionId = "import.edit"
    static let undoActionId = "import.undo"
    static let recordIdKey = "recordId"

    static func registerCategories() {
        let edit = UNNotificationAction(
            identifier: editActionId,
            title: "Editar",
            options: [.foreground]
        )
        let undo = UNNotificationAction(
            identifier: undoActionId,
            title: "Desfazer",
            options: [.destructive]
        )
        let category = UNNotificationCategory(
            identifier: categoryId,
            actions: [edit, undo],
            intentIdentifiers: [],
            options: []
        )
        UNUserNotificationCenter.current().setNotificationCategories([category])
    }

    static func post(outcome: NotificationImportOutcome) async {
        guard outcome.shouldNotify else { return }
        let content = UNMutableNotificationContent()
        content.categoryIdentifier = categoryId
        content.sound = .default
        content.threadIdentifier = "notification-import"
        switch outcome {
        case .imported(let record):
            let amount = record.parsed?.amount.formatted() ?? ""
            let merchant = record.parsed?.displayMerchant ?? "compra"
            content.title = "Compra importada"
            content.body = "\(amount) em \(merchant) — toque para editar."
            content.userInfo = [recordIdKey: record.id]
        case .needsDestination(let record):
            content.title = "Escolha a conta"
            content.body = "Reconhecemos a compra. Toque para escolher VA/VR ou conta manual."
            content.userInfo = [recordIdKey: record.id]
        case .needsReview(let record):
            content.title = "Revisar notificação"
            content.body = "Não entendi esta compra. Toque para revisar o texto."
            content.userInfo = [recordIdKey: record.id]
        case .queued(let record):
            content.title = "Compra na fila"
            content.body = "Abra o MeuFlux para concluir a importação."
            content.userInfo = [recordIdKey: record.id]
        case .failed(let message):
            content.title = "Falha ao importar"
            content.body = message
        default:
            return
        }
        let identifier = outcome.record?.id ?? UUID().uuidString
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)
        try? await UNUserNotificationCenter.current().add(request)
    }
}

final class ImportNotificationCenter: NSObject, UNUserNotificationCenterDelegate, @unchecked Sendable {
    static let shared = ImportNotificationCenter()

    @MainActor var onOpenReview: ((String) -> Void)?
    @MainActor var undoHandler: ((String) async -> Void)?

    func configure() {
        ImportLocalNotifications.registerCategories()
        UNUserNotificationCenter.current().delegate = self
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let info = response.notification.request.content.userInfo
        guard let recordId = info[ImportLocalNotifications.recordIdKey] as? String else { return }
        let action = response.actionIdentifier
        await MainActor.run {
            switch action {
            case ImportLocalNotifications.undoActionId:
                Task { await undoHandler?(recordId) }
            case ImportLocalNotifications.editActionId, UNNotificationDefaultActionIdentifier:
                onOpenReview?(recordId)
            default:
                break
            }
        }
    }
}
