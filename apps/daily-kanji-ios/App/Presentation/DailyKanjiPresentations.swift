import Foundation
import NaturalLanguage
import SwiftUI

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
        case .grammar: "Grammatica"
        }
    }
}

extension DailyKanjiGlossaryEntry {
    var rowSummary: String {
        let trimmedMeaning = meaning.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedMeaning.count > 110 else {
            return trimmedMeaning
        }

        return "\(trimmedMeaning.prefix(107))…"
    }

    var rowAccessibilityLabel: String {
        [
            label,
            readingLine.map { "lettura \($0)" },
            "significato \(rowSummary)",
            kind.glossaryLabel
        ]
        .compactMap { $0 }
        .joined(separator: ", ")
    }

    var rowAccessibilityHint: String {
        "Apri dettaglio"
    }

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
        guard let typeLabel else {
            return text
        }

        return "\(text) - \(typeLabel)"
    }

    private var typeLabel: String? {
        guard let type else {
            return nil
        }

        switch type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "":
            return nil
        case "reading":
            return "lettura"
        case "alt":
            return "alternativa"
        case "romaji":
            return "rōmaji"
        default:
            return "altra forma"
        }
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

enum DailyKanjiWidgetScopeRowLayout: Equatable {
    case compact
    case stacked
}

enum DailyKanjiGlossaryRowLayout: Equatable {
    case compact
    case stacked
}

struct DailyKanjiGlossaryRowPresentation {
    func rowLayout(for dynamicTypeSize: DynamicTypeSize) -> DailyKanjiGlossaryRowLayout {
        dynamicTypeSize.isAccessibilitySize ? .stacked : .compact
    }
}

struct DailyKanjiGlossarySearchPresentation {
    let query: String

    private static let maximumDisplayedQueryLength = 24

    func fieldLayout(for dynamicTypeSize: DynamicTypeSize) -> DailyKanjiGlossarySearchFieldLayout {
        dynamicTypeSize.isAccessibilitySize ? .inline : .system
    }

    func emptyResultsLayout(
        for dynamicTypeSize: DynamicTypeSize
    ) -> DailyKanjiGlossaryEmptyResultsLayout {
        dynamicTypeSize.isAccessibilitySize ? .accessibility : .system
    }

    var emptyResultsTitle: String {
        "Nessun risultato"
    }

    func emptyResultsDescription(for dynamicTypeSize: DynamicTypeSize) -> String {
        let compactCopy = "Controlla l'ortografia o prova un altro termine."
        guard !dynamicTypeSize.isAccessibilitySize, let displayedQuery else {
            return compactCopy
        }

        return "Nessuna corrispondenza per “\(displayedQuery)”. Prova un altro termine."
    }

    private var displayedQuery: String? {
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            return nil
        }

        guard trimmedQuery.count > Self.maximumDisplayedQueryLength else {
            return trimmedQuery
        }

        return "\(trimmedQuery.prefix(Self.maximumDisplayedQueryLength))…"
    }
}

enum DailyKanjiGlossarySearchFieldLayout: Equatable {
    case system
    case inline
}

enum DailyKanjiGlossaryEmptyResultsLayout: Equatable {
    case system
    case accessibility
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

    func rowLayout(for dynamicTypeSize: DynamicTypeSize) -> DailyKanjiWidgetScopeRowLayout {
        dynamicTypeSize.isAccessibilitySize ? .stacked : .compact
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
        let text = textWithoutFurigana(value)

        guard let attributedText = inlineAttributedText(text) else {
            return text
        }

        return String(attributedText.characters)
    }

    static func lineBreakProtectedDisplayText(_ value: String) -> String {
        let text = textWithoutFurigana(value)

        guard let attributedText = inlineAttributedText(text) else {
            return text
        }

        let wordJoiner = "\u{2060}"
        return attributedText.runs.map { run in
            let runText = String(attributedText[run.range].characters)
            guard run.link != nil else {
                return runText
            }

            return runText.map(String.init).joined(separator: wordJoiner)
        }.joined()
    }

