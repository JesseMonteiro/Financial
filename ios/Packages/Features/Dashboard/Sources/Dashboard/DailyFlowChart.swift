import SwiftUI
import Charts
import MeuFluxDesignSystem
import MeuFluxDomain

struct DailyFlowChart: View {
    let points: [DailySpendPoint]
    let average: Decimal
    let selectedDay: InstantDate?
    var onSelect: (InstantDate) -> Void

    var body: some View {
        Chart {
            ForEach(points) { point in
                AreaMark(
                    x: .value("Dia", point.dateValue),
                    y: .value("Gasto", point.doubleAmount)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            MeuFluxColors.primary.opacity(0.28),
                            MeuFluxColors.primary.opacity(0.04)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                LineMark(
                    x: .value("Dia", point.dateValue),
                    y: .value("Gasto", point.doubleAmount)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(MeuFluxColors.primary)
                .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))

                PointMark(
                    x: .value("Dia", point.dateValue),
                    y: .value("Gasto", point.doubleAmount)
                )
                .symbolSize(point.day == selectedDay ? 84 : (point.isToday ? 64 : 40))
                .foregroundStyle(fillColor(for: point))
            }

            if let selectedDay, let selPoint = points.first(where: { $0.day == selectedDay }) {
                RuleMark(x: .value("Dia", selPoint.dateValue))
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                    .foregroundStyle(MeuFluxColors.primary.opacity(0.6))
            }

            RuleMark(y: .value("Média", NSDecimalNumber(decimal: average).doubleValue))
                .lineStyle(StrokeStyle(lineWidth: 1.2, dash: [3, 4]))
                .foregroundStyle(MeuFluxColors.primary.opacity(0.45))
                .annotation(position: .top, alignment: .leading) {
                    Text("MÉDIA \(Money(amount: average).formatted())")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(MeuFluxColors.primary)
                        .padding(.leading, 4)
                }
        }
        .chartXAxis {
            AxisMarks(values: axisDates) { value in
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        let day = InstantDate(from: date)
                        Text(axisLabel(day))
                            .font(.system(size: 11, weight: day.isToday ? .bold : .semibold))
                            .foregroundStyle(day.isToday ? MeuFluxColors.primary : MeuFluxColors.textMuted)
                    }
                }
            }
        }
        .chartYAxis(.hidden)
        .chartYScale(domain: 0...yMax)
        .chartLegend(.hidden)
        .chartXSelection(value: selectionBinding)
        .sensoryFeedback(.selection, trigger: selectedDay)
        .chartPlotStyle { plot in
            plot
                .padding(.horizontal, 14)
                .padding(.top, 22)
                .padding(.bottom, 4)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 196)
    }

    private var yMax: Double {
        let peak = points.map(\.doubleAmount).max() ?? 0
        let avg = NSDecimalNumber(decimal: average).doubleValue
        return max(peak, avg, 1) * 1.18
    }

    private var selectionBinding: Binding<Date?> {
        Binding(
            get: { selectedDay?.date() },
            set: { date in
                guard let date else { return }
                if let closest = points.min(by: { abs($0.dateValue.timeIntervalSince(date)) < abs($1.dateValue.timeIntervalSince(date)) }) {
                    onSelect(closest.day)
                } else {
                    onSelect(InstantDate(from: date))
                }
            }
        )
    }

    private var axisDates: [Date] {
        guard !points.isEmpty else { return [] }
        if points.count <= 4 {
            return points.map(\.dateValue)
        }
        return [
            points.first!.dateValue,
            points[points.count / 3].dateValue,
            points[(points.count * 2) / 3].dateValue,
            points.last!.dateValue
        ]
    }

    private func axisLabel(_ day: InstantDate) -> String {
        if day.isToday {
            return "Hoje"
        }
        return day.formatted(template: "d MMM")
    }

    private func fillColor(for point: DailySpendPoint) -> Color {
        if point.day == selectedDay { return MeuFluxColors.primary }
        if point.isToday { return MeuFluxColors.success }
        return Color.white
    }
}
