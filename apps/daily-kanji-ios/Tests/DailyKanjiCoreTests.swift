import XCTest
@testable import DailyKanji

final class DailyKanjiCoreTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    func testDecodesExporterDatasetShape() throws {
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON)

        XCTAssertEqual(dataset.version, 1)
        XCTAssertEqual(dataset.cards.map(\.cardId), ["hard", "stable"])
        XCTAssertEqual(dataset.cards[0].entry.pitchAccent, 2)
        XCTAssertEqual(dataset.cards[0].srs.priorityReasons, [.recentHardAgain, .relearning])
    }

    func testAppSelectionAvoidsCardsSeenInTheLastThreeDays() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let history = [
            DailyKanjiHistoryItem(cardId: "hard", shownAt: now.addingTimeInterval(-60 * 60)),
        ]

        let selected = DailyKanjiSelector.select(
            cards: cards,
            history: history,
            now: now,
            mode: .appOpen
        )

        XCTAssertEqual(selected?.cardId, "stable")
    }

    func testWidgetSelectionRotatesInsideTopPriorityWindowWithoutHistory() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards

        let first = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: Date(timeIntervalSince1970: 0),
            mode: .widgetTimeline
        )
        let second = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: Date(timeIntervalSince1970: 6 * 60 * 60),
            mode: .widgetTimeline
        )

        XCTAssertEqual(first?.cardId, "hard")
        XCTAssertEqual(second?.cardId, "stable")
    }

    func testSelectionKeepsRecentHardAgainAheadOfHigherScoreNonRecentCards() throws {
        let cards = try Self.recentBucketRegressionCards()

        let rankedCards = DailyKanjiSelector.rank(cards)
        let selected = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: now,
            mode: .appOpen
        )

        XCTAssertEqual(rankedCards.map(\.cardId), ["recent-only", "intense-nonrecent"])
        XCTAssertEqual(selected?.cardId, "recent-only")
    }

    func testWidgetRefreshUsesNextRotationSlotBoundary() {
        let date = Date(timeIntervalSince1970: (6 * 60 * 60) + 123)

        XCTAssertEqual(
            DailyKanjiSelector.nextWidgetRefreshDate(after: date),
            Date(timeIntervalSince1970: 12 * 60 * 60)
        )
    }

    func testWidgetTimelineDatesPrebuildFutureRotationSlots() {
        let now = Date(timeIntervalSince1970: (6 * 60 * 60) + 123)

        XCTAssertEqual(
            DailyKanjiSelector.widgetTimelineDates(startingAt: now, count: 4),
            [
                now,
                Date(timeIntervalSince1970: 12 * 60 * 60),
                Date(timeIntervalSince1970: 18 * 60 * 60),
                Date(timeIntervalSince1970: 24 * 60 * 60)
            ]
        )
    }

    func testRecentWidgetTimelineHistoryPreservesNewestSlots() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let items = DailyKanjiSelector.recentWidgetTimelineItems(
            cards: cards,
            now: Date(timeIntervalSince1970: (72 * 60 * 60) + 60),
            days: 1,
            maxItems: 3
        )

        XCTAssertEqual(items.map(\.cardId), ["hard", "stable", "hard"])
        XCTAssertEqual(items.map(\.source), [.widget, .widget, .widget])
        XCTAssertEqual(items.map(\.shownAt), [
            Date(timeIntervalSince1970: 72 * 60 * 60),
            Date(timeIntervalSince1970: 66 * 60 * 60),
            Date(timeIntervalSince1970: 60 * 60 * 60)
        ])
    }

    func testPresentationHistoryMergesAppAndWidgetExposureEventsNewestFirst() {
        let appItems = [
            DailyKanjiHistoryItem(
                cardId: "stable",
                shownAt: Date(timeIntervalSince1970: (12 * 60 * 60) + 120)
            )
        ]
        let widgetItems = [
            DailyKanjiPresentationHistoryItem(
                cardId: "hard",
                shownAt: Date(timeIntervalSince1970: 12 * 60 * 60),
                source: .widget
            ),
            DailyKanjiPresentationHistoryItem(
                cardId: "stable",
                shownAt: Date(timeIntervalSince1970: 6 * 60 * 60),
                source: .widget
            )
        ]

        let merged = DailyKanjiPresentationHistory.merge(
            appItems: appItems,
            widgetItems: widgetItems
        )

        XCTAssertEqual(merged.map(\.cardId), ["stable", "hard", "stable"])
        XCTAssertEqual(merged.map(\.source), [.app, .widget, .widget])
    }

    func testAppSelectionUsesOnlyTheCurrentWidgetSlotAsRecentWidgetHistory() throws {
        let cards = try Self.rankedCards(count: 9)
        let now = Date(timeIntervalSince1970: (72 * 60 * 60) + 60)

        let widgetSelectionHistory = DailyKanjiSelector.recentWidgetSelectionItems(
            cards: cards,
            now: now
        )
        let selected = DailyKanjiSelector.select(
            cards: cards,
            history: widgetSelectionHistory,
            now: now,
            mode: .appOpen
        )

        XCTAssertEqual(widgetSelectionHistory.map(\.cardId), ["card-4"])
        XCTAssertEqual(selected?.cardId, "card-0")
    }

    func testLockScreenExplanationTextCondensesLongNotes() throws {
        let card = try Self.cardReplacingNotes(
            with: "This note is intentionally long and contains enough detail to overflow a lock screen widget."
        )

        XCTAssertEqual(
            card.lockScreenExplanationText,
            "This note is intentionally long and contains enough detail..."
        )
    }

    func testLockScreenMetadataUsesCompactReadingAndPitchAccent() throws {
        let card = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards[0]

        XCTAssertEqual(card.lockScreenPitchAccentText, "P2")
        XCTAssertEqual(card.lockScreenMetadataText, "かんてん - P2")
    }

    func testHomeWidgetExplanationTextAllowsMoreContextThanLockScreen() throws {
        let card = try Self.cardReplacingNotes(
            with: "This note is intentionally long and contains enough detail to overflow a lock screen widget but still fit a medium home widget."
        )

        XCTAssertEqual(
            card.homeWidgetExplanationText,
            "This note is intentionally long and contains enough detail to overflow a lock screen widget..."
        )
    }

    func testDetailExampleLinesKeepItalianExampleWhenJapaneseExampleIsMissing() throws {
        let card = try Self.cardReplacingExamples(exampleJp: nil, exampleIt: "Solo esempio italiano.")

        XCTAssertEqual(card.detailExampleLines, ["Solo esempio italiano."])
    }

    func testPriorityTextLabelsHighDifficultySignal() throws {
        let card = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards[1]

        XCTAssertEqual(card.priorityText, "High difficulty")
    }

    @MainActor
    func testSelectingRecentHistoryItemPromotesCardForReview() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let store = DailyKanjiHistoryStore(defaults: defaults)
        store.record(cardId: "stable", shownAt: now.addingTimeInterval(-60 * 60))
        let model = DailyKanjiAppModel(cards: cards, historyStore: store, now: now)

        guard let historyItem = model.recentHistory.first(where: { $0.cardId == "stable" }) else {
            return XCTFail("Expected stable card in recent history")
        }

        model.selectHistoryItem(historyItem, now: now.addingTimeInterval(60))

        XCTAssertEqual(model.selectedCard?.cardId, "stable")
        XCTAssertEqual(model.recentHistory.first?.cardId, "stable")
        XCTAssertEqual(model.recentHistory.first?.source, .app)
    }

    func testHistoryStoreRecordsNewestFirstAndPrunesOldEntries() {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let store = DailyKanjiHistoryStore(defaults: defaults)
        store.record(cardId: "old", shownAt: now.addingTimeInterval(-4 * 24 * 60 * 60))
        store.record(cardId: "newer", shownAt: now.addingTimeInterval(-2 * 60))
        store.record(cardId: "newest", shownAt: now)

        XCTAssertEqual(store.recentItems(now: now, days: 3).map(\.cardId), ["newest", "newer"])
    }

    func testHistoryStorePreservesRepeatedAppExposureEventsNewestFirst() {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let store = DailyKanjiHistoryStore(defaults: defaults)
        let firstExposure = now.addingTimeInterval(-2 * 60)
        let secondExposure = now.addingTimeInterval(-60)
        store.record(cardId: "hard", shownAt: firstExposure)
        store.record(cardId: "hard", shownAt: secondExposure)

        let recentItems = store.recentItems(now: now, days: 3)

        XCTAssertEqual(recentItems.map(\.cardId), ["hard", "hard"])
        XCTAssertEqual(recentItems.map(\.shownAt), [secondExposure, firstExposure])
    }

    func testHistoryStoreGivesRepeatedSameSecondExposureEventsUniquePresentationIds() {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let store = DailyKanjiHistoryStore(defaults: defaults)
        let exposureTime = now.addingTimeInterval(-60)
        store.record(cardId: "hard", shownAt: exposureTime)
        store.record(cardId: "hard", shownAt: exposureTime)

        let recentItems = store.recentItems(now: now, days: 3)
        let presentationItems = DailyKanjiPresentationHistory.merge(
            appItems: recentItems,
            widgetItems: []
        )

        XCTAssertEqual(recentItems.count, 2)
        XCTAssertEqual(Set(recentItems.map(\.id)).count, 2)
        XCTAssertEqual(presentationItems.count, 2)
        XCTAssertEqual(Set(presentationItems.map(\.id)).count, 2)
    }

    func testDeepLinkRoundTripEncodesCardId() throws {
        let cardId = "card/with space"

        let url = DailyKanjiDeepLink.cardURL(cardId: cardId)

        XCTAssertEqual(DailyKanjiDeepLink.cardId(from: url), cardId)
    }

    func testAudioBundlePathPreservesMediaSlugAndRelativeAudioSource() throws {
        let card = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards[0]

        XCTAssertEqual(
            DailyKanjiAudioResource.bundleRelativePath(for: card),
            "daily-kanji-audio__media-one__assets_audio_term_hard__7d32ed581a549660.mp3"
        )
    }

    func testAudioBundlePathRejectsNonAudioResourceSources() throws {
        XCTAssertNil(
            DailyKanjiAudioResource.bundleRelativePath(
                for: try Self.cardReplacingAudioSrc(with: "workflow/notes.mp3")
            )
        )
        XCTAssertNil(
            DailyKanjiAudioResource.bundleRelativePath(
                for: try Self.cardReplacingAudioSrc(with: "assets/audio/term/not-audio.txt")
            )
        )
        XCTAssertNil(
            DailyKanjiAudioResource.bundleRelativePath(
                for: try Self.cardReplacingAudioSrc(with: "assets/audio/term/settings.ogg")
            )
        )
    }

    private static let datasetJSON = """
    {
      "version": 1,
      "generatedAt": "2026-06-10T12:00:00.000Z",
      "recentMistakeLookbackDays": 3,
      "cards": [
        {
          "cardId": "hard",
          "subjectKey": "term:hard",
          "media": { "slug": "media-one", "title": "Media One" },
          "lesson": { "slug": "lesson-one", "title": "Lesson One" },
          "segment": { "title": "Segment One" },
          "front": "観点",
          "back": "point of view",
          "kanji": ["観", "点"],
          "entry": {
            "audioSrc": "assets/audio/term/hard.mp3",
            "id": "entry-hard",
            "kind": "term",
            "label": "観点",
            "meaning": "point of view",
            "pitchAccent": 2,
            "pitchAccentSource": "manual",
            "reading": "かんてん"
          },
          "exampleJp": "観点を変える。",
          "exampleIt": "Cambiare punto di vista.",
          "notes": "Plain note",
          "srs": {
            "difficulty": 8.2,
            "dueAt": "2026-06-10T10:00:00.000Z",
            "lapses": 2,
            "lastHardAgainAt": "2026-06-10T09:00:00.000Z",
            "lastInteractionAt": "2026-06-10T09:00:00.000Z",
            "lastReviewedAt": "2026-06-10T09:00:00.000Z",
            "learningSteps": 1,
            "priorityReasons": ["recent-hard-again", "relearning"],
            "priorityScore": 180,
            "recentHardAgainCount": 2,
            "reps": 6,
            "scheduledDays": 1,
            "stability": 0.9,
            "state": "relearning"
          }
        },
        {
          "cardId": "stable",
          "subjectKey": "term:stable",
          "media": { "slug": "media-one", "title": "Media One" },
          "lesson": { "slug": "lesson-two", "title": "Lesson Two" },
          "front": "安定",
          "back": "stable",
          "kanji": ["安", "定"],
          "entry": {
            "id": "entry-stable",
            "kind": "term",
            "label": "安定",
            "meaning": "stable",
            "reading": "あんてい"
          },
          "srs": {
            "difficulty": 9.0,
            "dueAt": null,
            "lapses": 0,
            "lastHardAgainAt": null,
            "lastInteractionAt": "2026-06-09T09:00:00.000Z",
            "lastReviewedAt": "2026-06-09T09:00:00.000Z",
            "learningSteps": 0,
            "priorityReasons": ["high-difficulty"],
            "priorityScore": 90,
            "recentHardAgainCount": 0,
            "reps": 10,
            "scheduledDays": 5,
            "stability": 4.2,
            "state": "review"
          }
        }
      ]
    }
    """.data(using: .utf8)!

    private static func cardReplacingAudioSrc(with audioSrc: String) throws -> DailyKanjiCard {
        let json = String(data: datasetJSON, encoding: .utf8)!
            .replacingOccurrences(
                of: "\"assets/audio/term/hard.mp3\"",
                with: "\"\(audioSrc)\""
            )
            .data(using: .utf8)!

        return try DailyKanjiDataset.decode(jsonData: json).cards[0]
    }

    private static func cardReplacingNotes(with notes: String) throws -> DailyKanjiCard {
        let json = String(data: datasetJSON, encoding: .utf8)!
            .replacingOccurrences(
                of: "\"Plain note\"",
                with: "\"\(notes)\""
            )
            .data(using: .utf8)!

        return try DailyKanjiDataset.decode(jsonData: json).cards[0]
    }

    private static func cardReplacingExamples(
        exampleJp: String?,
        exampleIt: String?
    ) throws -> DailyKanjiCard {
        let json = String(data: datasetJSON, encoding: .utf8)!
            .replacingOccurrences(
                of: "\"exampleJp\": \"観点を変える。\"",
                with: exampleJp.map { "\"exampleJp\": \"\($0)\"" } ?? "\"exampleJp\": null"
            )
            .replacingOccurrences(
                of: "\"exampleIt\": \"Cambiare punto di vista.\"",
                with: exampleIt.map { "\"exampleIt\": \"\($0)\"" } ?? "\"exampleIt\": null"
            )
            .data(using: .utf8)!

        return try DailyKanjiDataset.decode(jsonData: json).cards[0]
    }

    private static func rankedCards(count: Int) throws -> [DailyKanjiCard] {
        let base = try DailyKanjiDataset.decode(jsonData: datasetJSON).cards[0]

        return (0..<count).map { index in
            DailyKanjiCard(
                cardId: "card-\(index)",
                subjectKey: "term:card-\(index)",
                media: base.media,
                lesson: base.lesson,
                segment: base.segment,
                front: "Card \(index)",
                back: "Meaning \(index)",
                kanji: ["Card \(index)"],
                entry: DailyKanjiCard.Entry(
                    audioSrc: nil,
                    id: "entry-\(index)",
                    kind: .term,
                    label: "Card \(index)",
                    meaning: "Meaning \(index)",
                    pitchAccent: nil,
                    pitchAccentSource: nil,
                    reading: "reading \(index)"
                ),
                exampleIt: nil,
                exampleJp: nil,
                notes: nil,
                srs: DailyKanjiCard.SRS(
                    difficulty: 8,
                    dueAt: nil,
                    lapses: 0,
                    lastHardAgainAt: nil,
                    lastInteractionAt: "2026-06-10T09:00:00.000Z",
                    lastReviewedAt: nil,
                    learningSteps: 0,
                    priorityReasons: [.lowStability],
                    priorityScore: Double(100 - index),
                    recentHardAgainCount: 0,
                    reps: 0,
                    scheduledDays: 1,
                    stability: 1,
                    state: .review
                )
            )
        }
    }

    private static func recentBucketRegressionCards() throws -> [DailyKanjiCard] {
        let base = try DailyKanjiDataset.decode(jsonData: datasetJSON).cards[0]

        return [
            DailyKanjiCard(
                cardId: "recent-only",
                subjectKey: "term:recent-only",
                media: base.media,
                lesson: base.lesson,
                segment: base.segment,
                front: "直近",
                back: "recent",
                kanji: ["直", "近"],
                entry: DailyKanjiCard.Entry(
                    audioSrc: nil,
                    id: "entry-recent-only",
                    kind: .term,
                    label: "直近",
                    meaning: "recent",
                    pitchAccent: nil,
                    pitchAccentSource: nil,
                    reading: "ちょっきん"
                ),
                exampleIt: nil,
                exampleJp: nil,
                notes: nil,
                srs: DailyKanjiCard.SRS(
                    difficulty: 0,
                    dueAt: "2026-06-11T08:00:00.000Z",
                    lapses: 0,
                    lastHardAgainAt: "2026-06-09T11:00:00.000Z",
                    lastInteractionAt: "2026-06-09T11:00:00.000Z",
                    lastReviewedAt: "2026-06-09T11:00:00.000Z",
                    learningSteps: 0,
                    priorityReasons: [.recentHardAgain],
                    priorityScore: 10500,
                    recentHardAgainCount: 1,
                    reps: 4,
                    scheduledDays: 3,
                    stability: 20,
                    state: .review
                )
            ),
            DailyKanjiCard(
                cardId: "intense-nonrecent",
                subjectKey: "term:intense-nonrecent",
                media: base.media,
                lesson: base.lesson,
                segment: base.segment,
                front: "難解",
                back: "very difficult",
                kanji: ["難", "解"],
                entry: DailyKanjiCard.Entry(
                    audioSrc: nil,
                    id: "entry-intense-nonrecent",
                    kind: .term,
                    label: "難解",
                    meaning: "very difficult",
                    pitchAccent: nil,
                    pitchAccentSource: nil,
                    reading: "なんかい"
                ),
                exampleIt: nil,
                exampleJp: nil,
                notes: nil,
                srs: DailyKanjiCard.SRS(
                    difficulty: 10,
                    dueAt: "2026-06-10T08:00:00.000Z",
                    lapses: 1,
                    lastHardAgainAt: nil,
                    lastInteractionAt: "2026-06-08T11:00:00.000Z",
                    lastReviewedAt: "2026-06-08T11:00:00.000Z",
                    learningSteps: 0,
                    priorityReasons: [.relearning, .lowStability, .highDifficulty, .lapses],
                    priorityScore: 10700,
                    recentHardAgainCount: 0,
                    reps: 4,
                    scheduledDays: 0,
                    stability: 0,
                    state: .relearning
                )
            )
        ]
    }
}