    private static func textWithoutFurigana(_ value: String) -> String {
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

    private static func inlineAttributedText(_ text: String) -> AttributedString? {
        try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )
    }
}

struct DailyKanjiReviewGradeIntervalPresentation: Equatable {
    let lineLimit: Int
    let allowsVerticalExpansion: Bool

    init(dynamicTypeSize: DynamicTypeSize) {
        let isAccessibilitySize = dynamicTypeSize.isAccessibilitySize
        self.lineLimit = isAccessibilitySize ? 2 : 1
        self.allowsVerticalExpansion = isAccessibilitySize
    }
}

enum DailyKanjiReviewHeaderLayout: Equatable {
    case compact
    case stacked
}

struct DailyKanjiReviewHeaderPresentation: Equatable {
    let layout: DailyKanjiReviewHeaderLayout
    let textLineLimit: Int?
    let allowsVerticalExpansion: Bool

    init(dynamicTypeSize: DynamicTypeSize) {
        let isAccessibilitySize = dynamicTypeSize.isAccessibilitySize
        self.layout = isAccessibilitySize ? .stacked : .compact
        self.textLineLimit = isAccessibilitySize ? nil : 1
        self.allowsVerticalExpansion = isAccessibilitySize
    }
}

enum DailyKanjiReviewAnswerSection: Hashable {
    case pronunciation
    case ratings
    case supplementalDetails
}

struct DailyKanjiLiveReviewCardPresentation: Equatable {
    let card: DailyKanjiLiveReviewCard
    let isAnswerRevealed: Bool

    var frontText: String {
        DailyKanjiReviewTextFormatter.displayText(card.front)
    }

    var lineBreakProtectedFrontText: String {
        Self.protectJapaneseWordLineBreaks(
            in: DailyKanjiReviewTextFormatter.lineBreakProtectedDisplayText(card.front)
        )
    }

    var backText: String {
        DailyKanjiReviewTextFormatter.displayText(card.back)
    }

    var studyAccessibilityLabel: String {
        var parts = [frontText]

        guard isAnswerRevealed else {
            return parts.joined(separator: ", ")
        }

        if let readingText {
            parts.append("lettura \(readingText)")
        }
        parts.append("significato \(backText)")
        return parts.joined(separator: ", ")
    }

    var shouldShowAnswer: Bool {
        isAnswerRevealed
    }

    var canGrade: Bool {
        isAnswerRevealed
    }

