import SwiftUI
import WidgetKit

struct KanjiEntry: TimelineEntry {
    let date: Date
    let card: DailyKanjiCard
}

struct KanjiProvider: TimelineProvider {
    private let repository = DailyKanjiRepository()

    func placeholder(in context: Context) -> KanjiEntry {
        KanjiEntry(date: .now, card: DailyKanjiSampleData.card)
    }

    func getSnapshot(in context: Context, completion: @escaping (KanjiEntry) -> Void) {
        let card = selectedCard(now: .now)
        completion(KanjiEntry(date: .now, card: card))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<KanjiEntry>) -> Void) {
        let now = Date()
        let entries = DailyKanjiSelector.widgetTimelineDates(startingAt: now).map {
            KanjiEntry(date: $0, card: selectedCard(now: $0))
        }
        let refresh = entries.last.map {
            DailyKanjiSelector.nextWidgetRefreshDate(after: $0.date)
        } ?? DailyKanjiSelector.nextWidgetRefreshDate(after: now)

        completion(Timeline(entries: entries, policy: .after(refresh)))
    }

    private func selectedCard(now: Date) -> DailyKanjiCard {
        DailyKanjiSelector.select(
            cards: repository.loadCards(),
            history: [],
            now: now,
            mode: .widgetTimeline
        ) ?? DailyKanjiSampleData.card
    }
}

struct DailyKanjiWidgetView: View {
    let entry: KanjiEntry

    @Environment(\.widgetFamily) private var family

    var body: some View {
        content
            .containerBackground(.background, for: .widget)
            .widgetURL(DailyKanjiDeepLink.cardURL(cardId: entry.card.cardId))
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryCircular:
            Text(entry.card.kanjiText)
                .font(.headline)
        case .accessoryInline:
            Text("\(entry.card.displayFront) \(entry.card.back)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(entry.card.displayFront)
                        .font(.system(size: 25, weight: .semibold, design: .serif))
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)

                    Spacer(minLength: 2)

                    Text(entry.card.readingText)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }

                Text(entry.card.back)
                    .font(.caption.weight(.semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)

                HStack(spacing: 4) {
                    Text(entry.card.pitchAccentText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)

                    if let compactExplanation = entry.card.lockScreenExplanationText {
                        Text("-")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        Text(compactExplanation)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        default:
            VStack(alignment: .leading, spacing: 8) {
                Text(entry.card.displayFront)
                    .font(.system(size: 64, weight: .semibold, design: .serif))
                    .minimumScaleFactor(0.45)
                    .lineLimit(2)

                Text(entry.card.back)
                    .font(.headline)
                    .lineLimit(2)

                Text(entry.card.readingText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Text(entry.card.pitchAccentText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Spacer(minLength: 0)

                Text(entry.card.sourceText)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
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
