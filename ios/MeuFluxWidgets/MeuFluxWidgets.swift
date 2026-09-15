import WidgetKit
import SwiftUI

@main
struct MeuFluxWidgets: WidgetBundle {
    var body: some Widget {
        FinancialMomentWidget()
        NetWorthWidget()
        OpenBillsWidget()
    }
}

struct NetWorthEntry: TimelineEntry {
    let date: Date
    let netWorthLabel: String
}

struct NetWorthProvider: TimelineProvider {
    func placeholder(in context: Context) -> NetWorthEntry {
        NetWorthEntry(date: Date(), netWorthLabel: "R$ —")
    }

    func getSnapshot(in context: Context, completion: @escaping (NetWorthEntry) -> Void) {
        completion(NetWorthEntry(date: Date(), netWorthLabel: "R$ 0,00"))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NetWorthEntry>) -> Void) {
        let entry = NetWorthEntry(date: Date(), netWorthLabel: "R$ 0,00")
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600))))
    }
}

struct NetWorthWidget: Widget {
    let kind = "NetWorthWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NetWorthProvider()) { entry in
            VStack(alignment: .leading) {
                Text("Patrimônio")
                    .font(.caption)
                Text(entry.netWorthLabel)
                    .font(.title2.bold())
            }
            .padding()
            .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Patrimônio")
        .description("Resumo do patrimônio líquido.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct OpenBillsEntry: TimelineEntry {
    let date: Date
    let totalLabel: String
}

struct OpenBillsProvider: TimelineProvider {
    func placeholder(in context: Context) -> OpenBillsEntry {
        OpenBillsEntry(date: Date(), totalLabel: "R$ —")
    }

    func getSnapshot(in context: Context, completion: @escaping (OpenBillsEntry) -> Void) {
        completion(OpenBillsEntry(date: Date(), totalLabel: "R$ 0,00"))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OpenBillsEntry>) -> Void) {
        let entry = OpenBillsEntry(date: Date(), totalLabel: "R$ 0,00")
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600))))
    }
}

struct OpenBillsWidget: Widget {
    let kind = "OpenBillsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OpenBillsProvider()) { entry in
            VStack(alignment: .leading) {
                Text("Faturas abertas")
                    .font(.caption)
                Text(entry.totalLabel)
                    .font(.title2.bold())
            }
            .padding()
            .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Faturas")
        .description("Total de faturas de cartão em aberto.")
        .supportedFamilies([.systemSmall])
    }
}
