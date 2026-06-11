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
        Text(card.lockScreenFrontText)
            .font(.system(size: 56, weight: .semibold, design: .serif))
            .minimumScaleFactor(0.26)
            .lineLimit(1)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
}

private struct DailyKanjiLockScreenReadingView: View {
    let card: DailyKanjiCard

    var body: some View {
        VStack(alignment: .center, spacing: 5) {
            if let pattern = card.lockScreenPitchAccentPattern {
                DailyKanjiPitchAccentReadingView(pattern: pattern)
                    .layoutPriority(2)
            } else {
                Text(card.readingText)
                    .font(.system(size: 25, weight: .semibold, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.55)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .layoutPriority(2)
            }

            Text(card.lockScreenTranslationText)
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .minimumScaleFactor(0.65)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }
}

private struct DailyKanjiPitchAccentReadingView: View {
    let pattern: DailyKanjiPitchAccentPattern

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            ForEach(pattern.moras) { mora in
                VStack(spacing: 2) {
                    Capsule()
                        .fill(mora.isHigh ? Color(red: 0.22, green: 0.86, blue: 0.42) : Color.clear)
                        .frame(width: barWidth(for: mora), height: 2.5)

                    Text(mora.text)
                        .font(.system(size: fontSize, weight: .semibold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
                .frame(width: segmentWidth)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private var fontSize: CGFloat {
        switch pattern.moras.count {
        case 0...2:
            return 27
        case 3...4:
            return 23
        case 5...6:
            return 18.5
        case 7...8:
            return 15.5
        default:
            return 13
        }
    }

    private var segmentWidth: CGFloat {
        let width: CGFloat
        switch pattern.moras.count {
        case 0...2:
            width = 34
        case 3...4:
            width = 28
        case 5...6:
            width = 23
        case 7...8:
            width = 19
        default:
            width = 16
        }

        if pattern.moras.contains(where: { $0.text.count > 1 }) {
            return width + 6
        }

        return width
    }

    private func barWidth(for mora: DailyKanjiPitchAccentPattern.Mora) -> CGFloat {
        mora.text.count > 1 ? segmentWidth * 0.82 : segmentWidth * 0.65
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
        .description("Shows reading, pitch accent, and translation.")
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
