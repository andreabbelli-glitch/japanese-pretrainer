import WidgetKit
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
            now: Date(timeIntervalSince1970: 60 * 60),
            mode: .widgetTimeline
        )

        XCTAssertEqual(first?.cardId, "hard")
        XCTAssertEqual(second?.cardId, "stable")
    }

    func testWidgetSelectionPrefersPitchKnownCardsInsidePriorityWindow() throws {
        let cards = try Self.rankedCards(
            count: 3,
            pitchAccents: [nil, 1, nil]
        )

        let appSelected = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: Date(timeIntervalSince1970: 0),
            mode: .appOpen,
            widgetRotationWindow: 3
        )
        let widgetSelected = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: Date(timeIntervalSince1970: 0),
            mode: .widgetTimeline,
            widgetRotationWindow: 3
        )

        XCTAssertEqual(appSelected?.cardId, "card-0")
        XCTAssertNil(appSelected?.entry.pitchAccent)
        XCTAssertEqual(widgetSelected?.cardId, "card-1")
        XCTAssertEqual(widgetSelected?.entry.pitchAccent, 1)
    }

    func testWidgetSelectionFallsBackWhenNoCardsHaveKnownPitch() throws {
        let cards = try Self.rankedCards(count: 2)

        let widgetSelected = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: Date(timeIntervalSince1970: 0),
            mode: .widgetTimeline
        )

        XCTAssertEqual(widgetSelected?.cardId, "card-0")
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

    func testSelectionKeepsLowStabilityAheadOfHigherScoreStableCards() throws {
        let cards = try Self.lowStabilityRegressionCards()

        let rankedCards = DailyKanjiSelector.rank(cards)
        let selected = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: now,
            mode: .appOpen
        )

        XCTAssertEqual(rankedCards.map(\.cardId), ["low-stability", "stable-high-score"])
        XCTAssertEqual(selected?.cardId, "low-stability")
    }

    func testSelectionBreaksPriorityTiesByEarliestDueDate() throws {
        let cards = try Self.dueDateTieBreakerCards()

        let rankedCards = DailyKanjiSelector.rank(cards)
        let selected = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: now,
            mode: .appOpen
        )

        XCTAssertEqual(rankedCards.map(\.cardId), ["z-overdue", "a-future"])
        XCTAssertEqual(selected?.cardId, "z-overdue")
    }

    func testWidgetRefreshUsesNextRotationSlotBoundary() {
        let date = Date(timeIntervalSince1970: (60 * 60) + 123)

        XCTAssertEqual(
            DailyKanjiSelector.nextWidgetRefreshDate(after: date),
            Date(timeIntervalSince1970: 2 * 60 * 60)
        )
    }

    func testWidgetTimelineDatesPrebuildFutureRotationSlots() {
        let now = Date(timeIntervalSince1970: (60 * 60) + 123)

        XCTAssertEqual(
            DailyKanjiSelector.widgetTimelineDates(startingAt: now, count: 4),
            [
                now,
                Date(timeIntervalSince1970: 2 * 60 * 60),
                Date(timeIntervalSince1970: 3 * 60 * 60),
                Date(timeIntervalSince1970: 4 * 60 * 60)
            ]
        )
    }

    func testSupportedWidgetFamiliesKeepLockScreenOnRectangularLayout() {
        XCTAssertEqual(
            DailyKanjiWidgetFamilies.supported,
            [.systemSmall, .systemMedium, .accessoryRectangular]
        )
        XCTAssertFalse(DailyKanjiWidgetFamilies.supported.contains(.accessoryCircular))
        XCTAssertFalse(DailyKanjiWidgetFamilies.supported.contains(.accessoryInline))
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
            Date(timeIntervalSince1970: 71 * 60 * 60),
            Date(timeIntervalSince1970: 70 * 60 * 60)
        ])
    }

    func testRecentWidgetTimelineHistoryDefaultCoversThreeDaysOfHourlySlots() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let items = DailyKanjiSelector.recentWidgetTimelineItems(
            cards: cards,
            now: Date(timeIntervalSince1970: (72 * 60 * 60) + 60)
        )

        XCTAssertEqual(items.count, 72)
        XCTAssertEqual(items.first?.shownAt, Date(timeIntervalSince1970: 72 * 60 * 60))
        XCTAssertEqual(items.last?.shownAt, Date(timeIntervalSince1970: 60 * 60))
    }

    @MainActor
    func testFirstActivationRecordsInitialAppSelectionAndThreeDaysOfHourlyWidgetSlots() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let now = Date(timeIntervalSince1970: (72 * 60 * 60) + 60)
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            now: now
        )

        model.activate(now: now)

        XCTAssertEqual(model.recentHistory.count, 73)
        XCTAssertEqual(model.recentHistory.first?.source, .app)
        XCTAssertEqual(model.recentHistory.first?.shownAt, now)
        XCTAssertEqual(model.recentHistory.dropFirst().first?.source, .widget)
        XCTAssertEqual(model.recentHistory.dropFirst().first?.shownAt, Date(timeIntervalSince1970: 72 * 60 * 60))
        XCTAssertEqual(model.recentHistory.last?.shownAt, Date(timeIntervalSince1970: 60 * 60))
    }

    @MainActor
    func testColdWidgetDeepLinkDoesNotRecordInitialAppSelection() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let cards = try Self.rankedCards(count: 3)
        let launchTime = Date(timeIntervalSince1970: 72 * 60 * 60)
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            now: launchTime
        )

        XCTAssertEqual(model.selectedCard?.cardId, "card-1")

        model.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "card-2"),
            now: launchTime.addingTimeInterval(1)
        )

        let appHistoryItems = model.recentHistory.filter { $0.source == .app }
        XCTAssertEqual(appHistoryItems.map(\.cardId), ["card-2"])
    }

    @MainActor
    func testFirstActivationRecordsPreparedSelectionAcrossWidgetSlotBoundary() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let cards = try Self.rankedCards(count: 3)
        let launchTime = Date(timeIntervalSince1970: (72 * 60 * 60) - 1)
        let activationTime = Date(timeIntervalSince1970: (72 * 60 * 60) + 1)
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            now: launchTime
        )

        XCTAssertEqual(model.selectedCard?.cardId, "card-0")

        model.activate(now: activationTime)

        let appHistoryItems = model.recentHistory.filter { $0.source == .app }
        XCTAssertEqual(appHistoryItems.map(\.cardId), ["card-0"])
    }

    @MainActor
    func testColdWidgetDeepLinkAfterInitialActivationRemovesTransientInitialSelection() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let cards = try Self.rankedCards(count: 3)
        let launchTime = Date(timeIntervalSince1970: 72 * 60 * 60)
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            now: launchTime
        )

        model.activate(now: launchTime.addingTimeInterval(1))
        model.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "card-2"),
            now: launchTime.addingTimeInterval(2)
        )

        let appHistoryItems = model.recentHistory.filter { $0.source == .app }
        XCTAssertEqual(appHistoryItems.map(\.cardId), ["card-2"])
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

    func testPresentationHistoryFormatsRelativeShownTime() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)

        XCTAssertEqual(
            DailyKanjiPresentationHistoryItem(
                cardId: "just-now",
                shownAt: now.addingTimeInterval(-42),
                source: .app
            ).shownAtText(now: now),
            "Just now"
        )
        XCTAssertEqual(
            DailyKanjiPresentationHistoryItem(
                cardId: "minutes",
                shownAt: now.addingTimeInterval(-(12 * 60)),
                source: .app
            ).shownAtText(now: now),
            "12m ago"
        )
        XCTAssertEqual(
            DailyKanjiPresentationHistoryItem(
                cardId: "hours",
                shownAt: now.addingTimeInterval(-(3 * 60 * 60)),
                source: .widget
            ).shownAtText(now: now),
            "3h ago"
        )
        XCTAssertEqual(
            DailyKanjiPresentationHistoryItem(
                cardId: "days",
                shownAt: now.addingTimeInterval(-(2 * 24 * 60 * 60)),
                source: .widget
            ).shownAtText(now: now),
            "2d ago"
        )
    }

    func testPresentationHistoryFormatsMetadataText() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let item = DailyKanjiPresentationHistoryItem(
            cardId: "hard",
            shownAt: now.addingTimeInterval(-(12 * 60)),
            source: .widget
        )

        XCTAssertEqual(item.metadataText(now: now), "Widget slot - 12m ago")
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

        XCTAssertEqual(widgetSelectionHistory.map(\.cardId), ["card-0"])
        XCTAssertEqual(selected?.cardId, "card-1")
    }

    func testLockScreenExplanationTextKeepsFullRectangularContext() throws {
        let card = try Self.cardReplacingNotes(
            with: "This note is intentionally long and uses the full rectangular lock screen widget budget across the bottom line without being cut early."
        )

        XCTAssertEqual(
            card.lockScreenExplanationText,
            "This note is intentionally long and uses the full rectangular lock screen widget budget across the bottom line without being cut early."
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
            "This note is intentionally long and contains enough detail to overflow a lock screen widget but still fit a medium home widget."
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

    @MainActor
    func testSelectingRecentHistoryItemPreservesItsReviewContext() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            now: now
        )
        let widgetHistoryItem = DailyKanjiPresentationHistoryItem(
            cardId: "stable",
            shownAt: now.addingTimeInterval(-(6 * 60 * 60)),
            source: .widget
        )

        model.selectHistoryItem(widgetHistoryItem, now: now.addingTimeInterval(60))

        XCTAssertEqual(model.selectedCard?.cardId, "stable")
        XCTAssertEqual(model.selectedHistoryContext, widgetHistoryItem)
    }

    @MainActor
    func testDeepLinkSelectionSurvivesFollowUpActivation() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let store = DailyKanjiHistoryStore(defaults: defaults)
        let model = DailyKanjiAppModel(cards: cards, historyStore: store, now: now)

        model.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "stable"),
            now: now.addingTimeInterval(60)
        )
        model.activate(now: now.addingTimeInterval(61))

        XCTAssertEqual(model.selectedCard?.cardId, "stable")
    }

    @MainActor
    func testWidgetDeepLinkSelectionUsesWidgetSlotReviewContext() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            now: now
        )
        let deepLinkTime = Date(timeIntervalSince1970: (72 * 60 * 60) + (2 * 60 * 60) + 60)

        model.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "stable"),
            now: deepLinkTime
        )

        XCTAssertEqual(model.selectedCard?.cardId, "stable")
        XCTAssertEqual(
            model.selectedHistoryContext,
            DailyKanjiPresentationHistoryItem(
                cardId: "stable",
                shownAt: Date(timeIntervalSince1970: 74 * 60 * 60),
                source: .widget
            )
        )
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
            "pitchAccent": 0,
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

    private static func rankedCards(count: Int, pitchAccents: [Int?]? = nil) throws -> [DailyKanjiCard] {
        let base = try DailyKanjiDataset.decode(jsonData: datasetJSON).cards[0]

        return (0..<count).map { index in
            let pitchAccent: Int?
            if let pitchAccents, index < pitchAccents.count {
                pitchAccent = pitchAccents[index]
            } else {
                pitchAccent = nil
            }

            return DailyKanjiCard(
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
                    pitchAccent: pitchAccent,
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

    private static func lowStabilityRegressionCards() throws -> [DailyKanjiCard] {
        let base = try DailyKanjiDataset.decode(jsonData: datasetJSON).cards[0]

        return [
            DailyKanjiCard(
                cardId: "low-stability",
                subjectKey: "term:low-stability",
                media: base.media,
                lesson: base.lesson,
                segment: base.segment,
                front: "不安定",
                back: "unstable",
                kanji: ["不", "安", "定"],
                entry: DailyKanjiCard.Entry(
                    audioSrc: nil,
                    id: "entry-low-stability",
                    kind: .term,
                    label: "不安定",
                    meaning: "unstable",
                    pitchAccent: nil,
                    pitchAccentSource: nil,
                    reading: "ふあんてい"
                ),
                exampleIt: nil,
                exampleJp: nil,
                notes: nil,
                srs: DailyKanjiCard.SRS(
                    difficulty: 1,
                    dueAt: "2026-06-11T08:00:00.000Z",
                    lapses: 0,
                    lastHardAgainAt: nil,
                    lastInteractionAt: "2026-06-08T11:00:00.000Z",
                    lastReviewedAt: "2026-06-08T11:00:00.000Z",
                    learningSteps: 0,
                    priorityReasons: [.lowStability],
                    priorityScore: 100,
                    recentHardAgainCount: 0,
                    reps: 4,
                    scheduledDays: 1,
                    stability: 5,
                    state: .review
                )
            ),
            DailyKanjiCard(
                cardId: "stable-high-score",
                subjectKey: "term:stable-high-score",
                media: base.media,
                lesson: base.lesson,
                segment: base.segment,
                front: "高得点",
                back: "high score",
                kanji: ["高", "得", "点"],
                entry: DailyKanjiCard.Entry(
                    audioSrc: nil,
                    id: "entry-stable-high-score",
                    kind: .term,
                    label: "高得点",
                    meaning: "high score",
                    pitchAccent: nil,
                    pitchAccentSource: nil,
                    reading: "こうとくてん"
                ),
                exampleIt: nil,
                exampleJp: nil,
                notes: nil,
                srs: DailyKanjiCard.SRS(
                    difficulty: 10,
                    dueAt: "2026-06-10T08:00:00.000Z",
                    lapses: 10,
                    lastHardAgainAt: nil,
                    lastInteractionAt: "2026-06-08T11:00:00.000Z",
                    lastReviewedAt: "2026-06-08T11:00:00.000Z",
                    learningSteps: 0,
                    priorityReasons: [.highDifficulty, .lapses],
                    priorityScore: 1_000,
                    recentHardAgainCount: 0,
                    reps: 4,
                    scheduledDays: 3,
                    stability: 20,
                    state: .review
                )
            )
        ]
    }

    private static func dueDateTieBreakerCards() throws -> [DailyKanjiCard] {
        let base = try DailyKanjiDataset.decode(jsonData: datasetJSON).cards[0]

        return [
            DailyKanjiCard(
                cardId: "a-future",
                subjectKey: "term:a-future",
                media: base.media,
                lesson: base.lesson,
                segment: base.segment,
                front: "未来",
                back: "future",
                kanji: ["未", "来"],
                entry: DailyKanjiCard.Entry(
                    audioSrc: nil,
                    id: "entry-a-future",
                    kind: .term,
                    label: "未来",
                    meaning: "future",
                    pitchAccent: nil,
                    pitchAccentSource: nil,
                    reading: "みらい"
                ),
                exampleIt: nil,
                exampleJp: nil,
                notes: nil,
                srs: DailyKanjiCard.SRS(
                    difficulty: 7,
                    dueAt: "2026-06-11T08:00:00.000Z",
                    lapses: 0,
                    lastHardAgainAt: nil,
                    lastInteractionAt: "2026-06-08T11:00:00.000Z",
                    lastReviewedAt: "2026-06-08T11:00:00.000Z",
                    learningSteps: 0,
                    priorityReasons: [.highDifficulty],
                    priorityScore: 9000,
                    recentHardAgainCount: 0,
                    reps: 4,
                    scheduledDays: 2,
                    stability: 3,
                    state: .review
                )
            ),
            DailyKanjiCard(
                cardId: "z-overdue",
                subjectKey: "term:z-overdue",
                media: base.media,
                lesson: base.lesson,
                segment: base.segment,
                front: "期限",
                back: "deadline",
                kanji: ["期", "限"],
                entry: DailyKanjiCard.Entry(
                    audioSrc: nil,
                    id: "entry-z-overdue",
                    kind: .term,
                    label: "期限",
                    meaning: "deadline",
                    pitchAccent: nil,
                    pitchAccentSource: nil,
                    reading: "きげん"
                ),
                exampleIt: nil,
                exampleJp: nil,
                notes: nil,
                srs: DailyKanjiCard.SRS(
                    difficulty: 7,
                    dueAt: "2026-06-10T08:00:00.000Z",
                    lapses: 0,
                    lastHardAgainAt: nil,
                    lastInteractionAt: "2026-06-08T11:00:00.000Z",
                    lastReviewedAt: "2026-06-08T11:00:00.000Z",
                    learningSteps: 0,
                    priorityReasons: [.highDifficulty],
                    priorityScore: 9000,
                    recentHardAgainCount: 0,
                    reps: 4,
                    scheduledDays: 2,
                    stability: 3,
                    state: .review
                )
            )
        ]
    }
}
