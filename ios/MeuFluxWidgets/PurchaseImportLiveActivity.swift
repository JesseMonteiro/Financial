import ActivityKit
import WidgetKit
import SwiftUI

struct PurchaseImportAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var merchant: String
        var amount: String
        var category: String
        var status: Status
        
        enum Status: String, Codable, Hashable {
            case pending
            case saved  
            case dismissed
        }
    }
    
    var recordId: String
    var source: String
    var timestamp: Date
}

struct PurchaseImportLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PurchaseImportAttributes.self) { context in
            // Lock Screen banner
            PurchaseLockScreenBanner(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded regions
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "creditcard.fill")
                        .font(.title2)
                        .foregroundStyle(.blue)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.merchant)
                            .font(.headline)
                            .lineLimit(1)
                        Text(context.state.amount)
                            .font(.subheadline.weight(.bold).monospacedDigit())
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.category)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(.blue.opacity(0.15), in: Capsule())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 12) {
                        Link(destination: URL(string: "meuflux://import-save?id=\(context.attributes.recordId)")!) {
                            Label("Salvar", systemImage: "checkmark.circle.fill")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.green)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(.green.opacity(0.15), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        Link(destination: URL(string: "meuflux://import-dismiss?id=\(context.attributes.recordId)")!) {
                            Label("Descartar", systemImage: "xmark.circle")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(.gray.opacity(0.15), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "creditcard.fill")
                    .foregroundStyle(.blue)
            } compactTrailing: {
                Text(context.state.amount)
                    .font(.caption.weight(.bold).monospacedDigit())
                    .minimumScaleFactor(0.7)
            } minimal: {
                Image(systemName: "creditcard.fill")
                    .foregroundStyle(.blue)
            }
        }
    }
}

struct PurchaseLockScreenBanner: View {
    let context: ActivityViewContext<PurchaseImportAttributes>
    
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "creditcard.fill")
                    .font(.title2)
                    .foregroundStyle(.blue)
                    .frame(width: 44, height: 44)
                    .background(.blue.opacity(0.12), in: Circle())
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nova compra detectada")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(context.state.merchant)
                        .font(.headline)
                        .lineLimit(1)
                    Text(context.state.amount)
                        .font(.title3.weight(.bold).monospacedDigit())
                }
                
                Spacer(minLength: 8)
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text(context.state.category)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.blue.opacity(0.15), in: Capsule())
                    Text(context.attributes.source)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            
            HStack(spacing: 10) {
                Link(destination: URL(string: "meuflux://import-save?id=\(context.attributes.recordId)")!) {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Salvar")
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(.green, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                
                Link(destination: URL(string: "meuflux://import-dismiss?id=\(context.attributes.recordId)")!) {
                    HStack(spacing: 6) {
                        Image(systemName: "xmark.circle")
                        Text("Descartar")
                    }
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(.quaternary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
        }
        .padding(16)
    }
}
