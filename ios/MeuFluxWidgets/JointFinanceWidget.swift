import WidgetKit
import SwiftUI
import MeuFluxCore

struct JointFinanceEntry: TimelineEntry {
    let date: Date
    let snapshot: JointFinanceWidgetSnapshot?
    let isAuthenticated: Bool
}

struct JointFinanceProvider: TimelineProvider {
    private let store = JointFinanceWidgetStore()

    func placeholder(in context: Context) -> JointFinanceEntry {
        JointFinanceEntry(date: Date(), snapshot: .placeholder, isAuthenticated: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (JointFinanceEntry) -> Void) {
        if context.isPreview {
            completion(JointFinanceEntry(date: Date(), snapshot: .preview, isAuthenticated: true))
            return
        }
        completion(makeEntry(fallbackToPreview: true))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<JointFinanceEntry>) -> Void) {
        let next = Date().addingTimeInterval(30 * 60)
        completion(Timeline(entries: [makeEntry(fallbackToPreview: false)], policy: .after(next)))
    }

    private func makeEntry(fallbackToPreview: Bool) -> JointFinanceEntry {
        let snapshot = store.load() ?? (fallbackToPreview ? .preview : nil)
        return JointFinanceEntry(
            date: Date(),
            snapshot: snapshot,
            isAuthenticated: store.isAuthenticated() || snapshot != nil
        )
    }
}

struct JointFinanceWidget: Widget {
    let kind = WidgetKind.jointFinance

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: JointFinanceProvider()) { entry in
            JointFinanceWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetPalette.bgPrimary
                }
        }
        .configurationDisplayName("Conta conjunta")
        .description("Momento financeiro consolidado da conta conjunta.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
        .contentMarginsDisabled()
    }
}

struct JointFinanceWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: JointFinanceEntry

    var body: some View {
        Group {
            if let snapshot = entry.snapshot {
                if snapshot.hasActiveLink {
                    loaded(snapshot)
                } else {
                    WidgetStatusPanel(
                        systemImage: "person.2",
                        title: "Conta conjunta",
                        message: "Vincule uma conta conjunta nas Configurações.",
                        accessibilityLabel: "Conta conjunta inativa. Vincule no app."
                    )
                }
            } else if entry.isAuthenticated {
                WidgetStatusPanel(
                    systemImage: "person.2",
                    title: "Conta conjunta",
                    message: "Abra o app para atualizar o resumo conjunto.",
                    accessibilityLabel: "Conta conjunta. Abra o app para atualizar."
                )
            } else {
                WidgetStatusPanel(
                    systemImage: "person.2",
                    title: "Conta conjunta",
                    message: "Abra o app e entre para ver a conta conjunta.",
                    accessibilityLabel: "Conta conjunta. Entre no app para ver o resumo."
                )
            }
        }
        .widgetURL(WidgetDeepLink.jointFinance)
    }

    @ViewBuilder
    private func loaded(_ snapshot: JointFinanceWidgetSnapshot) -> some View {
        switch family {
        case .systemSmall:
            small(snapshot)
        case .accessoryRectangular:
            accessory(snapshot)
        default:
            medium(snapshot)
        }
    }

    private func small(_ snapshot: JointFinanceWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            WidgetMonthHeader(kicker: "CONJUNTA", title: snapshot.monthLabel)
            if !snapshot.membersLabel.isEmpty {
                Text(snapshot.membersLabel)
                    .font(.system(size: 10))
                    .foregroundStyle(WidgetPalette.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Text("SALDO")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(WidgetPalette.textMuted)
                .tracking(0.4)
            Text(snapshot.netLabel)
                .font(.title3.weight(.heavy).monospacedDigit())
                .foregroundStyle(snapshot.isNetPositive ? WidgetPalette.success : WidgetPalette.danger)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            HStack {
                Text("A pagar")
                    .foregroundStyle(WidgetPalette.textSecondary)
                Spacer()
                Text(snapshot.payableLabel)
                    .fontWeight(.semibold)
                    .foregroundStyle(snapshot.payableIsClear ? WidgetPalette.success : WidgetPalette.warning)
            }
            .font(.caption2.monospacedDigit())
        }
        .padding(14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Conta conjunta \(snapshot.monthLabel). Saldo \(snapshot.netLabel). A pagar \(snapshot.payableLabel)."
        )
    }

    private func medium(_ snapshot: JointFinanceWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    WidgetMonthHeader(kicker: "CONJUNTA", title: snapshot.monthLabel)
                    if !snapshot.membersLabel.isEmpty {
                        Text(snapshot.membersLabel)
                            .font(.system(size: 10))
                            .foregroundStyle(WidgetPalette.textSecondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                Text("\(snapshot.utilizationPercent)%")
                    .font(.caption.weight(.bold).monospacedDigit())
                    .foregroundStyle(snapshot.isOverBudget ? WidgetPalette.danger : WidgetPalette.textSecondary)
            }

            WidgetUtilizationBar(percent: snapshot.utilizationPercent, over: snapshot.isOverBudget)

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 1), GridItem(.flexible(), spacing: 1)], spacing: 1) {
                WidgetKPICell(title: "Entradas", value: snapshot.incomeLabel, color: WidgetPalette.success)
                WidgetKPICell(title: "Saídas", value: snapshot.expenseLabel, color: WidgetPalette.danger)
                WidgetKPICell(
                    title: "A pagar",
                    value: snapshot.payableLabel,
                    color: snapshot.payableIsClear ? WidgetPalette.success : WidgetPalette.warning,
                    subtitle: snapshot.payableSubtitle
                )
                WidgetKPICell(
                    title: "Saldo",
                    value: snapshot.netLabel,
                    color: snapshot.isNetPositive ? WidgetPalette.success : WidgetPalette.danger,
                    subtitle: snapshot.netSubtitle
                )
            }
            .background(WidgetPalette.border)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .padding(14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Conta conjunta \(snapshot.monthLabel). Entradas \(snapshot.incomeLabel). Saídas \(snapshot.expenseLabel). A pagar \(snapshot.payableLabel). Saldo \(snapshot.netLabel)."
        )
    }

    private func accessory(_ snapshot: JointFinanceWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Conjunta · \(snapshot.monthLabel)")
                .font(.caption2.weight(.semibold))
            HStack(spacing: 8) {
                Text(snapshot.netLabel)
                    .font(.caption.weight(.bold).monospacedDigit())
                    .foregroundStyle(snapshot.isNetPositive ? WidgetPalette.success : WidgetPalette.danger)
                Text("A pagar \(snapshot.payableLabel)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(WidgetPalette.textSecondary)
            }
        }
        .accessibilityLabel("Saldo conjunto \(snapshot.netLabel), a pagar \(snapshot.payableLabel)")
    }
}
