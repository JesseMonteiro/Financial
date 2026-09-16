import Foundation
import Observation
import MeuFluxCore

@Observable
@MainActor
public final class MeuFluxAssistantViewModel {
    public static let suggestedPrompts = [
        "Qual meu saldo?",
        "Qual cartão tem mais gastos?",
        "Onde gastei mais este mês?",
    ]

    public private(set) var messages: [AssistantChatMessage]
    public var draft = ""
    public private(set) var isResponding = false
    public let availabilityCaption: String

    private let session: MeuFluxAssistantSession

    public init(session: MeuFluxAssistantSession = MeuFluxAssistantSession()) {
        self.session = session
        if AppleIntelligenceAvailability.isAvailable {
            self.availabilityCaption = "Respostas geradas no iPhone. Seus dados não saem do aparelho."
        } else {
            self.availabilityCaption = "Apple Intelligence indisponível. Uso o resumo financeiro salvo neste iPhone."
        }
        self.messages = []
    }

    public var showsSuggestions: Bool {
        messages.isEmpty && !isResponding
    }

    public func sendSuggested(_ text: String) async {
        draft = text
        await send()
    }

    public func send() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isResponding else { return }
        draft = ""
        messages.append(.user(text))
        isResponding = true
        defer { isResponding = false }
        let reply = await session.reply(to: text)
        messages.append(.assistant(reply))
    }
}
