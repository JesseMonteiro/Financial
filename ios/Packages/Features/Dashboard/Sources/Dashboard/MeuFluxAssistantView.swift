import SwiftUI
import MeuFluxDesignSystem
import MeuFluxIntelligence

public struct MeuFluxAssistantView: View {
    @State private var model: MeuFluxAssistantViewModel

    public init(model: MeuFluxAssistantViewModel = MeuFluxAssistantViewModel()) {
        _model = State(wrappedValue: model)
    }

    public var body: some View {
        VStack(spacing: 0) {
            Text(model.availabilityCaption)
                .font(.caption)
                .foregroundStyle(MeuFluxColors.textMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 8)

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        ForEach(model.messages) { message in
                            bubble(message)
                                .id(message.id)
                        }
                        if model.showsSuggestions {
                            suggestions
                        }
                    }
                    .padding(16)
                }
                .onChange(of: model.messages.count) { _, _ in
                    if let last = model.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("Pergunte sobre suas finanças", text: $model.draft, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                Button {
                    Task { await model.send() }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isResponding)
            }
            .padding(16)
        }
        .meuFluxPageTitle("Assistente")
    }

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(MeuFluxAssistantViewModel.suggestedPrompts, id: \.self) { prompt in
                Button {
                    Task { await model.sendSuggested(prompt) }
                } label: {
                    Text(prompt)
                        .font(.subheadline)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(MeuFluxColors.bgTertiary)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .foregroundStyle(MeuFluxColors.textPrimary)
            }
        }
        .padding(.top, 4)
    }

    private func bubble(_ message: AssistantChatMessage) -> some View {
        HStack {
            if message.role == .user { Spacer(minLength: 40) }
            Text(message.text)
                .font(.subheadline)
                .foregroundStyle(message.role == .user ? Color.white : MeuFluxColors.textPrimary)
                .padding(12)
                .background(
                    message.role == .user ? MeuFluxColors.primary : MeuFluxColors.bgTertiary
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            if message.role == .assistant { Spacer(minLength: 40) }
        }
    }
}
