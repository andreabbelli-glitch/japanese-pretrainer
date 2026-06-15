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
        let dates = DailyKanjiSelector.widgetTimelineDates(startingAt: now)
        let cards = DailyKanjiSelector.widgetTimelineCards(
            cards: repository.loadCards(),
            dates: dates
        )
        let entries = dates.enumerated().map { index, date in
            let card = index < cards.count ? cards[index] : DailyKanjiSampleData.card
            return KanjiEntry(date: date, card: card)
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
        case .systemSmall:
            DailyKanjiHomeSmallWidgetView(card: entry.card)
        case .systemMedium:
            DailyKanjiHomeMediumWidgetView(card: entry.card)
        default:
            DailyKanjiHomeMediumWidgetView(card: entry.card)
        }
    }
}

private struct DailyKanjiHomeMediumWidgetView: View {
    let card: DailyKanjiCard

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text(card.displayFront)
                .font(.system(size: 66, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.28)
                .allowsTightening(true)
                .multilineTextAlignment(.center)
                .frame(width: 132, alignment: .center)
                .frame(maxHeight: .infinity, alignment: .center)
                .layoutPriority(3)

            VStack(alignment: .leading, spacing: 6) {
                Text(card.lockScreenTranslationText)
                    .font(.system(size: 21, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.65)
                    .layoutPriority(3)

                if let pattern = card.lockScreenPitchAccentPattern {
                    DailyKanjiPitchAccentReadingView(
                        pattern: pattern,
                        horizontalAlignment: .leading
                    )
                    .layoutPriority(2)
                } else {
                    Text(card.readingText)
                        .font(.system(size: 19, weight: .semibold, design: .rounded))
                        .foregroundStyle(.white.opacity(0.88))
                        .lineLimit(1)
                        .minimumScaleFactor(0.65)
                        .layoutPriority(2)
                }

                if let explanation = card.homeWidgetExplanationText {
                    Text(explanation)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.82))
                        .lineLimit(2)
                        .minimumScaleFactor(0.72)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }
}

private struct DailyKanjiHomeSmallWidgetView: View {
    let card: DailyKanjiCard

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(card.displayFront)
                .font(.system(size: 58, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.28)
                .allowsTightening(true)
                .layoutPriority(3)

            Text(card.lockScreenTranslationText)
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.65)

            Text(card.readingText)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundStyle(.white.opacity(0.82))
                .lineLimit(1)
                .minimumScaleFactor(0.65)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(12)
    }
}

private struct DailyKanjiLockScreenCardView: View {
    let card: DailyKanjiCard

    var body: some View {
        Text(card.lockScreenFrontText)
            .font(.system(size: 56, weight: .semibold))
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
                .foregroundStyle(.white)
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
    let horizontalAlignment: Alignment

    init(
        pattern: DailyKanjiPitchAccentPattern,
        horizontalAlignment: Alignment = .center
    ) {
        self.pattern = pattern
        self.horizontalAlignment = horizontalAlignment
    }

    var body: some View {
        VStack(spacing: 2) {
            ZStack(alignment: .topLeading) {
                ForEach(Array(pattern.upperRails.enumerated()), id: \.offset) { _, rail in
                    railView(rail)
                        .offset(x: railX(for: rail), y: upperRailY)
                }

                ForEach(Array(pattern.lowerRails.enumerated()), id: \.offset) { _, rail in
                    railView(rail)
                        .offset(x: railX(for: rail), y: lowerRailY)
                }

                ForEach(Array(pattern.connectors.enumerated()), id: \.offset) { _, connector in
                    connectorView(connector)
                        .offset(x: connectorX(for: connector), y: upperRailY)
                }
            }
            .frame(width: totalWidth, height: traceHeight, alignment: .topLeading)

            HStack(alignment: .bottom, spacing: 0) {
                ForEach(pattern.moras) { mora in
                    DailyKanjiMoraTextView(text: mora.text, fontSize: fontSize)
                        .frame(width: segmentWidth)
                }
            }
            .frame(width: totalWidth)
        }
        .frame(maxWidth: .infinity, alignment: horizontalAlignment)
    }

    @ViewBuilder
    private func railView(_ rail: DailyKanjiPitchAccentPattern.Rail) -> some View {
        if rail.length > 0 {
            Capsule()
                .fill(traceColor)
                .frame(width: railWidth(for: rail), height: traceSize)
        }
    }

    private func connectorView(_ connector: DailyKanjiPitchAccentPattern.Connector) -> some View {
        Rectangle()
            .fill(traceColor)
            .frame(width: traceSize, height: connectorHeight)
    }

    private var traceColor: Color {
        Color(red: 0.48, green: 0.75, blue: 0.18)
    }

    private var traceSize: CGFloat {
        2.4
    }

    private var traceHeight: CGFloat {
        max(fontSize * 0.44, 11)
    }

    private var connectorHeight: CGFloat {
        lowerRailY - upperRailY + traceSize
    }

    private var upperRailY: CGFloat {
        0
    }

    private var lowerRailY: CGFloat {
        traceHeight - traceSize
    }

    private var totalWidth: CGFloat {
        CGFloat(pattern.moras.count) * segmentWidth
    }

    private var railInset: CGFloat {
        traceSize / 2
    }

    private var railEndTrim: CGFloat {
        traceSize / 2
    }

    private var railTailTrim: CGFloat {
        max(segmentWidth * 0.1, 2.5)
    }

    private func railX(for rail: DailyKanjiPitchAccentPattern.Rail) -> CGFloat {
        CGFloat(rail.start) * segmentWidth + railInset
    }

    private func railWidth(for rail: DailyKanjiPitchAccentPattern.Rail) -> CGFloat {
        let trim = rail.tail ? railTailTrim : railEndTrim
        return max(CGFloat(rail.length) * segmentWidth - railInset - trim, traceSize)
    }

    private func connectorX(for connector: DailyKanjiPitchAccentPattern.Connector) -> CGFloat {
        CGFloat(connector.boundary) * segmentWidth - (traceSize / 2)
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
}

private struct DailyKanjiMoraTextView: View {
    let text: String
    let fontSize: CGFloat

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: characterSpacing) {
            ForEach(Array(characters.enumerated()), id: \.offset) { _, character in
                Text(character)
                    .font(
                        .system(
                            size: characterFontSize(for: character),
                            weight: .semibold,
                            design: .rounded
                        )
                    )
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
    }

    private var characters: [String] {
        text.map(String.init)
    }

    private var characterSpacing: CGFloat {
        text.count > 1 ? -max(fontSize * 0.18, 3) : 0
    }

    private func characterFontSize(for character: String) -> CGFloat {
        isContractedKana(character) ? fontSize * 0.86 : fontSize
    }

    private func isContractedKana(_ character: String) -> Bool {
        [
            "ゃ", "ゅ", "ょ", "ャ", "ュ", "ョ",
            "ぁ", "ぃ", "ぅ", "ぇ", "ぉ",
            "ァ", "ィ", "ゥ", "ェ", "ォ",
            "ゎ", "ヮ"
        ].contains(character)
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
