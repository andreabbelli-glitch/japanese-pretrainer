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

    func testDeepLinkRoundTripEncodesCardId() throws {
        let cardId = "card/with space"

        let url = DailyKanjiDeepLink.cardURL(cardId: cardId)

        XCTAssertEqual(DailyKanjiDeepLink.cardId(from: url), cardId)
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
            "audioSrc": "media-audio/media-one/hard.mp3",
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
            "difficulty": 4.0,
            "dueAt": null,
            "lapses": 0,
            "lastHardAgainAt": null,
            "lastInteractionAt": "2026-06-09T09:00:00.000Z",
            "lastReviewedAt": "2026-06-09T09:00:00.000Z",
            "learningSteps": 0,
            "priorityReasons": ["low-stability"],
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
}
