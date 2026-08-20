import SwiftUI

struct DailyKanjiReviewCardView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ObservedObject var model: DailyKanjiAppModel
    let card: DailyKanjiLiveReviewCard
    @Binding var answerRevealed: Bool
    @ObservedObject var audioPlayer: DailyKanjiAudioPlayer
    let liveReviewBaseURL: URL?

    private var presentation: DailyKanjiLiveReviewCardPresentation {
        DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: answerRevealed
        )
    }

    private var gradeIntervalPresentation: DailyKanjiReviewGradeIntervalPresentation {
        DailyKanjiReviewGradeIntervalPresentation(dynamicTypeSize: dynamicTypeSize)
    }

    private var headerPresentation: DailyKanjiReviewHeaderPresentation {
        DailyKanjiReviewHeaderPresentation(dynamicTypeSize: dynamicTypeSize)
    }

    var body: some View {
        DailyKanjiCardSurface {
            VStack(alignment: .leading, spacing: 20) {
                header
                studyContent

                if presentation.shouldShowAnswer {
                    revealedAnswerSections
                } else {
                    revealButton
                }
            }
        }
    }

    @ViewBuilder
    private var header: some View {
        switch headerPresentation.layout {
        case .compact:
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                mediaTitle(fullWidth: false)
                Spacer(minLength: 0)
                queueLabel(fullWidth: false)
                    .fixedSize(horizontal: true, vertical: false)
            }
        case .stacked:
            VStack(alignment: .leading, spacing: 4) {
                mediaTitle(fullWidth: true)
                queueLabel(fullWidth: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func mediaTitle(fullWidth: Bool) -> some View {
        Text(card.mediaTitle)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .lineLimit(headerPresentation.textLineLimit)
            .fixedSize(
                horizontal: false,
                vertical: headerPresentation.allowsVerticalExpansion
            )
            .frame(maxWidth: fullWidth ? .infinity : nil, alignment: .leading)
    }

    private func queueLabel(fullWidth: Bool) -> some View {
        Text(queueText)
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
            .lineLimit(headerPresentation.textLineLimit)
            .fixedSize(
                horizontal: false,
                vertical: headerPresentation.allowsVerticalExpansion
            )
            .frame(maxWidth: fullWidth ? .infinity : nil, alignment: .leading)
    }

    private var studyContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            DailyKanjiReviewFrontText(
                presentation: presentation
            )

            if presentation.shouldShowAnswer {
                if let readingText = presentation.readingText {
                    Text(readingText)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                Text(presentation.backText)
                    .font(.title3.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(presentation.studyAccessibilityLabel)
    }

    private var revealButton: some View {
        Button(action: revealAnswer) {
            Label("Mostra risposta", systemImage: "eye.fill")
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .disabled(!canReveal)
    }

    private var revealedAnswerSections: some View {
        ForEach(presentation.answerSections, id: \.self) { section in
            answerSection(section)
        }
    }

    @ViewBuilder
    private func answerSection(_ section: DailyKanjiReviewAnswerSection) -> some View {
        switch section {
        case .pronunciation:
            pronunciation
        case .ratings:
            gradeControls
        case .supplementalDetails:
            details
        }
    }

    private var pronunciation: some View {
        VStack(alignment: .leading, spacing: 16) {
            supplementalAnswerControls

            if let pitchAccent = presentation.pitchAccent {
                DailyKanjiReviewPitchAccentView(pitchAccent: pitchAccent)
            }
        }
    }

    private var supplementalAnswerControls: some View {
        ViewThatFits(in: .horizontal) {
            supplementalAnswerControlsLayout(horizontal: true)
            supplementalAnswerControlsLayout(horizontal: false)
        }
    }

    @ViewBuilder
    private func supplementalAnswerControlsLayout(horizontal: Bool) -> some View {
        if horizontal {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                if let pitchAccentText = presentation.pitchAccentText {
                    Text(pitchAccentText)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                audioButton
            }
        } else {
            VStack(alignment: .leading, spacing: 10) {
                if let pitchAccentText = presentation.pitchAccentText {
                    Text(pitchAccentText)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                audioButton
            }
        }
    }

    private var audioButton: some View {
        Button(action: playAudio) {
            Label("Riproduci pronuncia", systemImage: "speaker.wave.2.fill")
                .labelStyle(.iconOnly)
                .frame(width: 44, height: 44)
        }
        .buttonStyle(.bordered)
        .buttonBorderShape(.circle)
        .disabled(presentation.primaryAudioURL(baseURL: liveReviewBaseURL) == nil)
        .accessibilityLabel("Riproduci la pronuncia di \(audioReadingLabel)")
        .accessibilityHint(
            presentation.primaryAudioURL(baseURL: liveReviewBaseURL) == nil
                ? "Audio non disponibile"
                : "Riproduce la pronuncia della scheda"
        )
    }

    @ViewBuilder
    private var details: some View {
        if let exampleJp = nonEmpty(card.exampleJp) {
            Text(DailyKanjiReviewTextFormatter.displayText(exampleJp))
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
        }

        if let exampleIt = nonEmpty(card.exampleIt) {
            Text(DailyKanjiReviewTextFormatter.displayText(exampleIt))
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }

        if let notes = nonEmpty(card.notes) {
            Text(DailyKanjiReviewTextFormatter.displayText(notes))
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var gradeControls: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                LazyVStack(spacing: 8) {
                    gradeButtons
                }
            } else {
                LazyVGrid(
                    columns: [
                        GridItem(.flexible(), spacing: 8),
                        GridItem(.flexible(), spacing: 8)
                    ],
                    spacing: 8
                ) {
                    gradeButtons
                }
            }
        }
    }

    @ViewBuilder
    private var gradeButtons: some View {
        ForEach(DailyKanjiLiveReviewRating.reviewDisplayOrder, id: \.self) { rating in
            gradeButton(rating)
        }
    }

    @ViewBuilder
    private func gradeButton(_ rating: DailyKanjiLiveReviewRating) -> some View {
        if rating == .good || rating == .easy {
            Button {
                model.gradeLiveReview(rating)
            } label: {
                gradeButtonLabel(
                    rating,
                    nextReviewLabel: presentation.nextReviewLabel(for: rating),
                    isSubmitting: model.liveReviewState.submittingRating == rating
                )
            }
            .buttonStyle(.borderedProminent)
            .disabled(!model.liveReviewState.canGrade || !answerRevealed)
        } else {
            Button {
                model.gradeLiveReview(rating)
            } label: {
                gradeButtonLabel(
                    rating,
                    nextReviewLabel: presentation.nextReviewLabel(for: rating),
                    isSubmitting: model.liveReviewState.submittingRating == rating
                )
            }
            .buttonStyle(.bordered)
            .disabled(!model.liveReviewState.canGrade || !answerRevealed)
        }
    }

    private func gradeButtonLabel(
        _ rating: DailyKanjiLiveReviewRating,
        nextReviewLabel: String?,
        isSubmitting: Bool
    ) -> some View {
        VStack(spacing: 3) {
            if isSubmitting {
                ProgressView()
                    .controlSize(.small)
            } else {
                Text(rating.label)
                    .font(.headline)
                    .lineLimit(1)
            }

            Text(rating.detail)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.center)

            if let nextReviewLabel {
                Text(nextReviewLabel)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(gradeIntervalPresentation.lineLimit)
                    .multilineTextAlignment(.center)
                    .fixedSize(
                        horizontal: false,
                        vertical: gradeIntervalPresentation.allowsVerticalExpansion
                    )
            }
        }
        .frame(maxWidth: .infinity, minHeight: 72)
    }

    private var canReveal: Bool {
        if model.liveReviewState.canReveal {
            return true
        }

        if case .failed(_, let staleSession) = model.liveReviewState {
            return staleSession?.selectedCard?.cardId == card.cardId
        }

        return false
    }

    private var queueText: String {
        let queueCount = model.liveReviewState.session?.queue.queueCount ?? 0
        return "\(queueCount) in coda"
    }

    private var audioReadingLabel: String {
        presentation.readingText ?? presentation.frontText
    }

    private func revealAnswer() {
        answerRevealed = true
        playAudio()
    }

    private func playAudio() {
        guard let url = presentation.primaryAudioURL(baseURL: liveReviewBaseURL) else {
            return
        }

        audioPlayer.play(url: url)
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else {
            return nil
        }

        return value
    }
}

struct DailyKanjiReviewFrontText: View {
    static let fallbackLineLimit: Int? = nil

    @ScaledMetric(relativeTo: .largeTitle) private var baseSize = 78

    let presentation: DailyKanjiLiveReviewCardPresentation

    var renderedText: String {
        presentation.lineBreakProtectedFrontText
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            singleLine(scale: 1)
            singleLine(scale: 0.88)
            singleLine(scale: 0.76)
            singleLine(scale: 0.64)
            singleLine(scale: 0.52)
            fallbackText
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func singleLine(scale: CGFloat) -> some View {
        Text(renderedText)
            .font(.system(size: baseSize * scale, weight: .semibold))
            .lineLimit(1)
            .allowsTightening(true)
            .fixedSize(horizontal: true, vertical: true)
    }

    private var fallbackText: some View {
        Text(renderedText)
            .font(.system(size: baseSize * 0.64, weight: .semibold))
            .lineLimit(Self.fallbackLineLimit)
            .allowsTightening(true)
            .fixedSize(horizontal: false, vertical: true)
    }
}

private struct DailyKanjiReviewPitchAccentView: View {
    let pitchAccent: DailyKanjiLiveReviewCard.Pronunciation.Audio.PitchAccent

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(Array(pitchAccent.morae.enumerated()), id: \.offset) { index, mora in
                    VStack(spacing: 4) {
                        Circle()
                            .fill(isHigh(index: index) ? Color.accentColor : Color.secondary)
                            .frame(width: 7, height: 7)
                            .offset(y: isHigh(index: index) ? -9 : 0)

                        Text(mora)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .frame(minWidth: 20)
                }
            }
            .padding(.top, 8)

            if let source = pitchAccent.shape?.capitalized {
                Text("Schema \(source)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private func isHigh(index: Int) -> Bool {
        if let level = pitchAccent.levels?[safe: index] {
            return level == "high"
        }

        let moraIndex = index + 1

        if pitchAccent.downstep == 0 {
            return moraIndex > 1
        }

        if pitchAccent.downstep == 1 {
            return moraIndex == 1
        }

        return moraIndex > 1 && moraIndex <= pitchAccent.downstep
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
