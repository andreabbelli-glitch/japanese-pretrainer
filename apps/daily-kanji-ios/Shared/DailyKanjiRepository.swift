import Foundation

struct DailyKanjiRepository {
    private let bundle: Bundle

    init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    func loadCards() -> [DailyKanjiCard] {
        guard
            let url = bundle.url(forResource: "daily-kanji-cards", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let dataset = try? DailyKanjiDataset.decode(jsonData: data),
            !dataset.cards.isEmpty
        else {
            return DailyKanjiSampleData.cards
        }

        return dataset.cards
    }
}

enum DailyKanjiSampleData {
    static let card = DailyKanjiCard(
        cardId: "sample-kanji",
        subjectKey: "sample:kanji",
        media: .init(slug: "daily-kanji", title: "Daily Kanji"),
        lesson: .init(slug: "sample", title: "Sample"),
        segment: nil,
        front: "学",
        back: "study, learning",
        kanji: ["学"],
        entry: .init(
            audioSrc: nil,
            id: "sample-entry",
            kind: .term,
            label: "学",
            meaning: "study, learning",
            pitchAccent: nil,
            pitchAccentSource: nil,
            reading: "がく / まな.ぶ"
        ),
        exampleIt: nil,
        exampleJp: nil,
        notes: "Sample card shown until the personal dataset is exported.",
        srs: .init(
            difficulty: nil,
            dueAt: nil,
            lapses: 0,
            lastHardAgainAt: nil,
            lastInteractionAt: "1970-01-01T00:00:00.000Z",
            lastReviewedAt: nil,
            learningSteps: 0,
            priorityReasons: [],
            priorityScore: 0,
            recentHardAgainCount: 0,
            reps: 0,
            scheduledDays: 0,
            stability: nil,
            state: .review
        )
    )

    static let cards = [card]
}
