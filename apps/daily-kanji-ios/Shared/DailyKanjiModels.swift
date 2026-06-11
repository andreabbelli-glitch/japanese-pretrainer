import Foundation

struct DailyKanjiDataset: Codable {
    let version: Int
    let generatedAt: String
    let recentMistakeLookbackDays: Int
    let cards: [DailyKanjiCard]

    static func decode(jsonData: Data) throws -> DailyKanjiDataset {
        try JSONDecoder().decode(DailyKanjiDataset.self, from: jsonData)
    }
}

struct DailyKanjiCard: Codable, Identifiable, Equatable {
    struct Media: Codable, Equatable {
        let slug: String
        let title: String
    }

    struct Lesson: Codable, Equatable {
        let slug: String
        let title: String
    }

    struct Segment: Codable, Equatable {
        let title: String
    }

    struct Entry: Codable, Equatable {
        let audioSrc: String?
        let id: String
        let kind: DailyKanjiEntryKind
        let label: String
        let meaning: String
        let pitchAccent: Int?
        let pitchAccentSource: String?
        let reading: String?
    }

    struct SRS: Codable, Equatable {
        let difficulty: Double?
        let dueAt: String?
        let lapses: Int
        let lastHardAgainAt: String?
        let lastInteractionAt: String
        let lastReviewedAt: String?
        let learningSteps: Int
        let priorityReasons: [DailyKanjiPriorityReason]
        let priorityScore: Double
        let recentHardAgainCount: Int
        let reps: Int
        let scheduledDays: Int
        let stability: Double?
        let state: DailyKanjiStudyState
    }

    var id: String { cardId }

    let cardId: String
    let subjectKey: String
    let media: Media
    let lesson: Lesson
    let segment: Segment?
    let front: String
    let back: String
    let kanji: [String]
    let entry: Entry
    let exampleIt: String?
    let exampleJp: String?
    let notes: String?
    let srs: SRS
}

struct DailyKanjiPitchAccentPattern: Equatable {
    struct Mora: Equatable, Identifiable {
        let index: Int
        let text: String
        let isHigh: Bool

        var id: Int { index }
    }

    struct Rail: Equatable {
        let start: Int
        let length: Int
        let tail: Bool
    }

    struct Connector: Equatable {
        enum Kind: Equatable {
            case drop
            case rise
        }

        let boundary: Int
        let kind: Kind
    }

    let downstep: Int
    let moras: [Mora]

    var upperRails: [Rail] {
        if downstep == 0 {
            return [
                Rail(start: 1, length: max(moras.count - 1, 0), tail: true)
            ]
        }

        if downstep == 1 {
            return [
                Rail(start: 0, length: 1, tail: false)
            ]
        }

        return [
            Rail(
                start: 1,
                length: max(downstep - 1, 0),
                tail: false
            )
        ]
    }

    var lowerRails: [Rail] {
        var rails: [Rail] = []

        if downstep == 0 {
            rails.append(Rail(start: 0, length: 1, tail: false))
            return rails
        }

        if downstep > 1 {
            rails.append(Rail(start: 0, length: 1, tail: false))
        }

        if downstep < moras.count {
            rails.append(
                Rail(
                    start: downstep,
                    length: moras.count - downstep,
                    tail: true
                )
            )
        }

        return rails
    }

    var connectors: [Connector] {
        var connectors: [Connector] = []

        if downstep == 0 {
            connectors.append(Connector(boundary: 1, kind: .rise))
            return connectors
        }

        if downstep > 1 {
            connectors.append(Connector(boundary: 1, kind: .rise))
        }

        if downstep < moras.count {
            connectors.append(Connector(boundary: downstep, kind: .drop))
            return connectors
        }

        connectors.append(Connector(boundary: moras.count, kind: .drop))
        return connectors
    }
}

enum DailyKanjiEntryKind: String, Codable {
    case term
    case grammar
}

enum DailyKanjiPriorityReason: String, Codable, Equatable {
    case recentHardAgain = "recent-hard-again"
    case learning
    case relearning
    case highDifficulty = "high-difficulty"
    case lowStability = "low-stability"
    case lapses
}

enum DailyKanjiStudyState: String, Codable, Equatable {
    case learning
    case review
    case relearning
}

extension DailyKanjiCard {
    var displayFront: String {
        front.isEmpty ? entry.label : front
    }

    var lockScreenFrontText: String {
        displayFront
    }

    var kanjiText: String {
        kanji.isEmpty ? displayFront : kanji.joined(separator: " ")
    }

    var readingText: String {
        entry.reading ?? "Reading unavailable"
    }

    var pitchAccentText: String {
        guard let pitchAccent = entry.pitchAccent else {
            return "Pitch accent unavailable"
        }

        return "Pitch \(pitchAccent)"
    }

    var lockScreenPitchAccentText: String? {
        guard let pitchAccent = entry.pitchAccent, lockScreenPitchAccentPattern != nil else {
            return nil
        }

        return "P\(pitchAccent)"
    }

