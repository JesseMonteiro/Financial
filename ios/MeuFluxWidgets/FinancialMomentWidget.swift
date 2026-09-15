import WidgetKit
import SwiftUI
import UIKit
import MeuFluxCore

struct FinancialMomentEntry: TimelineEntry {
    let date: Date
    let snapshot: FinancialMomentWidgetSnapshot?
    let isAuthenticated: Bool
}

struct FinancialMomentProvider: TimelineProvider {
    private let store = FinancialMomentWidgetStore()

    func placeholder(in context: Context) -> FinancialMomentEntry {
        FinancialMomentEntry(date: Date(), snapshot: .placeholder, isAuthenticated: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (FinancialMomentEntry) -> Void) {
        if context.isPreview {
            completion(FinancialMomentEntry(date: Date(), snapshot: .preview, isAuthenticated: true))
            return
        }
        completion(makeEntry(fallbackToPreview: true))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FinancialMomentEntry>) -> Void) {
        let next = Date().addingTimeInterval(30 * 60)
        completion(Timeline(entries: [makeEntry(fallbackToPreview: false)], policy: .after(next)))
    }

    private func makeEntry(fallbackToPreview: Bool) -> FinancialMomentEntry {
        let snapshot = store.load() ?? (fallbackToPreview ? .preview : nil)
        return FinancialMomentEntry(
            date: Date(),
            snapshot: snapshot,
            isAuthenticated: store.isAuthenticated() || snapshot != nil
        )
    }
}

struct FinancialMomentWidget: Widget {
    let kind = WidgetKind.financialMoment

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FinancialMomentProvider()) { entry in
            FinancialMomentWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetPalette.bgPrimary
                }
        }
        .configurationDisplayName("Momento Financeiro")
        .description("Entradas, saídas, contas a pagar e saldo do mês da conta logada.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
        .contentMarginsDisabled()
    }
}

private enum WidgetPalette {
    static let textPrimary = Color(light: 0x0F172A, dark: 0xF8FAFC)
    static let textSecondary = Color(light: 0x475569, dark: 0x94A3B8)
    static let textMuted = Color(light: 0x94A3B8, dark: 0x64748B)
    static let success = Color(red: 0.063, green: 0.725, blue: 0.506)
    static let danger = Color(red: 0.957, green: 0.247, blue: 0.369)
    static let warning = Color(red: 0.961, green: 0.620, blue: 0.043)
    static let primary = Color(red: 0.388, green: 0.400, blue: 0.945)
    static let border = Color(light: 0x000000, dark: 0xFFFFFF, lightOpacity: 0.08, darkOpacity: 0.10)
    static let card = Color(light: 0xFFFFFF, dark: 0x111827, lightOpacity: 0.92, darkOpacity: 0.92)
    static let bgPrimary = Color(light: 0xF8FAFC, dark: 0x090D16)
}

private extension Color {
    init(light: UInt32, dark: UInt32, lightOpacity: Double = 1, darkOpacity: Double = 1) {
        self.init(uiColor: UIColor { traits in
            let isDark = traits.userInterfaceStyle == .dark
            let hex = isDark ? dark : light
            let alpha = isDark ? darkOpacity : lightOpacity
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: alpha
            )
        })
    }
}

