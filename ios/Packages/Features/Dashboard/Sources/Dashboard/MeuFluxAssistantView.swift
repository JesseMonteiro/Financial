import SwiftUI
import MeuFluxDesignSystem
import MeuFluxIntelligence

public struct MeuFluxAssistantView: View {
    @State private var model: MeuFluxAssistantViewModel
    @FocusState private var isComposerFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let typingID = "assistant-typing"

    public init(model: MeuFluxAssistantViewModel = MeuFluxAssistantViewModel()) {
        _model = State(wrappedValue: model)
    }

    public var body: some View {
        PageChrome {
            VStack(spacing: 0) {
                privacyBanner
                    .padding(.horizontal, PageLayout.gutter)
                    .padding(.top, PageLayout.contentTop)
                    .padding(.bottom, 8)

                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 14) {
                            if model.showsSuggestions {
                                welcomeHero
                                    .padding(.bottom, 4)
                            } else {
                                ForEach(model.messages) { message in
                                    bubble(message)
                                        .id(message.id)
                                        .transition(messageTransition)
                                }
                            }

                            if model.isResponding {
                                typingIndicator
                                    .id(typingID)
                                    .transition(messageTransition)
                            }

                            if model.showsSuggestions {
                                suggestions
                                    .padding(.top, 4)
                            }
                        }
                        .padding(.horizontal, PageLayout.gutter)
                        .padding(.bottom, 20)
                        .animation(reduceMotion ? nil : MotionTokens.spring, value: model.messages.count)
                        .animation(reduceMotion ? nil : MotionTokens.spring, value: model.isResponding)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: model.messages.count) { _, _ in
                        scrollToLatest(proxy: proxy)
                    }
                    .onChange(of: model.isResponding) { _, _ in
                        scrollToLatest(proxy: proxy)
                    }
                }

