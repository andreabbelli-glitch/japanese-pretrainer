import SwiftUI

struct ContentView: View {
    @ObservedObject var model: DailyKanjiAppModel
    @StateObject private var audioPlayer = DailyKanjiAudioPlayer()
    @State private var selectedAppSection: DailyKanjiAppSection = .review
    @State private var liveReviewAnswerRevealed = false
    private let liveReviewBaseURL = DailyKanjiMobileReviewConfiguration.load().endpointURL

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    switch selectedAppSection {
                    case .daily:
                        dailyStudyView
                    case .review:
                        liveReviewView
                    }
                }
                .padding(20)
            }
            .navigationTitle("Daily Kanji")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Modalità", selection: $selectedAppSection) {
                        ForEach(DailyKanjiAppSection.allCases) { section in
                            Text(section.label).tag(section)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 220)
                }
            }
            .background(Color(.systemGroupedBackground))
            .onChange(of: selectedAppSection) { _, section in
                if section == .review {
                    model.refreshLiveReviewNow()
                    resetAndPreloadCurrentLiveReviewAudio()
                }
            }
            .onChange(of: currentLiveReviewCardKey) { _, _ in
                liveReviewAnswerRevealed = false
                resetAndPreloadCurrentLiveReviewAudio()
            }
            .onAppear {
                resetAndPreloadCurrentLiveReviewAudio()
            }
        }
    }

    private var dailyStudyView: some View {
        VStack(alignment: .leading, spacing: 24) {
            syncStatusView
            studyScopeView

            if let card = model.selectedCard {
                selectedCardView(card)
            } else {
                emptyScopeView
            }

            historyView
        }
    }

    private var syncStatusView: some View {
        let presentation = DailyKanjiSyncStatusPresentation(syncState: model.syncState)

        return HStack(alignment: .center, spacing: 12) {
            Image(systemName: presentation.systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(width: 22)

            VStack(alignment: .leading, spacing: 2) {
                Text(presentation.title)
                    .font(.subheadline.weight(.semibold))

                Text(presentation.subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                if let lastSyncAt = presentation.lastSyncAt {
                    Text("Ultimo sync \(lastSyncAt, style: .relative)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer(minLength: 12)

            Button {
                model.refreshNow()
            } label: {
                if presentation.isRefreshing {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Label("Aggiorna ora", systemImage: "arrow.clockwise")
                        .labelStyle(.iconOnly)
                }
            }
            .buttonStyle(.bordered)
            .disabled(!presentation.canRefresh)
            .accessibilityLabel("Aggiorna ora")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var liveReviewView: some View {
        let presentation = DailyKanjiLiveReviewStatusPresentation(
            state: model.liveReviewState
        )

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: presentation.systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: 22)

                VStack(alignment: .leading, spacing: 2) {
                    Text(presentation.title)
                        .font(.subheadline.weight(.semibold))

                    Text(presentation.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 12)

                Button {
                    model.refreshLiveReviewNow()
                } label: {
                    if presentation.isRefreshing {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Label("Aggiorna review", systemImage: "arrow.clockwise")
                            .labelStyle(.iconOnly)
                    }
                }
                .buttonStyle(.bordered)
                .disabled(!presentation.canRefresh)
                .accessibilityLabel("Aggiorna review")
            }

            if let card = model.liveReviewState.session?.selectedCard {
                liveReviewCardView(card)
            } else {
                Text(presentation.emptyText)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func liveReviewCardView(_ card: DailyKanjiLiveReviewCard) -> some View {
        let presentation = DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: liveReviewAnswerRevealed
        )

        return VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 8) {
                Text(card.mediaTitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Spacer(minLength: 0)

                Text("\(model.liveReviewState.session?.queue.queueCount ?? 0) in coda")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }

            Text(presentation.frontText)
                .font(.system(size: 78, weight: .semibold))
                .minimumScaleFactor(0.32)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            if presentation.shouldShowAnswer {
                liveReviewAnswerView(presentation)
                liveReviewGradeGrid(presentation)
            } else {
                Button {
                    revealLiveReviewAnswer(for: card)
                } label: {
                    Label("Rivela", systemImage: "eye.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!model.liveReviewState.canGrade)
            }
        }
        .opacity(model.liveReviewState.canGrade || model.liveReviewState.isSubmitting ? 1 : 0.72)
    }

    @ViewBuilder
    private func liveReviewAnswerView(
        _ presentation: DailyKanjiLiveReviewCardPresentation
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                if let readingText = presentation.readingText {
                    Text(readingText)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                if let pitchAccentText = presentation.pitchAccentText {
                    Text(pitchAccentText)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                Button {
                    playLiveReviewAudio(presentation)
                } label: {
                    Label("Audio", systemImage: "speaker.wave.2.fill")
                        .labelStyle(.iconOnly)
                }
                .buttonStyle(.bordered)
                .disabled(presentation.primaryAudioURL(baseURL: liveReviewBaseURL) == nil)
                .accessibilityLabel("Audio")
            }

            if let pitchAccent = presentation.pitchAccent {
                DailyKanjiLiveReviewPitchAccentView(pitchAccent: pitchAccent)
            }

            Text(presentation.backText)
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)

            if let exampleJp = presentation.card.exampleJp, !exampleJp.isEmpty {
                Text(DailyKanjiReviewTextFormatter.displayText(exampleJp))
                    .font(.body)
            }

            if let exampleIt = presentation.card.exampleIt, !exampleIt.isEmpty {
                Text(DailyKanjiReviewTextFormatter.displayText(exampleIt))
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            if let notes = presentation.card.notes, !notes.isEmpty {
                Text(DailyKanjiReviewTextFormatter.displayText(notes))
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func liveReviewGradeGrid(
        _ presentation: DailyKanjiLiveReviewCardPresentation
    ) -> some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 8),
                GridItem(.flexible(), spacing: 8)
            ],
            spacing: 8
        ) {
            ForEach(DailyKanjiLiveReviewRating.reviewDisplayOrder, id: \.self) { rating in
                liveReviewGradeButton(rating, presentation: presentation)
            }
        }
    }

    @ViewBuilder
    private func liveReviewGradeButton(
        _ rating: DailyKanjiLiveReviewRating,
        presentation: DailyKanjiLiveReviewCardPresentation
    ) -> some View {
        let isSubmitting = model.liveReviewState.submittingRating == rating

        if rating == .good || rating == .easy {
            Button {
                model.gradeLiveReview(rating)
            } label: {
                liveReviewGradeButtonLabel(
                    rating,
                    nextReviewLabel: presentation.nextReviewLabel(for: rating),
                    isSubmitting: isSubmitting
                )
            }
            .buttonStyle(.borderedProminent)
            .disabled(!model.liveReviewState.canGrade || !liveReviewAnswerRevealed)
        } else {
            Button {
                model.gradeLiveReview(rating)
            } label: {
                liveReviewGradeButtonLabel(
                    rating,
                    nextReviewLabel: presentation.nextReviewLabel(for: rating),
                    isSubmitting: isSubmitting
                )
            }
            .buttonStyle(.bordered)
            .disabled(!model.liveReviewState.canGrade || !liveReviewAnswerRevealed)
        }
    }

    private func liveReviewGradeButtonLabel(
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
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 72)
    }

    private var currentLiveReviewCardKey: String? {
        guard let card = model.liveReviewState.session?.selectedCard else {
            return nil
        }

        return "\(card.cardId):\(card.reviewStateUpdatedAt ?? "")"
    }

    private func revealLiveReviewAnswer(for card: DailyKanjiLiveReviewCard) {
        liveReviewAnswerRevealed = true
        let presentation = DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: true
        )
        playLiveReviewAudio(presentation)
    }

    private func playLiveReviewAudio(_ presentation: DailyKanjiLiveReviewCardPresentation) {
        guard let url = presentation.primaryAudioURL(baseURL: liveReviewBaseURL) else {
            return
        }

        audioPlayer.play(url: url)
    }

    private func resetAndPreloadCurrentLiveReviewAudio() {
        guard selectedAppSection == .review,
              let card = model.liveReviewState.session?.selectedCard
        else {
            return
        }

        let presentation = DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: true
        )
        audioPlayer.preload(url: presentation.primaryAudioURL(baseURL: liveReviewBaseURL))
    }

    private var studyScopeView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker(
                "Modalità",
                selection: Binding(
                    get: { model.draftStudyMode },
                    set: { model.setDraftStudyMode($0) }
                )
            ) {
                ForEach(DailyKanjiStudyMode.allCases) { mode in
                    Text(mode.label).tag(mode)
                }
            }
            .pickerStyle(.segmented)

            HStack(spacing: 12) {
                if model.draftStudyModeUsesMediaSelection {
                    Picker(
                        "Media",
                        selection: Binding<String?>(
                            get: { model.draftMediaSlug },
                            set: { model.setDraftSelectedMediaSlug($0) }
                        )
                    ) {
                        ForEach(model.mediaPickerOptions) { option in
                            Text(option.title).tag(Optional(option.slug))
                        }
                    }
                    .pickerStyle(.menu)
                } else {
                    Label("All media", systemImage: "rectangle.stack")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                Text("\(model.draftScopedCardCount) card")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 10) {
                if model.hasStudyScopeDraftChanges {
                    Button {
                        model.resetStudyScopeDraft()
                    } label: {
                        Label("Annulla", systemImage: "xmark")
                    }
                    .buttonStyle(.bordered)
                }

                Button {
                    model.applyStudyScope()
                } label: {
                    Label("Applica", systemImage: "checkmark")
                }
                .buttonStyle(.borderedProminent)
                .disabled(!model.hasStudyScopeDraftChanges)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func selectedCardView(_ card: DailyKanjiCard) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(card.displayFront)
                .font(.system(size: 84, weight: .semibold))
                .minimumScaleFactor(0.32)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 10) {
                Text(card.back)
                    .font(.title3.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)

                HStack(alignment: .lastTextBaseline, spacing: 8) {
                    Text(card.readingText)
                        .font(.body)
                        .foregroundStyle(.secondary)

                    Text(card.pitchAccentText)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 10) {
                Label(card.priorityText, systemImage: "target")
                    .font(.caption.weight(.medium))

                Spacer(minLength: 0)

                Button {
                    audioPlayer.play(card: card)
                } label: {
                    Label("Audio", systemImage: "speaker.wave.2.fill")
                }
                .buttonStyle(.bordered)
                .disabled(!audioPlayer.hasBundledAudio(card: card))
            }

            if let selectedHistoryContext = model.selectedHistoryContext {
                Label(selectedHistoryContext.metadataText(), systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if !card.detailExampleLines.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(card.detailExampleLines.enumerated()), id: \.offset) { index, line in
                        Text(line)
                            .font(index == 0 ? .body : .callout)
                            .foregroundStyle(index == 0 ? .primary : .secondary)
                    }
                }
            }

            if let notes = card.notes {
                Text(notes)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }

            studySignalsView(card)

            Text(card.sourceText)
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private var emptyScopeView: some View {
        Text("Nessuna card per questa selezione.")
            .font(.callout)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func studySignalsView(_ card: DailyKanjiCard) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            metricRow("Difficulty", value: card.srs.difficultyText)
            metricRow("Stability", value: card.srs.stabilityText)
            metricRow("Hard/again", value: "\(card.srs.recentHardAgainCount)")
            metricRow("Lapses", value: "\(card.srs.lapses)")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.top, 2)
    }

    private func metricRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
            Spacer(minLength: 12)
            Text(value)
                .fontWeight(.medium)
        }
    }

    private var historyView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent")
                .font(.headline)

            if model.recentHistory.isEmpty {
                Text("No recent cards yet.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 8) {
                    ForEach(model.recentHistory) { item in
                        if let card = model.card(for: item) {
                            Button {
                                model.selectHistoryItem(item)
                            } label: {
                                HStack(alignment: .center, spacing: 14) {
                                    Text(card.displayFront)
                                        .font(.system(size: 34, weight: .semibold))
                                        .lineLimit(1)
                                        .minimumScaleFactor(0.45)
                                        .allowsTightening(true)
                                        .frame(width: 116, alignment: .leading)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(card.back)
                                            .font(.subheadline.weight(.medium))
                                            .lineLimit(1)

                                        Text(card.readingText)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)

                                        Text(item.metadataText())
                                            .font(.caption2)
                                            .foregroundStyle(.tertiary)
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .padding(.vertical, 6)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

#Preview {
    ContentView(model: DailyKanjiAppModel())
}

private enum DailyKanjiAppSection: String, CaseIterable, Identifiable {
    case daily
    case review

    var id: String { rawValue }

    var label: String {
        switch self {
        case .daily:
            return "Daily"
        case .review:
            return "Review"
        }
    }
}

private extension DailyKanjiLiveReviewRating {
    static let reviewDisplayOrder: [DailyKanjiLiveReviewRating] = [
        .easy,
        .good,
        .hard,
        .again
    ]

    var label: String {
        switch self {
        case .again:
            return "Again"
        case .hard:
            return "Hard"
        case .good:
            return "Good"
        case .easy:
            return "Easy"
        }
    }

    var detail: String {
        switch self {
        case .again:
            return "Torna subito"
        case .hard:
            return "Fragile"
        case .good:
            return "Avanza"
        case .easy:
            return "Intervallo lungo"
        }
    }
}

private struct DailyKanjiLiveReviewPitchAccentView: View {
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

            if let source = pitchAccentSourceText {
                Text(source)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private var pitchAccentSourceText: String? {
        guard let shape = pitchAccent.shape else {
            return nil
        }

        return "\(shape.capitalized) pattern"
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

struct DailyKanjiLiveReviewStatusPresentation: Equatable {
    let title: String
    let subtitle: String
    let emptyText: String
    let systemImage: String
    let isRefreshing: Bool
    let canRefresh: Bool

    init(state: DailyKanjiLiveReviewState) {
        let session = state.session

        switch state {
        case .unavailable:
            self.title = "Live review non configurata"
            self.subtitle = "Uso solo dataset locale"
            self.emptyText = "Configura endpoint e token per la review live."
            self.systemImage = "wifi.slash"
            self.isRefreshing = false
            self.canRefresh = false
        case .loading:
            self.title = "Carico review live"
            self.subtitle = Self.queueSubtitle(for: session)
            self.emptyText = "Caricamento..."
            self.systemImage = "arrow.clockwise"
            self.isRefreshing = true
            self.canRefresh = false
        case .submitting(let session, let rating):
            self.title = "Invio \(rating.label)"
            self.subtitle = Self.queueSubtitle(for: session)
            self.emptyText = "Invio voto..."
            self.systemImage = "paperplane"
            self.isRefreshing = true
            self.canRefresh = false
        case .ready(let session):
            self.title = "Review live"
            self.subtitle = Self.queueSubtitle(for: session)
            self.emptyText = "Nessuna card live in coda."
            self.systemImage = "checkmark.circle"
            self.isRefreshing = false
            self.canRefresh = true
        case .failed(let message, let staleSession):
            self.title = "Review live offline"
            self.subtitle = staleSession == nil ? message : "\(message) - sola lettura"
            self.emptyText = "Review live non disponibile."
            self.systemImage = "exclamationmark.triangle"
            self.isRefreshing = false
            self.canRefresh = true
        }
    }

    private static func queueSubtitle(for session: DailyKanjiLiveReviewSession?) -> String {
        guard let session else {
            return "Connessione al server"
        }

        if session.queue.queueCount > 0 {
            return "\(session.queue.queueCount) in coda - \(session.queue.dueCount) due"
        }

        if let nextDueAt = session.queue.nextDueAt, !nextDueAt.isEmpty {
            return "Prossima due \(nextDueAt)"
        }

        return "Coda vuota"
    }
}

struct DailyKanjiSyncStatusPresentation: Equatable {
    let title: String
    let subtitle: String
    let lastSyncAt: Date?
    let systemImage: String
    let isRefreshing: Bool
    let canRefresh: Bool

    init(syncState: DailyKanjiSyncState) {
        switch syncState {
        case .unavailable:
            self.title = "Sync non configurato"
            self.subtitle = "Uso cache o bundle locale"
            self.lastSyncAt = nil
            self.systemImage = "wifi.slash"
            self.isRefreshing = false
            self.canRefresh = false
        case .idle(let source):
            self.title = Self.title(for: source)
            self.subtitle = Self.subtitle(for: source)
            self.lastSyncAt = Self.lastSyncAt(for: source)
            self.systemImage = Self.systemImage(for: source)
            self.isRefreshing = false
            self.canRefresh = true
        case .syncing(let source):
            self.title = "Sincronizzo"
            self.subtitle = Self.subtitle(for: source)
            self.lastSyncAt = Self.lastSyncAt(for: source)
            self.systemImage = "arrow.clockwise"
            self.isRefreshing = true
            self.canRefresh = false
        case .failed(let message, let source):
            self.title = "Cache non aggiornata"
            self.subtitle = message
            self.lastSyncAt = Self.lastSyncAt(for: source)
            self.systemImage = "exclamationmark.triangle"
            self.isRefreshing = false
            self.canRefresh = true
        }
    }

    private static func title(for source: DailyKanjiDatasetSource) -> String {
        switch source {
        case .cache:
            return "Sincronizzato"
        case .bundle:
            return "Bundle"
        case .sample:
            return "Sample"
        }
    }

    private static func subtitle(for source: DailyKanjiDatasetSource) -> String {
        switch source {
        case .cache(let metadata):
            guard let metadata else {
                return "Cache condivisa"
            }

            return "Cache condivisa - \(metadata.cardCount) card"
        case .bundle:
            return "Snapshot incluso"
        case .sample:
            return "Dataset non esportato"
        }
    }

    private static func lastSyncAt(for source: DailyKanjiDatasetSource) -> Date? {
        switch source {
        case .cache(let metadata):
            return metadata?.cachedAt
        case .bundle, .sample:
            return nil
        }
    }

    private static func systemImage(for source: DailyKanjiDatasetSource) -> String {
        switch source {
        case .cache:
            return "checkmark.icloud"
        case .bundle:
            return "shippingbox"
        case .sample:
            return "exclamationmark.circle"
        }
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

private extension DailyKanjiCard.SRS {
    var difficultyText: String {
        guard let difficulty else {
            return "-"
        }

        return String(format: "%.1f", difficulty)
    }

    var stabilityText: String {
        guard let stability else {
            return "-"
        }

        return String(format: "%.1fd", stability)
    }
}
