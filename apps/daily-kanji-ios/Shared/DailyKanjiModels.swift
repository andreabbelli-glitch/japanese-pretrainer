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

enum DailyKanjiEntryKind: String, Codable {
    case term
    case grammar
}

enum DailyKanjiPriorityReason: String, Codable, Equatable {
    case recentHardAgain = "recent-hard-again"
    case learning
    case relearning
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
        compactExplanationText?.dailyKanjiCondensed(maxLength: 44)
    }

    var homeWidgetExplanationText: String? {
        compactExplanationText?.dailyKanjiCondensed(maxLength: 96)
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
}
