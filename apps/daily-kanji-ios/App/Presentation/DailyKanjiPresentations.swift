import Foundation

enum DailyKanjiAppTab: String, CaseIterable, Identifiable {
    case widget
    case review
    case search

    var id: String { rawValue }

    var label: String {
        switch self {
        case .widget: "Widget"
        case .review: "Ripasso"
        case .search: "Cerca"
        }
    }

    var systemImage: String {
        switch self {
        case .widget: "rectangle.stack"
        case .review: "rectangle.stack.badge.play"
        case .search: "magnifyingglass"
        }
    }
}

extension DailyKanjiEntryKind {
    var glossaryLabel: String {
        switch self {
        case .term: "Termine"
        case .grammar: "Grammar"
        }
    }
}

extension DailyKanjiGlossaryEntry {
    var readingLine: String? {
        let parts = [reading, romaji].compactMap { value -> String? in
            guard let value, !value.isEmpty else {
                return nil
            }
            return value
        }

        guard !parts.isEmpty else {
            return nil
        }

        return parts.joined(separator: " / ")
    }

    var primaryAudioMedia: MediaRef? {
        media.first { media in
            guard let audioSrc = media.audioSrc else {
                return false
            }

            return !audioSrc.isEmpty
        }
    }

    var pitchAccentText: String? {
        guard let pitchAccent else {
            return nil
        }

        return "Pitch \(pitchAccent)"
    }

    var pitchAccentSourceText: String? {
        guard let pitchAccentSource, !pitchAccentSource.isEmpty else {
            return nil
        }

        return pitchAccentSource
    }

    var pitchAccentPattern: DailyKanjiPitchAccentPattern? {
        DailyKanjiPitchAccentPattern(reading: reading, pitchAccent: pitchAccent)
    }
}

extension DailyKanjiGlossaryEntry.Alias {
    var stableId: String {
        "\(text):\(type ?? "")"
    }

    var displayText: String {
        guard let type, !type.isEmpty else {
            return text
        }

        return "\(text) - \(type)"
    }
}

extension DailyKanjiGlossaryEntry.MediaRef {
    var stableId: String {
        "\(entryId):\(sourceId):\(mediaSlug):\(segmentTitle ?? "")"
    }

    var displayText: String {
        guard let segmentTitle, !segmentTitle.isEmpty else {
            return mediaTitle
        }

        return "\(mediaTitle) - \(segmentTitle)"
    }
}

extension DailyKanjiStudyMode {
    var label: String {
        switch self {
        case .daily: "Giornaliero"
        case .prestudy: "Prestudio"
        case .lastLessonsHardAgain: "Ultime 3"
        }
    }
}

struct DailyKanjiWidgetScopePresentation: Equatable {
    let studyMode: DailyKanjiStudyMode
    let selectedMediaTitle: String?
    let availableCardCount: Int

    var summary: String {
        [
            studyMode.label,
            selectedMediaTitle ?? "Tutti i media",
            cardCountText
        ].joined(separator: " · ")
    }

    private var cardCountText: String {
        let noun = availableCardCount == 1 ? "scheda" : "schede"
        let availability = availableCardCount == 1 ? "disponibile" : "disponibili"
        return "\(availableCardCount) \(noun) \(availability)"
    }
}

extension DailyKanjiLiveReviewRating {
    static let reviewDisplayOrder: [Self] = [.easy, .good, .hard, .again]

    var label: String {
        switch self {
        case .again: "Di nuovo"
        case .hard: "Difficile"
        case .good: "Bene"
        case .easy: "Facile"
        }
    }

    var detail: String {
        switch self {
        case .again: "Torna subito"
        case .hard: "Fragile"
        case .good: "Avanza"
        case .easy: "Intervallo lungo"
        }
    }
}

