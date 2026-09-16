import WidgetKit
import SwiftUI
import MeuFluxCore

struct BudgetEntry: TimelineEntry {
    let date: Date
    let snapshot: BudgetWidgetSnapshot?
    let isAuthenticated: Bool
}

struct BudgetProvider: TimelineProvider {
    private let store = BudgetWidgetStore()

    func placeholder(in context: Context) -> BudgetEntry {
        BudgetEntry(date: Date(), snapshot: .placeholder, isAuthenticated: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (BudgetEntry) -> Void) {
        if context.isPreview {
            completion(BudgetEntry(date: Date(), snapshot: .preview, isAuthenticated: true))
            return
        }
        completion(makeEntry(fallbackToPreview: true))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BudgetEntry>) -> Void) {
        let next = Date().addingTimeInterval(30 * 60)
        completion(Timeline(entries: [makeEntry(fallbackToPreview: false)], policy: .after(next)))
    }

    private func makeEntry(fallbackToPreview: Bool) -> BudgetEntry {
        let snapshot = store.load() ?? (fallbackToPreview ? .preview : nil)
        return BudgetEntry(
            date: Date(),
            snapshot: snapshot,
            isAuthenticated: store.isAuthenticated() || snapshot != nil
        )
    }
}

struct BudgetWidget: Widget {
    let kind = WidgetKind.budget

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BudgetProvider()) { entry in
            BudgetWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetPalette.bgPrimary
                }
        }
        .configurationDisplayName("Orçamento")
        .description("Gasto, verba e categorias estouradas do mês.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
        .contentMarginsDisabled()
    }
}