    var answerSections: [DailyKanjiReviewAnswerSection] {
        guard isAnswerRevealed else {
            return []
        }

        return [.pronunciation, .ratings, .supplementalDetails]
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

    func nextReviewLabel(
        for rating: DailyKanjiLiveReviewRating,
        locale: Locale = Locale(identifier: "it_IT"),
        timeZone: TimeZone = .autoupdatingCurrent
    ) -> String? {
        guard let label = card.gradePreviews?.first(where: { $0.rating == rating })?.nextReviewLabel
        else {
            return nil
        }

        return Self.localizedNextReviewLabel(
            label,
            locale: locale,
            timeZone: timeZone
        )
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

    private static func protectJapaneseWordLineBreaks(in text: String) -> String {
        guard !text.isEmpty else {
            return text
        }

        let tokenizer = NLTokenizer(unit: .word)
        tokenizer.string = text
        tokenizer.setLanguage(.japanese)

        let wordJoiner = "\u{2060}"
        var protectedText = ""
        var cursor = text.startIndex

        tokenizer.enumerateTokens(in: text.startIndex ..< text.endIndex) { range, _ in
            protectedText.append(contentsOf: text[cursor ..< range.lowerBound])
            protectedText.append(
                contentsOf: text[range]
                    .map(String.init)
                    .joined(separator: wordJoiner)
            )
            cursor = range.upperBound
            return true
        }

        protectedText.append(contentsOf: text[cursor ..< text.endIndex])
        return protectedText
    }

    private static func localizedNextReviewLabel(
        _ label: String,
        locale: Locale,
        timeZone: TimeZone
    ) -> String {
        let prefix = "Il "
        guard label.hasPrefix(prefix) else {
            return label
        }

        let isoDate = String(label.dropFirst(prefix.count))
        guard isoDate.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
        else {
            return label
        }

        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = timeZone
        parser.dateFormat = "yyyy-MM-dd"
        parser.isLenient = false

        guard let date = parser.date(from: isoDate), parser.string(from: date) == isoDate else {
            return "Data non disponibile"
        }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = locale
        formatter.timeZone = timeZone
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return "Il \(formatter.string(from: date))"
    }
}

struct DailyKanjiLiveReviewStatusPresentation: Equatable {
    let title: String
    let subtitle: String
    let emptyText: String
    let systemImage: String
    let isRefreshing: Bool
    let canRefresh: Bool

    init(
        state: DailyKanjiLiveReviewState,
        locale: Locale = Locale(identifier: "it_IT"),
        timeZone: TimeZone = .autoupdatingCurrent
    ) {
        let session = state.session

        switch state {
        case .unavailable:
            self.title = "Ripasso non disponibile"
            self.subtitle = "Disponibilità da impostare"
            self.emptyText = "Questa installazione non include il ripasso live."
            self.systemImage = "wifi.slash"
            self.isRefreshing = false
            self.canRefresh = false
        case .loading:
            self.title = "Aggiorno il ripasso"
            self.subtitle = Self.queueSubtitle(
                for: session,
                locale: locale,
                timeZone: timeZone
            )
            self.emptyText = "Preparazione del ripasso..."
            self.systemImage = "arrow.clockwise"
            self.isRefreshing = true
            self.canRefresh = false
        case .submitting(let session, let rating):
            self.title = "Invio \(rating.label)"
            self.subtitle = Self.queueSubtitle(
                for: session,
                locale: locale,
                timeZone: timeZone
            )
            self.emptyText = "Invio della valutazione..."
            self.systemImage = "paperplane"
            self.isRefreshing = true
            self.canRefresh = false
        case .ready(let session):
            self.title = "Ripasso"
            self.subtitle = Self.queueSubtitle(
                for: session,
                locale: locale,
                timeZone: timeZone
            )
            self.emptyText = "Non ci sono schede da ripassare."
            self.systemImage = "checkmark.circle"
            self.isRefreshing = false
            self.canRefresh = true
        case .failed(_, let staleSession):
            self.title = "Ripasso non disponibile"
            self.subtitle = staleSession == nil
                ? "Riprova tra poco."
                : "L'ultima sessione è disponibile in sola lettura."
            self.emptyText = "Non è possibile aggiornare il ripasso in questo momento."
            self.systemImage = "exclamationmark.triangle"
            self.isRefreshing = false
            self.canRefresh = true
        }
    }

    private static func queueSubtitle(
        for session: DailyKanjiLiveReviewSession?,
        locale: Locale,
        timeZone: TimeZone
    ) -> String {
        guard let session else {
            return "Preparazione della sessione"
        }

        if session.queue.queueCount > 0 {
            let queuedCardNoun = session.queue.queueCount == 1 ? "scheda" : "schede"
            let dueCardNoun = session.queue.dueCount == 1 ? "scheda" : "schede"
            return "\(session.queue.queueCount) \(queuedCardNoun) in coda · "
                + "\(session.queue.dueCount) \(dueCardNoun) da ripassare"
        }

        if let nextDueAt = session.queue.nextDueAt, !nextDueAt.isEmpty {
            guard let formattedNextDueAt = formattedNextDueAt(
                nextDueAt,
                locale: locale,
                timeZone: timeZone
            ) else {
                return "Data del prossimo ripasso non disponibile"
            }

            return "Prossimo ripasso \(formattedNextDueAt)"
        }

        return "Coda vuota"
    }

    private static func formattedNextDueAt(
        _ value: String,
        locale: Locale,
        timeZone: TimeZone
    ) -> String? {
        guard let date = iso8601Date(from: value) else {
            return nil
        }

        let dateFormatter = DateFormatter()
        dateFormatter.calendar = Calendar(identifier: .gregorian)
        dateFormatter.locale = locale
        dateFormatter.timeZone = timeZone
        dateFormatter.dateStyle = .long
        dateFormatter.timeStyle = .none

        let timeFormatter = DateFormatter()
        timeFormatter.calendar = Calendar(identifier: .gregorian)
        timeFormatter.locale = locale
        timeFormatter.timeZone = timeZone
        timeFormatter.dateStyle = .none
        timeFormatter.timeStyle = .short

        return "\(dateFormatter.string(from: date)) alle \(timeFormatter.string(from: date))"
    }

    private static func iso8601Date(from value: String) -> Date? {
        let value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: value) {
            return date
        }

        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
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
        case .failed(_, let source):
            self.title = "Aggiornamento non riuscito"
            self.subtitle = "I dati salvati restano disponibili. Riprova."
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

struct DailyKanjiSettingsDataPresentation: Equatable {
    let syncStatus: DailyKanjiSyncStatusPresentation

    var lastSyncAt: Date? {
        syncStatus.lastSyncAt
    }

    var lastSyncLabel: String? {
        lastSyncAt == nil ? nil : "Ultimo aggiornamento"
    }
}

struct DailyKanjiSettingsAboutPresentation: Equatable {
    let versionText: String

    let offlineDescription =
        "Le schede scaricate restano disponibili sul dispositivo anche senza connessione."

    init(bundle: Bundle = .main) {
        let version = Self.bundleString("CFBundleShortVersionString", in: bundle) ?? "—"
        let build = Self.bundleString("CFBundleVersion", in: bundle) ?? "—"
        self.versionText = "Versione \(version) (build \(build))"
    }

    private static func bundleString(_ key: String, in bundle: Bundle) -> String? {
        guard let value = bundle.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }

        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

enum DailyKanjiSettingsNotificationAction: Equatable {
    case requestAuthorization
    case openSettings
}

struct DailyKanjiSettingsNotificationPresentation: Equatable {
    let authorizationState: DailyKanjiNotificationAuthorizationState

    init(authorizationState: DailyKanjiNotificationAuthorizationState) {
        self.authorizationState = authorizationState
    }

    var title: String {
        switch authorizationState {
        case .unavailable:
            return "Notifiche di ripasso non incluse"
        case .notDetermined:
            return "Notifiche di ripasso"
        case .denied:
            return "Notifiche disattivate"
        case .authorized:
            return "Notifiche attive"
        }
    }

    var subtitle: String {
        switch authorizationState {
        case .unavailable:
            return "Questa installazione non invia promemoria di ripasso."
        case .notDetermined:
            return "Attivale per ricevere i promemoria di ripasso."
        case .denied:
            return "Puoi riattivarle dalle impostazioni di sistema."
        case .authorized:
            return "I promemoria possono essere gestiti nelle impostazioni di sistema."
        }
    }

    var action: DailyKanjiSettingsNotificationAction? {
        switch authorizationState {
        case .unavailable:
            return nil
        case .notDetermined:
            return .requestAuthorization
        case .denied, .authorized:
            return .openSettings
        }
    }

    var actionTitle: String? {
        switch authorizationState {
        case .unavailable:
            return nil
        case .notDetermined:
            return "Attiva notifiche"
        case .denied:
            return "Apri impostazioni"
        case .authorized:
            return "Gestisci notifiche"
        }
    }

}

struct DailyKanjiSettingsWidgetPresentation: Equatable {
    let scope: DailyKanjiWidgetScopePresentation

    var scopeSummary: String {
        scope.summary
    }

    var cadenceText: String {
        let slotMinutes = Int(DailyKanjiSelector.widgetSlotDuration / 60)
        let cadence = slotMinutes == 60
            ? "ogni ora"
            : "ogni \(slotMinutes) minuti"
        let plannedHours = Int(
            Double(DailyKanjiSelector.defaultWidgetTimelineEntryCount)
                * DailyKanjiSelector.widgetSlotDuration / 3_600
        )
        return "Una nuova scheda \(cadence) · \(plannedHours) ore programmate"
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
