import Foundation

enum DailyKanjiDatasetSource: Equatable {
    case cache(metadata: DailyKanjiCachedDatasetMetadata?)
    case bundle
    case sample
}

struct DailyKanjiRepository {
    private let bundle: Bundle
    private let cacheStore: DailyKanjiCacheStore

    init(
        bundle: Bundle = .main,
        cacheStore: DailyKanjiCacheStore = DailyKanjiCacheStore()
    ) {
        self.bundle = bundle
        self.cacheStore = cacheStore
    }

    func loadCards() -> [DailyKanjiCard] {
        let bundledDataset = loadBundledDataset()
        if let dataset = loadCachedDataset(
            requiresStudyModes: bundledDataset?.supportsMediaStudyModes == true
        ) {
            return dataset.cards
        }

        if let dataset = bundledDataset {
            return dataset.cards
        }

        return DailyKanjiSampleData.cards
    }

    func loadDatasetSource() -> DailyKanjiDatasetSource {
        let bundledDataset = loadBundledDataset()
        if loadCachedDataset(
            requiresStudyModes: bundledDataset?.supportsMediaStudyModes == true
        ) != nil {
            return .cache(metadata: cacheStore.loadMetadata())
        }

        if bundledDataset != nil {
            return .bundle
        }

        return .sample
    }

    func requiresStudyModeAwareSync() -> Bool {
        loadBundledDataset()?.supportsMediaStudyModes == true
    }

    private func loadCachedDataset(requiresStudyModes: Bool = false) -> DailyKanjiDataset? {
        guard
            let dataset = cacheStore.loadDataset(),
            !dataset.cards.isEmpty
        else {
            return nil
        }

        if requiresStudyModes && !dataset.supportsMediaStudyModes {
            return nil
        }

        return dataset
    }

    private func loadBundledDataset() -> DailyKanjiDataset? {
        guard
            let url = bundle.url(forResource: "daily-kanji-cards", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let dataset = try? DailyKanjiDataset.decode(jsonData: data),
            !dataset.cards.isEmpty
        else {
            return nil
        }

        return dataset
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