struct FinancialMomentWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FinancialMomentEntry

    var body: some View {
        Group {
            if let snapshot = entry.snapshot {
                loaded(snapshot)
            } else if entry.isAuthenticated {
                waitingForData
            } else {
                signedOut
            }
        }
        .widgetURL(WidgetDeepLink.financialMoment)
    }

    @ViewBuilder
    private func loaded(_ snapshot: FinancialMomentWidgetSnapshot) -> some View {
        switch family {
        case .systemSmall:
            small(snapshot)
        case .accessoryRectangular:
            accessory(snapshot)
        default:
            medium(snapshot)
        }
    }

    private func small(_ snapshot: FinancialMomentWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            header(snapshot.monthLabel)
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
            "Momento financeiro \(snapshot.monthLabel). Saldo \(snapshot.netLabel). A pagar \(snapshot.payableLabel)."
        )
    }

    private func medium(_ snapshot: FinancialMomentWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                header(snapshot.monthLabel)
                Spacer()
                Text("\(snapshot.utilizationPercent)%")
                    .font(.caption.weight(.bold).monospacedDigit())
                    .foregroundStyle(snapshot.isOverBudget ? WidgetPalette.danger : WidgetPalette.textSecondary)
            }

            utilizationBar(percent: snapshot.utilizationPercent, over: snapshot.isOverBudget)

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 1), GridItem(.flexible(), spacing: 1)], spacing: 1) {
                kpi("Entradas", snapshot.incomeLabel, WidgetPalette.success)
                kpi("Saídas", snapshot.expenseLabel, WidgetPalette.danger)
                kpi("A pagar", snapshot.payableLabel, snapshot.payableIsClear ? WidgetPalette.success : WidgetPalette.warning, snapshot.payableSubtitle)
                kpi("Saldo", snapshot.netLabel, snapshot.isNetPositive ? WidgetPalette.success : WidgetPalette.danger, snapshot.netSubtitle)
            }
            .background(WidgetPalette.border)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .padding(14)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Momento financeiro \(snapshot.monthLabel). Entradas \(snapshot.incomeLabel). Saídas \(snapshot.expenseLabel). A pagar \(snapshot.payableLabel). Saldo \(snapshot.netLabel)."
        )
    }

    private func accessory(_ snapshot: FinancialMomentWidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Momento · \(snapshot.monthLabel)")
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
        .accessibilityLabel("Saldo \(snapshot.netLabel), a pagar \(snapshot.payableLabel)")
    }

    private var waitingForData: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "waveform.path.ecg")
                .font(.title3)
                .foregroundStyle(WidgetPalette.primary)
            Text("Momento Financeiro")
                .font(.caption.weight(.bold))
                .foregroundStyle(WidgetPalette.textPrimary)
            Text("Abra o app para atualizar o resumo desta conta.")
                .font(.caption2)
                .foregroundStyle(WidgetPalette.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityLabel("Momento financeiro. Abra o app para atualizar.")
    }

    private var signedOut: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "waveform.path.ecg")
                .font(.title3)
                .foregroundStyle(WidgetPalette.primary)
            Text("Momento Financeiro")
                .font(.caption.weight(.bold))
                .foregroundStyle(WidgetPalette.textPrimary)
            Text("Abra o app e entre para ver o resumo da conta.")
                .font(.caption2)
                .foregroundStyle(WidgetPalette.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityLabel("Momento financeiro. Entre no app para ver o resumo.")
    }

    private func header(_ monthLabel: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("MOMENTO")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(WidgetPalette.textMuted)
                .tracking(0.5)
            Text(monthLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(WidgetPalette.textPrimary)
                .lineLimit(1)
        }
    }

    private func kpi(_ title: String, _ value: String, _ color: Color, _ subtitle: String? = nil) -> some View {
        HStack(spacing: 0) {
            Rectangle()
                .fill(color)
                .frame(width: 3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(WidgetPalette.textMuted)
                    .tracking(0.3)
                Text(value)
                    .font(.caption.weight(.heavy).monospacedDigit())
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 9))
                        .foregroundStyle(WidgetPalette.textSecondary)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(WidgetPalette.card)
    }

    private func utilizationBar(percent: Int, over: Bool) -> some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(WidgetPalette.border)
                Capsule()
                    .fill(over ? WidgetPalette.danger : WidgetPalette.primary)
                    .frame(width: max(0, geometry.size.width * CGFloat(min(100, max(0, percent))) / 100))
            }
        }
        .frame(height: 6)
        .accessibilityHidden(true)
    }
}