    var lockScreenPitchAccentPattern: DailyKanjiPitchAccentPattern? {
        DailyKanjiPitchAccentPattern(
            reading: entry.reading,
            pitchAccent: entry.pitchAccent
        )
    }

    var lockScreenTranslationText: String {
        let meaning = entry.meaning.trimmingCharacters(in: .whitespacesAndNewlines)
        if !meaning.isEmpty {
            return meaning.dailyKanjiCondensed(maxLength: 72)
        }

        return back
            .dailyKanjiTranslationFallback(reading: entry.reading)
            .dailyKanjiCondensed(maxLength: 72)
    }

    var lockScreenMetadataText: String {
        let metadataParts: [String?] = [entry.reading, lockScreenPitchAccentText]
        let parts = metadataParts.compactMap { $0 }.filter { !$0.isEmpty }

        if !parts.isEmpty {
            return parts.joined(separator: " - ")
        }

        return priorityText
    }

    var sourceText: String {
        "\(media.title) - \(lesson.title)"
    }

    var detailExampleLines: [String] {
        [exampleJp, exampleIt].compactMap { value in
            guard let value, !value.isEmpty else {
                return nil
            }

            return value
        }
    }

    var compactExplanationText: String? {
        if let notes, !notes.isEmpty {
            return notes
        }

        if let exampleIt, !exampleIt.isEmpty {
            return exampleIt
        }

        if let exampleJp, !exampleJp.isEmpty {
            return exampleJp
        }

        return nil
    }

    var lockScreenExplanationText: String? {
        compactExplanationText?.dailyKanjiCondensed(maxLength: 148)
    }

    var homeWidgetExplanationText: String? {
        compactExplanationText?.dailyKanjiCondensed(maxLength: 176)
    }

    var priorityText: String {
        if srs.priorityReasons.contains(.recentHardAgain) {
            return "Recent hard/again"
        }

        if srs.state == .relearning {
            return "Relearning"
        }

        if srs.state == .learning {
            return "Learning"
        }

        if srs.priorityReasons.contains(.lowStability) {
            return "Low stability"
        }

        if srs.priorityReasons.contains(.highDifficulty) {
            return "High difficulty"
        }

        return "Review"
    }
}

private extension String {
    func dailyKanjiCondensed(maxLength: Int) -> String {
        let compacted = split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        guard compacted.count > maxLength else {
            return compacted
        }

        let suffixLength = 3
        let prefixLength = max(maxLength - suffixLength, 0)
        let endIndex = compacted.index(compacted.startIndex, offsetBy: prefixLength)
        let prefix = compacted[..<endIndex]

        if let lastSpace = prefix.lastIndex(of: " "), lastSpace > prefix.startIndex {
            return "\(prefix[..<lastSpace])..."
        }

        return "\(prefix)..."
    }

    func dailyKanjiTranslationFallback(reading: String?) -> String {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)

        if let reading {
            let readingPrefix = reading.trimmingCharacters(in: .whitespacesAndNewlines)
            if !readingPrefix.isEmpty {
                for separator in [" — ", " - ", " – ", ": "] {
                    let prefix = "\(readingPrefix)\(separator)"
                    if trimmed.hasPrefix(prefix) {
                        return String(trimmed.dropFirst(prefix.count))
                    }
                }
            }
        }

        for separator in [" — ", " - ", " – "] {
            if let range = trimmed.range(of: separator) {
                return String(trimmed[range.upperBound...])
            }
        }

        return trimmed
    }
}

private extension DailyKanjiPitchAccentPattern {
    init?(reading: String?, pitchAccent: Int?) {
        guard let reading, let pitchAccent else {
            return nil
        }

        let moraTexts = Self.moras(from: reading)
        guard !moraTexts.isEmpty, pitchAccent >= 0, pitchAccent <= moraTexts.count else {
            return nil
        }

        downstep = pitchAccent
        moras = moraTexts.enumerated().map { index, text in
            Mora(
                index: index,
                text: text,
                isHigh: Self.isHigh(moraIndex: index + 1, pitchAccent: pitchAccent)
            )
        }
    }

    static func moras(from reading: String) -> [String] {
        var moras: [String] = []

        let compactReading = reading
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .filter { !$0.isWhitespace }

        for scalar in compactReading.map(String.init) {
            if isContractedKana(scalar), let last = moras.indices.last {
                moras[last] += scalar
            } else {
                moras.append(scalar)
            }
        }

        return moras
    }

    static func isHigh(moraIndex: Int, pitchAccent: Int) -> Bool {
        if pitchAccent == 0 {
            return moraIndex > 1
        }

        if pitchAccent == 1 {
            return moraIndex == 1
        }

        return moraIndex > 1 && moraIndex <= pitchAccent
    }

    static func isContractedKana(_ character: String) -> Bool {
        [
            "ゃ", "ゅ", "ょ", "ャ", "ュ", "ョ",
            "ぁ", "ぃ", "ぅ", "ぇ", "ぉ",
            "ァ", "ィ", "ゥ", "ェ", "ォ",
            "ゎ", "ヮ"
        ].contains(character)
    }
}
