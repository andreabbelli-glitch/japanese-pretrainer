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

enum DailyKanjiLockScreenWidgetRole {
    case card
    case reading
}

struct DailyKanjiWidgetView: View {
    let entry: KanjiEntry
    let lockScreenRole: DailyKanjiLockScreenWidgetRole

    @Environment(\.widgetFamily) private var family

    init(
        entry: KanjiEntry,
        lockScreenRole: DailyKanjiLockScreenWidgetRole = .card
    ) {
        self.entry = entry
        self.lockScreenRole = lockScreenRole
    }

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
            switch lockScreenRole {
            case .card:
                DailyKanjiLockScreenCardView(card: entry.card)
            case .reading:
                DailyKanjiLockScreenReadingView(card: entry.card)
            }
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

                if let explanation = entry.card.homeWidgetExplanationText {
                    Text(explanation)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                }

                Spacer(minLength: 0)

                Text(entry.card.sourceText)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(10)
        }
    }
}

private struct DailyKanjiLockScreenCardView: View {
    let card: DailyKanjiCard

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(card.displayFront)
                .font(.system(size: 38, weight: .semibold, design: .serif))
                .minimumScaleFactor(0.32)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(2)

            Text(card.back)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .lineLimit(1)
                .minimumScaleFactor(0.55)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct DailyKanjiLockScreenReadingView: View {
    let card: DailyKanjiCard

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .bottom, spacing: 4) {
                if let pattern = card.lockScreenPitchAccentPattern {
                    DailyKanjiPitchAccentReadingView(pattern: pattern)
                        .layoutPriority(2)
                } else {
                    Text(card.readingText)
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                        .layoutPriority(2)
                }

                Spacer(minLength: 0)

                if let pitchAccent = card.lockScreenPitchAccentText {
                    Text(pitchAccent)
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundStyle(.secondary)
                        .padding(.bottom, 1)
                }
            }

            Text(card.lockScreenExplanationText ?? card.back)
                .font(.system(size: 8.5, weight: .regular, design: .rounded))
                .foregroundStyle(.secondary)
                .lineLimit(3)
                .minimumScaleFactor(0.55)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private struct DailyKanjiPitchAccentReadingView: View {
    let pattern: DailyKanjiPitchAccentPattern

    var body: some View {
        HStack(alignment: .bottom, spacing: 1) {
            ForEach(pattern.moras) { mora in
                VStack(spacing: 1) {
                    Capsule()
                        .fill(mora.isHigh ? Color(red: 0.22, green: 0.86, blue: 0.42) : Color.clear)
                        .frame(height: 2)
                        .padding(.horizontal, 1)

                    Text(mora.text)
                        .font(.system(size: fontSize, weight: .semibold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var fontSize: CGFloat {
        switch pattern.moras.count {
        case 0...5:
            return 15
        case 6...7:
            return 13
        case 8...9:
            return 11.5
        default:
            return 10
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
        .supportedFamilies(DailyKanjiWidgetFamilies.supported)
        .contentMarginsDisabled()
    }
}

struct DailyKanjiReadingWidget: Widget {
    let kind = "DailyKanjiReadingWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: KanjiProvider()) { entry in
            DailyKanjiWidgetView(entry: entry, lockScreenRole: .reading)
        }
        .configurationDisplayName("Daily Kanji Reading")
        .description("Shows reading, pitch accent, and note.")
        .supportedFamilies(DailyKanjiWidgetFamilies.readingSupported)
        .contentMarginsDisabled()
    }
}

@main
struct DailyKanjiWidgetBundle: WidgetBundle {
    var body: some Widget {
        DailyKanjiWidget()
        DailyKanjiReadingWidget()
    }
}
