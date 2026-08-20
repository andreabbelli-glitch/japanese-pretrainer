import SwiftUI

enum DailyKanjiWidgetCardStudyLayout {
    case horizontal
    case vertical
}

struct DailyKanjiWidgetCardView: View {
    let card: DailyKanjiCard
    let historyContext: DailyKanjiPresentationHistoryItem?
    @ObservedObject var audioPlayer: DailyKanjiAudioPlayer
    @ScaledMetric(relativeTo: .largeTitle)
    private var frontSize = DailyKanjiWidgetCardStudyPresentation.frontBaseSize

    var body: some View {
        DailyKanjiCardSurface {
            VStack(alignment: .leading, spacing: 20) {
                studyContent
                example
                rationale
            }
        }
    }

    private var studyContent: some View {
        let presentation = DailyKanjiWidgetCardStudyPresentation(
            front: card.displayFront,
            reading: card.readingText,
            meaning: card.back
        )

        return ViewThatFits(in: .horizontal) {
            studyContentLayout(presentation, layout: .horizontal)
            studyContentLayout(presentation, layout: .vertical)
        }
    }

    @ViewBuilder
    private func studyContentLayout(
        _ presentation: DailyKanjiWidgetCardStudyPresentation,
        layout: DailyKanjiWidgetCardStudyLayout
    ) -> some View {
        if layout == .horizontal {
            HStack(alignment: .center, spacing: 10) {
                studyTextGroup(presentation, layout: layout)
                Spacer(minLength: 8)
                audioButton
            }
        } else {
            VStack(alignment: .leading, spacing: 10) {
                studyTextGroup(presentation, layout: layout)
                audioButton
            }
        }
    }

    private func studyTextGroup(
        _ presentation: DailyKanjiWidgetCardStudyPresentation,
        layout: DailyKanjiWidgetCardStudyLayout
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(presentation.front)
                .font(.system(size: frontSize, weight: .semibold))
                .lineLimit(2)
                .minimumScaleFactor(0.6)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(presentation.reading)
                .font(.title3.weight(.medium))
                .foregroundStyle(.secondary)
            Text(card.pitchAccentText)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(presentation.meaning)
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(presentation.accessibilityLabel)
        .frame(
            maxWidth: presentation.studyTextUsesAvailableWidth(for: layout) ? .infinity : nil,
            alignment: .leading
        )
    }

    private var audioButton: some View {
        Button(action: playAudio) {
            Label("Riproduci pronuncia", systemImage: "speaker.wave.2.fill")
                .labelStyle(.iconOnly)
                .frame(width: 44, height: 44)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.circle)
        .disabled(!audioPlayer.hasBundledAudio(card: card))
        .accessibilityLabel("Riproduci la pronuncia di \(card.readingText)")
        .accessibilityHint(
            audioPlayer.hasBundledAudio(card: card)
                ? "Riproduce l'audio incluso"
                : "Audio non disponibile"
        )
    }

    @ViewBuilder
    private var example: some View {
        if let exampleJp = nonEmpty(card.exampleJp) ?? nonEmpty(card.exampleIt) {
            VStack(alignment: .leading, spacing: 6) {
                Text(exampleJp)
                    .font(.body)
                    .fixedSize(horizontal: false, vertical: true)

                if let exampleIt = nonEmpty(card.exampleJp).flatMap({ _ in nonEmpty(card.exampleIt) }) {
                    Text(exampleIt)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.leading, 12)
            .overlay(alignment: .leading) {
                Capsule()
                    .fill(Color.accentColor)
                    .frame(width: 3)
            }
        }
    }

    private var rationale: some View {
        DisclosureGroup("Perché questa scheda") {
            VStack(alignment: .leading, spacing: 14) {
                DailyKanjiWidgetMetricRow(
                    title: "Priorità",
                    value: priorityText
                )
                DailyKanjiWidgetMetricRow(
                    title: "Difficoltà",
                    value: card.srs.difficultyText
                )
                DailyKanjiWidgetMetricRow(
                    title: "Stabilità",
                    value: card.srs.stabilityText
                )
                DailyKanjiWidgetMetricRow(
                    title: "Hard / again",
                    value: "\(card.srs.recentHardAgainCount)"
                )
                DailyKanjiWidgetMetricRow(
                    title: "Errori",
                    value: "\(card.srs.lapses)"
                )

                if let notes = nonEmpty(card.notes) {
                    DailyKanjiWidgetMetricRow(title: "Note", value: notes)
                }

                DailyKanjiWidgetMetricRow(title: "Fonte", value: card.sourceText)

                if let historyContext {
                    DailyKanjiWidgetMetricRow(
                        title: "Cronologia",
                        value: historyContext.metadataText()
                    )
                }
            }
            .padding(.top, 8)
        }
        .font(.callout)
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else {
            return nil
        }
        return value
    }

    private func playAudio() {
        audioPlayer.play(card: card)
    }

    private var priorityText: String {
        if card.studyModes?.prestudy != nil, card.studyModes?.daily != true {
            return "Prestudio"
        }

        if card.studyModes?.lastLessonsHardAgain != nil, card.studyModes?.daily != true {
            return "Ultime 3"
        }

        if card.srs.priorityReasons.contains(.recentHardAgain) {
            return "Difficoltà recente"
        }

        switch card.srs.state {
        case .relearning:
            return "Da consolidare"
        case .learning:
            return "In apprendimento"
        case .review:
            break
        }

        if card.srs.priorityReasons.contains(.lowStability) {
            return "Stabilità bassa"
        }

        if card.srs.priorityReasons.contains(.highDifficulty) {
            return "Difficoltà alta"
        }

        return "Ripasso"
    }
}

struct DailyKanjiWidgetCardStudyPresentation: Equatable {
    static let frontBaseSize: CGFloat = 64

    let front: String
    let reading: String
    let meaning: String

    var accessibilityLabel: String {
        "\(front), lettura \(reading), significato \(meaning)"
    }

    func studyTextUsesAvailableWidth(for layout: DailyKanjiWidgetCardStudyLayout) -> Bool {
        layout == .vertical
    }
}

private struct DailyKanjiWidgetMetricRow: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
