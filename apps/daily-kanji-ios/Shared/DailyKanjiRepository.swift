import Foundation

enum DailyKanjiDatasetSource: Equatable, Sendable {
    case cache(metadata: DailyKanjiCachedDatasetMetadata?)
    case bundle
    case sample
}

struct DailyKanjiRepositorySnapshot: Sendable {
    let dataset: DailyKanjiDataset?
    let source: DailyKanjiDatasetSource
    let requiresStudyModeAwareSync: Bool

    var cards: [DailyKanjiCard] {
        dataset?.cards ?? DailyKanjiSampleData.cards
    }

    var glossaryEntries: [DailyKanjiGlossaryEntry] {
        dataset?.glossary?.entries ?? []
    }

    var cacheMetadata: DailyKanjiCachedDatasetMetadata? {
        guard case .cache(let metadata) = source else {
            return nil
        }

        return metadata
    }
}

struct DailyKanjiRepository: Sendable {
    private let bundle: Bundle
    private let cacheStore: DailyKanjiCacheStore
    private let decodeDataset: DailyKanjiDatasetDecoder

    init(
        bundle: Bundle = .main,
        cacheStore: DailyKanjiCacheStore = DailyKanjiCacheStore(),
        decodeDataset: @escaping DailyKanjiDatasetDecoder = {
            try DailyKanjiDataset.decode(jsonData: $0)
        }
    ) {
        self.bundle = bundle
        self.cacheStore = cacheStore
        self.decodeDataset = decodeDataset
    }

    func loadCards() -> [DailyKanjiCard] {
        loadSnapshot().cards
    }

    func loadSnapshot(now: Date = .now) -> DailyKanjiRepositorySnapshot {
        let cachedSnapshot = cacheStore.loadSnapshot(
            now: now,
            decodeDataset: decodeDataset
        )
        let cachedDataset = cachedSnapshot.flatMap { snapshot in
            snapshot.dataset.cards.isEmpty ? nil : snapshot.dataset
        }

        if let cachedDataset, cachedDataset.supportsMediaStudyModes {
            return DailyKanjiRepositorySnapshot(
                dataset: cachedDataset,
                source: .cache(metadata: cachedSnapshot?.metadata),
                requiresStudyModeAwareSync: true
            )
        }

        let bundledDataset = loadBundledDataset()
        let bundleRequiresStudyModes = bundledDataset?.supportsMediaStudyModes == true

        if let cachedDataset, !bundleRequiresStudyModes {
            return DailyKanjiRepositorySnapshot(
                dataset: cachedDataset,
                source: .cache(metadata: cachedSnapshot?.metadata),
                requiresStudyModeAwareSync: false
            )
        }

        if let bundledDataset {
            return DailyKanjiRepositorySnapshot(
                dataset: bundledDataset,
                source: .bundle,
                requiresStudyModeAwareSync: bundleRequiresStudyModes
            )
        }

        if let cachedDataset {
            return DailyKanjiRepositorySnapshot(
                dataset: cachedDataset,
                source: .cache(metadata: cachedSnapshot?.metadata),
                requiresStudyModeAwareSync: cachedDataset.supportsMediaStudyModes
            )
        }

        return DailyKanjiRepositorySnapshot(
            dataset: nil,
            source: .sample,
            requiresStudyModeAwareSync: false
        )
    }

    func loadSnapshotAsync(now: Date = .now) async -> DailyKanjiRepositorySnapshot {
        await Task.detached(priority: .userInitiated) {
            loadSnapshot(now: now)
        }.value
    }

    func makeCacheWriter() -> DailyKanjiCacheWriter {
        cacheStore.makeWriter()
    }

    private func loadBundledDataset() -> DailyKanjiDataset? {
        guard
            let url = bundle.url(forResource: "daily-kanji-cards", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let dataset = try? decodeDataset(data),
            dataset.version == DailyKanjiDataset.supportedVersion,
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