enum DailyKanjiReviewTextFormatter {
    static func displayText(_ value: String) -> String {
        var output = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let patterns = [
            #"\{\{([^{}|]+)\|([^{}]+)\}\}"#,
            #"\{([^{}|]+)\|([^{}]+)\}"#
        ]

        for _ in 0..<4 {
            let previous = output

            for pattern in patterns {
                output = output.replacingOccurrences(
                    of: pattern,
                    with: "$1",
                    options: .regularExpression
                )
            }

            if output == previous {
                break
            }
        }

        return output
            .replacingOccurrences(of: "{{", with: "")
            .replacingOccurrences(of: "}}", with: "")
            .replacingOccurrences(of: "{", with: "")
            .replacingOccurrences(of: "}", with: "")
    }
}

struct DailyKanjiLiveReviewCardPresentation: Equatable {
    let card: DailyKanjiLiveReviewCard
    let isAnswerRevealed: Bool

    var frontText: String {
        DailyKanjiReviewTextFormatter.displayText(card.front)
    }

    var backText: String {
        DailyKanjiReviewTextFormatter.displayText(card.back)
    }

    var shouldShowAnswer: Bool {
        isAnswerRevealed
    }

    var canGrade: Bool {
        isAnswerRevealed
    }

    var readingText: String? {
        nonEmpty(card.reading)
            ?? card.pronunciations?.compactMap { nonEmpty($0.resolvedReading) }.first
            ?? card.entries?.compactMap { nonEmpty($0.reading) }.first
    }

    var pitchAccent: DailyKanjiLiveReviewCard.Pronunciation.Audio.PitchAccent? {
        card.pronunciations?.compactMap(\.resolvedPitchAccent).first
    }

    var pitchAccentText: String? {
        guard let pitchAccent else {
            return nil
        }

        let shape = pitchAccent.shape.map(Self.formatPitchAccentShape) ?? "Pitch"
        return "\(shape) (\(pitchAccent.downstep))"
    }

    var primaryAudioSource: String? {
        guard isAnswerRevealed else {
            return nil
        }

        return card.pronunciations?.compactMap { nonEmpty($0.resolvedAudioSource) }.first
    }

    var answerDetailRows: [String] {
        guard isAnswerRevealed else {
            return []
        }

        return [
            readingText,
            pitchAccentText,
            nonEmpty(card.mediaTitle)
        ].compactMap { $0 }
    }

    func nextReviewLabel(for rating: DailyKanjiLiveReviewRating) -> String? {
        card.gradePreviews?.first { $0.rating == rating }?.nextReviewLabel
    }

    func primaryAudioURL(baseURL: URL?) -> URL? {
        DailyKanjiLiveReviewAudioSource.remoteURL(for: primaryAudioSource, baseURL: baseURL)
    }

    private static func formatPitchAccentShape(_ shape: String) -> String {
        switch shape {
        case "heiban": "Heiban"
        case "atamadaka": "Atamadaka"
        case "nakadaka": "Nakadaka"
        case "odaka": "Odaka"
        default: "Pitch"
        }
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
        case .cache(let metadata):
            return metadata == nil ? "Cache da verificare" : "Sincronizzato"
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
                return "Cache condivisa - aggiornamento richiesto"
            }
            return "Cache condivisa - \(metadata.cardCount) card"
        case .bundle:
            return "Snapshot incluso"
        case .sample:
            return "Dataset non esportato"
        }
    }

    private static func lastSyncAt(for source: DailyKanjiDatasetSource) -> Date? {
        if case .cache(let metadata) = source {
            return metadata?.cachedAt
        }
        return nil
    }

    private static func systemImage(for source: DailyKanjiDatasetSource) -> String {
        switch source {
        case .cache(let metadata):
            return metadata == nil ? "exclamationmark.triangle" : "checkmark.icloud"
        case .bundle:
            return "shippingbox"
        case .sample:
            return "exclamationmark.circle"
        }
    }
}

extension DailyKanjiCard.SRS {
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