                composer
            }
        }
        .meuFluxPageTitle("Assistente")
    }

    // MARK: - Banner

    private var privacyBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "lock.shield.fill")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MeuFluxColors.primary)
                .padding(8)
                .background(MeuFluxColors.primary.opacity(0.12), in: Circle())

            Text(model.availabilityCaption)
                .font(.caption)
                .foregroundStyle(MeuFluxColors.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background {
            FrostedFill(cornerRadius: Radius().lg)
        }
        .overlay {
            RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                .strokeBorder(MeuFluxColors.border, lineWidth: 1)
        }
    }

    // MARK: - Welcome

    private var welcomeHero: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: MeuFluxColors.brandGradient.map { $0.opacity(0.22) },
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 64, height: 64)
                    .blur(radius: reduceMotion ? 0 : 12)

                Image(systemName: "sparkles")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: MeuFluxColors.brandGradient,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .padding(16)
                    .background {
                        FrostedFill(cornerRadius: 22)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .strokeBorder(MeuFluxColors.border, lineWidth: 1)
                    }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 6) {
                Text("Seu copiloto financeiro")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(MeuFluxColors.textPrimary)

                Text("Pergunte sobre saldo, cartões, categorias, faturas ou orçamento — tudo no aparelho.")
                    .font(.subheadline)
                    .foregroundStyle(MeuFluxColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.top, 8)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Suggestions

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Sugestões")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MeuFluxColors.textMuted)
                .textCase(.uppercase)
                .tracking(0.4)

            FlowSuggestions(prompts: MeuFluxAssistantViewModel.suggestedPrompts) { prompt in
                Task { await model.sendSuggested(prompt) }
            }
        }
    }

    // MARK: - Bubbles

    private func bubble(_ message: AssistantChatMessage) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            if message.role == .user {
                Spacer(minLength: 48)
            } else {
                assistantAvatar
            }

            Text(message.text)
                .font(.subheadline)
                .foregroundStyle(message.role == .user ? MeuFluxColors.textInverse : MeuFluxColors.textPrimary)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background {
                    if message.role == .user {
                        UnevenRoundedRectangle(
                            topLeadingRadius: Radius().xl,
                            bottomLeadingRadius: Radius().xl,
                            bottomTrailingRadius: Radius().sm,
                            topTrailingRadius: Radius().xl,
                            style: .continuous
                        )
                        .fill(
                            LinearGradient(
                                colors: MeuFluxColors.brandGradient,
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    } else {
                        UnevenRoundedRectangle(
                            topLeadingRadius: Radius().xl,
                            bottomLeadingRadius: Radius().sm,
                            bottomTrailingRadius: Radius().xl,
                            topTrailingRadius: Radius().xl,
                            style: .continuous
                        )
                        .fill(.ultraThinMaterial)
                        .overlay {
                            UnevenRoundedRectangle(
                                topLeadingRadius: Radius().xl,
                                bottomLeadingRadius: Radius().sm,
                                bottomTrailingRadius: Radius().xl,
                                topTrailingRadius: Radius().xl,
                                style: .continuous
                            )
                            .fill(MeuFluxColors.card)
                        }
                        .overlay {
                            UnevenRoundedRectangle(
                                topLeadingRadius: Radius().xl,
                                bottomLeadingRadius: Radius().sm,
                                bottomTrailingRadius: Radius().xl,
                                topTrailingRadius: Radius().xl,
                                style: .continuous
                            )
                            .strokeBorder(MeuFluxColors.border, lineWidth: 1)
                        }
                    }
                }
                .shadow(
                    color: message.role == .user
                        ? MeuFluxColors.primary.opacity(0.22)
                        : MeuFluxColors.cardShadowSecondary,
                    radius: message.role == .user ? 10 : 6,
                    y: 4
                )

            if message.role == .assistant {
                Spacer(minLength: 48)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message.role == .user ? "Você: \(message.text)" : "Assistente: \(message.text)")
    }

    private var assistantAvatar: some View {
        Image(systemName: "sparkles")
            .font(.caption2.weight(.bold))
            .foregroundStyle(MeuFluxColors.textInverse)
            .frame(width: 28, height: 28)
            .background(
                LinearGradient(
                    colors: MeuFluxColors.brandGradient,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: Circle()
            )
            .accessibilityHidden(true)
    }

    private var typingIndicator: some View {
        HStack(alignment: .bottom, spacing: 8) {
            assistantAvatar
            TypingDots()
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background {
                    UnevenRoundedRectangle(
                        topLeadingRadius: Radius().xl,
                        bottomLeadingRadius: Radius().sm,
                        bottomTrailingRadius: Radius().xl,
                        topTrailingRadius: Radius().xl,
                        style: .continuous
                    )
                    .fill(.ultraThinMaterial)
                    .overlay {
                        UnevenRoundedRectangle(
                            topLeadingRadius: Radius().xl,
                            bottomLeadingRadius: Radius().sm,
                            bottomTrailingRadius: Radius().xl,
                            topTrailingRadius: Radius().xl,
                            style: .continuous
                        )
                        .fill(MeuFluxColors.card)
                    }
                    .overlay {
                        UnevenRoundedRectangle(
                            topLeadingRadius: Radius().xl,
                            bottomLeadingRadius: Radius().sm,
                            bottomTrailingRadius: Radius().xl,
                            topTrailingRadius: Radius().xl,
                            style: .continuous
                        )
                        .strokeBorder(MeuFluxColors.border, lineWidth: 1)
                    }
                }
            Spacer(minLength: 48)
        }
        .accessibilityLabel("Assistente digitando")
    }

    // MARK: - Composer

    private var canSend: Bool {
        !model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !model.isResponding
    }

    private var composer: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [MeuFluxColors.bgPrimary.opacity(0), MeuFluxColors.bgPrimary.opacity(0.85)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 12)
            .allowsHitTesting(false)

            HStack(alignment: .bottom, spacing: 10) {
                TextField("Pergunte sobre suas finanças…", text: $model.draft, axis: .vertical)
                    .font(.subheadline)
                    .foregroundStyle(MeuFluxColors.textPrimary)
                    .lineLimit(1...5)
                    .focused($isComposerFocused)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background {
                        RoundedRectangle(cornerRadius: Radius().xl, style: .continuous)
                            .fill(.ultraThinMaterial)
                            .overlay {
                                RoundedRectangle(cornerRadius: Radius().xl, style: .continuous)
                                    .fill(MeuFluxColors.card)
                            }
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: Radius().xl, style: .continuous)
                            .strokeBorder(
                                isComposerFocused ? MeuFluxColors.primary.opacity(0.45) : MeuFluxColors.border,
                                lineWidth: 1
                            )
                    }
                    .onSubmit {
                        guard canSend else { return }
                        Task { await model.send() }
                    }

                Button {
                    Task { await model.send() }
                } label: {
                    Group {
                        if model.isResponding {
                            ProgressView()
                                .controlSize(.small)
                                .tint(MeuFluxColors.textInverse)
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.body.weight(.bold))
                                .foregroundStyle(MeuFluxColors.textInverse)
                        }
                    }
                    .frame(width: 44, height: 44)
                    .background {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: canSend || model.isResponding
                                        ? MeuFluxColors.brandGradient
                                        : [MeuFluxColors.textMuted.opacity(0.45), MeuFluxColors.textMuted.opacity(0.35)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    }
                    .shadow(
                        color: canSend ? MeuFluxColors.primary.opacity(0.35) : .clear,
                        radius: 10,
                        y: 4
                    )
                }
                .disabled(!canSend)
                .accessibilityLabel("Enviar mensagem")
            }
            .padding(.horizontal, PageLayout.gutter)
            .padding(.bottom, 12)
            .padding(.top, 4)
            .background(MeuFluxColors.bgPrimary.opacity(0.55))
        }
    }

    // MARK: - Helpers

    private var messageTransition: AnyTransition {
        if reduceMotion {
            return .opacity
        }
        return .asymmetric(
            insertion: .opacity.combined(with: .move(edge: .bottom)).combined(with: .scale(scale: 0.96)),
            removal: .opacity
        )
    }

    private func scrollToLatest(proxy: ScrollViewProxy) {
        let scroll = {
            if model.isResponding {
                proxy.scrollTo(typingID, anchor: .bottom)
            } else if let last = model.messages.last {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
        if reduceMotion {
            scroll()
        } else {
            withAnimation(MotionTokens.spring, scroll)
        }
    }
}

// MARK: - Typing dots

private struct TypingDots: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.periodic(from: .now, by: reduceMotion ? 3600 : 0.28)) { context in
            let phase = reduceMotion ? -1 : Int(context.date.timeIntervalSinceReferenceDate / 0.28) % 3
            HStack(spacing: 5) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(MeuFluxColors.textMuted)
                        .frame(width: 7, height: 7)
                        .scaleEffect(phase == index ? 1.25 : 0.85)
                        .opacity(phase == index ? 1 : 0.35)
                }
            }
        }
    }
}

// MARK: - Suggestion chips

private struct FlowSuggestions: View {
    let prompts: [String]
    var onSelect: (String) -> Void

    private let icons = ["banknote", "creditcard", "chart.pie"]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(prompts.enumerated()), id: \.element) { index, prompt in
                Button {
                    onSelect(prompt)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: icons[index % icons.count])
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.primary)
                            .frame(width: 28, height: 28)
                            .background(MeuFluxColors.primary.opacity(0.12), in: Circle())

                        Text(prompt)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(MeuFluxColors.textPrimary)
                            .multilineTextAlignment(.leading)

                        Spacer(minLength: 0)

                        Image(systemName: "arrow.up.right")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(MeuFluxColors.textMuted)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background {
                        FrostedFill(cornerRadius: Radius().lg)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: Radius().lg, style: .continuous)
                            .strokeBorder(MeuFluxColors.border, lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(prompt)
            }
        }
    }
}