struct BudgetWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BudgetEntry

    var body: some View {
        Group {
            if let snapshot = entry.snapshot {
                loaded(snapshot)
            } else if entry.isAuthenticated {
                WidgetStatusPanel(
                    systemImage: "chart.pie",
                    title: "Orçamento",
                    message: "Abra o app para atualizar o orçamento.",
                    accessibilityLabel: "Orçamento. Abra o app para atualizar."
                )
            } else {
                WidgetStatusPanel(
                    systemImage: "chart.pie",
                    title: "Orçamento",
                    message: "Abra o app e entre para ver o orçamento.",
                    accessibilityLabel: "Orçamento. Entre no app para ver o resumo."
                )
            }
        }
        .widgetURL(WidgetDeepLink.budget)
    }

    @ViewBuilder
    private func loaded(_ snapshot: BudgetWidgetSnapshot) -> some View {
        switch family {
        case .systemSmall:
            small(snapshot)
        case .accessoryRectangular:
            accessory(snapshot)
        default:
            medium(snapshot)
        }
    }

    private func small(_ snapshot: BudgetWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            WidgetMonthHeader(kicker: "ORÇAMENTO", title: snapshot.monthLabel)
            Spacer(minLength: 0)
            if snapshot.hasLimits {
                Text("\(snapshot.utilizationPercent)%")
                    .font(.title3.weight(.heavy).monospacedDigit())
                    .foregroundStyle(snapshot.isOverBudget ? WidgetPalette.danger : WidgetPalette.primary)
                WidgetUtilizationBar(percent: snapshot.utilizationPercent, over: snapshot.isOverBudget)
                HStack {
                    Text("Gasto")
                        .foregroundStyle(WidgetPalette.textSecondary)
                    Spacer()
                    Text(snapshot.spentLabel)
                        .fontWeight(.semibold)
                        .foregroundStyle(snapshot.isOverBudget ? WidgetPalette.danger : WidgetPalette.textPrimary)
                }
                .font(.caption2.monospacedDigit())
                HStack {
                    Text("Verba")
                        .foregroundStyle(WidgetPalette.textSecondary)
                    Spacer()
                    Text(snapshot.limitLabel)
                        .fontWeight(.semibold)
                        .foregroundStyle(WidgetPalette.textPrimary)
                }
                .font(.caption2.monospacedDigit())
            } else {
                Text("Sem metas")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(WidgetPalette.textPrimary)
                Text("Defina metas de orçamento no app.")
                    .font(.caption2)
                    .foregroundStyle(WidgetPalette.textSecondary)
            }
        }
        .padding(14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(smallAccessibility(snapshot))
    }

    private func medium(_ snapshot: BudgetWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                WidgetMonthHeader(kicker: "ORÇAMENTO", title: snapshot.monthLabel)
                Spacer()
                if snapshot.hasLimits {
                    Text("\(snapshot.utilizationPercent)%")
                        .font(.caption.weight(.bold).monospacedDigit())
                        .foregroundStyle(snapshot.isOverBudget ? WidgetPalette.danger : WidgetPalette.textSecondary)
                }
            }

            if snapshot.hasLimits {
                WidgetUtilizationBar(percent: snapshot.utilizationPercent, over: snapshot.isOverBudget)
            }

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 1), GridItem(.flexible(), spacing: 1)], spacing: 1) {
                WidgetKPICell(
                    title: "Gasto",
                    value: snapshot.spentLabel,
                    color: snapshot.isOverBudget ? WidgetPalette.danger : WidgetPalette.primary
                )
                WidgetKPICell(
                    title: "Verba",
                    value: snapshot.limitLabel,
                    color: WidgetPalette.primary
                )
                WidgetKPICell(
                    title: "Saldo",
                    value: snapshot.remainingLabel,
                    color: snapshot.isOverBudget ? WidgetPalette.danger : WidgetPalette.success,
                    subtitle: snapshot.remainingSubtitle
                )
                WidgetKPICell(
                    title: "Estouradas",
                    value: "\(snapshot.overBudgetCount)",
                    color: snapshot.overBudgetCount > 0 ? WidgetPalette.danger : WidgetPalette.success,
                    subtitle: snapshot.overBudgetSubtitle
                )
            }
            .background(WidgetPalette.border)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

            if let top = snapshot.topCategories.first {
                HStack {
                    Text(top.name)
                        .font(.system(size: 10))
                        .foregroundStyle(WidgetPalette.textSecondary)
                        .lineLimit(1)
                    Spacer()
                    Text("\(top.percent)%")
                        .font(.system(size: 10, weight: .bold).monospacedDigit())
                        .foregroundStyle(top.isOver ? WidgetPalette.danger : WidgetPalette.textPrimary)
                }
            }
        }
        .padding(14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Orçamento \(snapshot.monthLabel). Gasto \(snapshot.spentLabel). Verba \(snapshot.limitLabel). \(snapshot.overBudgetCount) categorias estouradas."
        )
    }

    private func accessory(_ snapshot: BudgetWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Orçamento · \(snapshot.monthLabel)")
                .font(.caption2.weight(.semibold))
            if snapshot.hasLimits {
                HStack(spacing: 8) {
                    Text("\(snapshot.utilizationPercent)%")
                        .font(.caption.weight(.bold).monospacedDigit())
                        .foregroundStyle(snapshot.isOverBudget ? WidgetPalette.danger : WidgetPalette.primary)
                    Text("\(snapshot.spentLabel) / \(snapshot.limitLabel)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(WidgetPalette.textSecondary)
                }
            } else {
                Text("Sem metas definidas")
                    .font(.caption2)
                    .foregroundStyle(WidgetPalette.textSecondary)
            }
        }
        .accessibilityLabel("Orçamento \(snapshot.utilizationPercent) por cento. Gasto \(snapshot.spentLabel) de \(snapshot.limitLabel).")
    }

    private func smallAccessibility(_ snapshot: BudgetWidgetSnapshot) -> String {
        if snapshot.hasLimits {
            return "Orçamento \(snapshot.monthLabel). \(snapshot.utilizationPercent) por cento. Gasto \(snapshot.spentLabel) de \(snapshot.limitLabel)."
        }
        return "Orçamento \(snapshot.monthLabel). Sem metas definidas."
    }
}
