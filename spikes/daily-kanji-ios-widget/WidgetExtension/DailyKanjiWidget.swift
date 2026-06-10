import SwiftUI
import WidgetKit

struct KanjiItem {
    let character: String
    let keyword: String
    let reading: String
    let source: String
}

struct KanjiEntry: TimelineEntry {
    let date: Date
    let item: KanjiItem
}

struct KanjiProvider: TimelineProvider {
    func placeholder(in context: Context) -> KanjiEntry {
        KanjiEntry(date: .now, item: Self.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (KanjiEntry) -> Void) {
        completion(KanjiEntry(date: .now, item: Self.sample))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KanjiEntry>) -> Void) {
        let entry = KanjiEntry(date: .now, item: Self.sample)
        let refresh = Calendar.current.date(byAdding: .hour, value: 6, to: .now) ?? .now
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }

    private static let sample = KanjiItem(
        character: "学",
        keyword: "study, learning",
        reading: "がく / まな.ぶ",
        source: "Spike"
    )
}

struct DailyKanjiWidgetView: View {
    let entry: KanjiEntry

    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .containerBackground(.background, for: .widget)
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryCircular:
            Text(entry.item.character)
                .font(.headline)
        case .accessoryInline:
            Text("\(entry.item.character) \(entry.item.keyword)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.item.character)
                    .font(.headline)
                Text(entry.item.keyword)
                    .font(.caption)
            }
        default:
            VStack(alignment: .leading, spacing: 8) {
                Text(entry.item.character)
                    .font(.system(size: 64, weight: .semibold, design: .serif))

                Text(entry.item.keyword)
                    .font(.headline)

                Text(entry.item.reading)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer(minLength: 0)

                Text(entry.item.source)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

struct DailyKanjiWidget: Widget {
    let kind = "DailyKanjiWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: KanjiProvider()) { entry in
            DailyKanjiWidgetView(entry: entry)
        }
        .configurationDisplayName("Daily Kanji")
        .description("Shows one study kanji.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryInline, .accessoryRectangular])
    }
}

@main
struct DailyKanjiWidgetBundle: WidgetBundle {
    var body: some Widget {
        DailyKanjiWidget()
    }
}
