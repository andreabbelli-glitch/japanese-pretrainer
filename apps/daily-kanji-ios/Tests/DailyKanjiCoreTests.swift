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

    func testDecodesGlossarySnapshotAndSearchesLocally() throws {
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.glossaryDatasetJSON)
        let glossary = try XCTUnwrap(dataset.glossary)

        XCTAssertEqual(glossary.version, 1)
        XCTAssertEqual(glossary.entryCount, 2)
        XCTAssertEqual(glossary.entries.map(\.label), ["行く", "〜ている"])
        XCTAssertEqual(glossary.entries[0].aliases.map(\.text), ["いきます", "iku"])
        XCTAssertEqual(glossary.entries[0].media.map(\.mediaTitle), ["Fixture TCG"])
        XCTAssertEqual(
            glossary.entries[0].media[0].audioSrc,
            "assets/audio/term/term-fixture-iku/iku.mp3"
        )

        XCTAssertEqual(
            DailyKanjiGlossaryIndex(entries: glossary.entries).search(query: "iku").map(\.id),
            ["term:term_fixture_iku"]
        )
        XCTAssertEqual(
            DailyKanjiGlossaryIndex(entries: glossary.entries).search(query: "stato").map(\.id),
            ["grammar:grammar_fixture_teiru"]
        )
        XCTAssertEqual(
            DailyKanjiGlossaryIndex(entries: glossary.entries).search(query: "   ").map(\.id),
            ["term:term_fixture_iku", "grammar:grammar_fixture_teiru"]
        )
    }

    func testGlossaryIndexFoldsCaseDiacriticsAndWidthAcrossTokens() throws {
        let glossary = try XCTUnwrap(
            DailyKanjiDataset.decode(jsonData: Self.glossaryDatasetJSON).glossary
        )
        let index = DailyKanjiGlossaryIndex(entries: glossary.entries)

        XCTAssertEqual(index.search(query: "ＩＫＵ").map(\.id), ["term:term_fixture_iku"])
        XCTAssertEqual(
            index.search(query: "AZIÓNE stato").map(\.id),
            ["grammar:grammar_fixture_teiru"]
        )
    }

    @MainActor
    func testGlossarySearchPublishesOnlyTheLatestDebouncedQuery() async throws {
        let glossary = try XCTUnwrap(
            DailyKanjiDataset.decode(jsonData: Self.glossaryDatasetJSON).glossary
        )
        let sleeper = ControllableGlossaryDebounceSleeper()
        let model = DailyKanjiGlossarySearchModel(
            entries: glossary.entries,
            debounceSleep: { try await sleeper.sleep() }
        )

        model.updateQuery("iku")
        await sleeper.waitForPendingCount(1)
        model.updateQuery("stato")
        await sleeper.waitForPendingCount(2)

        await sleeper.resumeNext()
        await Task.yield()
        XCTAssertEqual(model.results.map(\.id), glossary.entries.map(\.id))

        await sleeper.resumeNext()
        await model.waitForPendingSearch()
        XCTAssertEqual(model.results.map(\.id), ["grammar:grammar_fixture_teiru"])
    }

    @MainActor
    func testGlossaryDatasetReplacementInvalidatesAnOlderPendingQuery() async throws {
        let glossary = try XCTUnwrap(
            DailyKanjiDataset.decode(jsonData: Self.glossaryDatasetJSON).glossary
        )
        let sleeper = ControllableGlossaryDebounceSleeper()
        let model = DailyKanjiGlossarySearchModel(
            entries: glossary.entries,
            debounceSleep: { try await sleeper.sleep() }
        )

        model.updateQuery("iku")
        await sleeper.waitForPendingCount(1)
        model.replaceEntries([glossary.entries[1]])
        XCTAssertTrue(model.results.isEmpty)

        await sleeper.resumeNext()
        await Task.yield()
        XCTAssertTrue(model.results.isEmpty)
    }

    @MainActor
    func testBlankGlossaryQueryCancelsPendingWorkAndRestoresAllEntries() async throws {
        let glossary = try XCTUnwrap(
            DailyKanjiDataset.decode(jsonData: Self.glossaryDatasetJSON).glossary
        )
        let sleeper = ControllableGlossaryDebounceSleeper()
        let model = DailyKanjiGlossarySearchModel(
            entries: glossary.entries,
            debounceSleep: { try await sleeper.sleep() }
        )

        model.updateQuery("iku")
        await sleeper.waitForPendingCount(1)
        model.updateQuery("   ")
        XCTAssertEqual(model.results.map(\.id), glossary.entries.map(\.id))

        await sleeper.resumeNext()
        await Task.yield()
        XCTAssertEqual(model.results.map(\.id), glossary.entries.map(\.id))
    }

    func testAudioBundlePathSupportsGlossaryMediaReferences() throws {
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.glossaryDatasetJSON)
        let glossary = try XCTUnwrap(dataset.glossary)
        let media = glossary.entries[0].media[0]
        let audioSrc = try XCTUnwrap(media.audioSrc)
        let relativePath = try XCTUnwrap(
            DailyKanjiAudioResource.bundleRelativePath(
                mediaSlug: media.mediaSlug,
                audioSrc: audioSrc
            )
        )

        XCTAssertTrue(
            relativePath.hasPrefix(
                "daily-kanji-audio__fixture-tcg__assets_audio_term_term-fixture-iku_iku__"
            )
        )
        XCTAssertTrue(relativePath.hasSuffix(".mp3"))
    }

    func testRepositoryPrefersSyncedCacheOverBundle() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let bundle = try Self.makeBundle(
            containing: try DailyKanjiDataset.decode(jsonData: Self.datasetJSON),
            in: temporaryDirectory
        )
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let cachedDataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T08:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        _ = try await cacheStore.makeWriter().write(
            dataset: cachedDataset,
            cachedAt: now
        )

        let repository = DailyKanjiRepository(bundle: bundle, cacheStore: cacheStore)
        let snapshot = repository.loadSnapshot(now: now)

        XCTAssertEqual(snapshot.cards.map(\.cardId), ["card-0"])
    }

    func testRepositoryReportsSyncedDatasetSourceMetadata() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let bundle = try Self.makeBundle(
            containing: try DailyKanjiDataset.decode(jsonData: Self.datasetJSON),
            in: temporaryDirectory
        )
        let cacheStore = DailyKanjiCacheStore(directoryURL: temporaryDirectory)
        let cachedAt = Date(timeIntervalSince1970: 1_800_000_000)
        let dataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T08:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        _ = try await cacheStore.makeWriter().write(
            dataset: dataset,
            cachedAt: cachedAt
        )

        let repository = DailyKanjiRepository(bundle: bundle, cacheStore: cacheStore)
        let snapshot = repository.loadSnapshot(now: cachedAt)

        XCTAssertEqual(
            snapshot.source,
            .cache(
                metadata: DailyKanjiCachedDatasetMetadata(
                    cachedAt: cachedAt,
                    generatedAt: "2026-06-11T08:00:00.000Z",
                    cardCount: 1
                )
            )
        )
    }

    func testRepositoryFallsBackToBundleWhenCacheIsInvalid() throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let bundle = try Self.makeBundle(
            containing: try DailyKanjiDataset.decode(jsonData: Self.datasetJSON),
            in: temporaryDirectory
        )
        let cacheDirectory = temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        try FileManager.default.createDirectory(
            at: cacheDirectory,
            withIntermediateDirectories: true
        )
        try Data("not-json".utf8).write(
            to: cacheDirectory.appendingPathComponent(DailyKanjiCacheStore.datasetFileName)
        )
        try Self.writeCacheMetadata(
            DailyKanjiCachedDatasetMetadata(
                cachedAt: now,
                generatedAt: "2026-06-11T08:00:00.000Z",
                cardCount: 1
            ),
            to: cacheDirectory
        )

        let repository = DailyKanjiRepository(
            bundle: bundle,
            cacheStore: DailyKanjiCacheStore(directoryURL: cacheDirectory)
        )
        let snapshot = repository.loadSnapshot(now: now)

        XCTAssertEqual(snapshot.cards.map(\.cardId), ["hard", "stable"])
        XCTAssertEqual(snapshot.source, .bundle)
        XCTAssertNil(snapshot.cacheMetadata)
    }

    func testRepositoryFallsBackToBundleForUnsupportedCacheVersion() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let bundledDataset = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON)
        let bundle = try Self.makeBundle(
            containing: bundledDataset,
            in: temporaryDirectory
        )
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let unsupportedDataset = DailyKanjiDataset(
            version: DailyKanjiDataset.supportedVersion + 1,
            generatedAt: "2026-06-11T09:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        _ = try await cacheStore.makeWriter().write(
            dataset: unsupportedDataset,
            cachedAt: now
        )

        let snapshot = DailyKanjiRepository(
            bundle: bundle,
            cacheStore: cacheStore
        ).loadSnapshot(now: now)

        XCTAssertEqual(snapshot.cards.map(\.cardId), bundledDataset.cards.map(\.cardId))
        XCTAssertEqual(snapshot.source, .bundle)
    }

    func testInterruptedCachePairUsesDatasetWithNilMetadataAndForcesSync() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let cacheStore = DailyKanjiCacheStore(directoryURL: temporaryDirectory)
        let previousDataset = DailyKanjiDataset(
            version: DailyKanjiDataset.supportedVersion,
            generatedAt: "2026-06-11T08:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        let interruptedDataset = try DailyKanjiDataset.decode(
            jsonData: Self.modeScopedDatasetJSON
        )
        _ = try await cacheStore.makeWriter().write(
            dataset: previousDataset,
            cachedAt: now
        )
        try JSONEncoder()
            .encode(interruptedDataset)
            .write(
                to: temporaryDirectory.appendingPathComponent(
                    DailyKanjiCacheStore.datasetFileName
                )
            )

        let snapshot = DailyKanjiRepository(
            bundle: Bundle.main,
            cacheStore: cacheStore
        ).loadSnapshot(now: now)

        XCTAssertEqual(snapshot.cards.map(\.cardId), interruptedDataset.cards.map(\.cardId))
        XCTAssertEqual(snapshot.source, .cache(metadata: nil))
        XCTAssertTrue(
            DailyKanjiSyncPolicy().shouldSync(
                now: now,
                metadata: snapshot.cacheMetadata,
                lastFailureAt: nil,
                consecutiveFailureCount: 0,
                force: false
            )
        )
    }

    func testRepositoryFallsBackToStudyModeBundleWhenCacheDoesNotDeclareModes() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let bundle = try Self.makeBundle(
            containing: try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON),
            in: temporaryDirectory
        )
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let legacyDataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T08:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        _ = try await cacheStore.makeWriter().write(
            dataset: legacyDataset,
            cachedAt: now
        )

        let decoder = CountingDailyKanjiDatasetDecoder()
        let repository = DailyKanjiRepository(
            bundle: bundle,
            cacheStore: cacheStore,
            decodeDataset: decoder.decode
        )
        let snapshot = repository.loadSnapshot(now: now)

        XCTAssertEqual(
            snapshot.cards.map(\.cardId),
            ["daily-global", "prestudy-one", "last-one", "last-two"]
        )
        XCTAssertEqual(snapshot.source, .bundle)
        XCTAssertEqual(decoder.count, 2)
    }

    func testRepositorySnapshotDecodesModeAwareCacheOnlyOnce() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let bundle = try Self.makeBundle(
            containing: try DailyKanjiDataset.decode(jsonData: Self.datasetJSON),
            in: temporaryDirectory
        )
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let modeDataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let glossary = try XCTUnwrap(
            DailyKanjiDataset.decode(jsonData: Self.glossaryDatasetJSON).glossary
        )
        let cachedDataset = DailyKanjiDataset(
            version: modeDataset.version,
            generatedAt: modeDataset.generatedAt,
            recentMistakeLookbackDays: modeDataset.recentMistakeLookbackDays,
            cards: modeDataset.cards,
            glossary: glossary
        )
        _ = try await cacheStore.makeWriter().write(
            dataset: cachedDataset,
            cachedAt: now
        )
        let decoder = CountingDailyKanjiDatasetDecoder()
        let repository = DailyKanjiRepository(
            bundle: bundle,
            cacheStore: cacheStore,
            decodeDataset: decoder.decode
        )

        let snapshot = repository.loadSnapshot(now: now)

        XCTAssertEqual(decoder.count, 1)
        XCTAssertEqual(snapshot.source, .cache(metadata: snapshot.cacheMetadata))
        XCTAssertEqual(snapshot.cards.map(\.cardId), modeDataset.cards.map(\.cardId))
        XCTAssertEqual(snapshot.glossaryEntries.map(\.id), glossary.entries.map(\.id))
        XCTAssertTrue(snapshot.requiresStudyModeAwareSync)
    }

    @MainActor
    func testRepositoryAsyncSnapshotDecodesOutsideTheMainThread() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON)
        let bundle = try Self.makeBundle(containing: dataset, in: temporaryDirectory)
        let decoder = CountingDailyKanjiDatasetDecoder()
        let repository = DailyKanjiRepository(
            bundle: bundle,
            cacheStore: DailyKanjiCacheStore(
                directoryURL: temporaryDirectory.appendingPathComponent(
                    "Cache",
                    isDirectory: true
                )
            ),
            decodeDataset: decoder.decode
        )

        let snapshot = await repository.loadSnapshotAsync(now: now)

        XCTAssertEqual(snapshot.cards.map(\.cardId), dataset.cards.map(\.cardId))
        XCTAssertEqual(decoder.count, 1)
        XCTAssertFalse(decoder.wasCalledOnMainThread)
    }

    @MainActor
    func testAppModelUsesPreloadedRepositorySnapshotWithoutDecodingAgain() throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let defaultsName = "DailyKanjiPreloadedSnapshot.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let bundle = try Self.makeBundle(containing: dataset, in: temporaryDirectory)
        let decoder = CountingDailyKanjiDatasetDecoder()
        let repository = DailyKanjiRepository(
            bundle: bundle,
            cacheStore: DailyKanjiCacheStore(
                directoryURL: temporaryDirectory.appendingPathComponent(
                    "Cache",
                    isDirectory: true
                )
            ),
            decodeDataset: decoder.decode
        )
        let snapshot = DailyKanjiRepositorySnapshot(
            dataset: dataset,
            source: .bundle,
            requiresStudyModeAwareSync: true
        )

        let model = DailyKanjiAppModel(
            repository: repository,
            initialRepositorySnapshot: snapshot,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            widgetHistoryStore: DailyKanjiWidgetTimelineHistoryStore(defaults: defaults),
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            syncer: nil,
            liveReviewClient: nil,
            now: now
        )

        XCTAssertEqual(decoder.count, 0)
        XCTAssertEqual(model.cards.map(\.cardId), dataset.cards.map(\.cardId))
        XCTAssertEqual(model.syncState, .unavailable)
    }

    func testCacheSnapshotKeepsUsableDatasetButDropsIncoherentMetadata() async throws {
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let cases: [(String, DailyKanjiCachedDatasetMetadata?)] = [
            ("missing", nil),
            (
                "generatedAt",
                DailyKanjiCachedDatasetMetadata(
                    cachedAt: now,
                    generatedAt: "2026-06-12T00:00:00.000Z",
                    cardCount: dataset.cards.count
                )
            ),
            (
                "cardCount",
                DailyKanjiCachedDatasetMetadata(
                    cachedAt: now,
                    generatedAt: dataset.generatedAt,
                    cardCount: dataset.cards.count + 1
                )
            ),
            (
                "future",
                DailyKanjiCachedDatasetMetadata(
                    cachedAt: now.addingTimeInterval(1),
                    generatedAt: dataset.generatedAt,
                    cardCount: dataset.cards.count
                )
            )
        ]

        for (name, replacementMetadata) in cases {
            let temporaryDirectory = try Self.makeTemporaryDirectory()
            defer { Self.removeTemporaryDirectory(temporaryDirectory) }
            let cacheStore = DailyKanjiCacheStore(directoryURL: temporaryDirectory)
            _ = try await cacheStore.makeWriter().write(
                dataset: dataset,
                cachedAt: now
            )
            let metadataURL = temporaryDirectory.appendingPathComponent(
                DailyKanjiCacheStore.metadataFileName
            )
            if let replacementMetadata {
                try Self.writeCacheMetadata(replacementMetadata, to: temporaryDirectory)
            } else {
                try FileManager.default.removeItem(at: metadataURL)
            }

            let snapshot = DailyKanjiRepository(
                bundle: Bundle.main,
                cacheStore: cacheStore
            ).loadSnapshot(now: now)

            XCTAssertEqual(snapshot.cards.map(\.cardId), dataset.cards.map(\.cardId), name)
            XCTAssertEqual(snapshot.source, .cache(metadata: nil), name)
            XCTAssertNil(snapshot.cacheMetadata, name)
            XCTAssertTrue(
                DailyKanjiSyncPolicy().shouldSync(
                    now: now,
                    metadata: snapshot.cacheMetadata,
                    lastFailureAt: nil,
                    consecutiveFailureCount: 0,
                    force: false
                ),
                name
            )
        }
    }

    func testCacheStoreWritesDatasetAtomicallyWithMetadata() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let cacheStore = DailyKanjiCacheStore(directoryURL: temporaryDirectory)
        let cachedAt = Date(timeIntervalSince1970: 1_800_000_000)
        let dataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T08:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )

        let writtenMetadata = try await cacheStore.makeWriter().write(
            dataset: dataset,
            cachedAt: cachedAt
        )
        let snapshot = try XCTUnwrap(cacheStore.loadSnapshot(now: cachedAt))

        XCTAssertEqual(snapshot.dataset.cards.map(\.cardId), ["card-0"])
        XCTAssertEqual(
            snapshot.metadata,
            DailyKanjiCachedDatasetMetadata(
                cachedAt: cachedAt,
                generatedAt: "2026-06-11T08:00:00.000Z",
                cardCount: 1
            )
        )
        XCTAssertEqual(writtenMetadata, snapshot.metadata)
    }

    func testCacheWriterCreatesFullAppAndCardsOnlyWidgetSnapshots() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let cacheStore = DailyKanjiCacheStore(directoryURL: temporaryDirectory)
        let modeDataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let glossary = try XCTUnwrap(
            DailyKanjiDataset.decode(jsonData: Self.glossaryDatasetJSON).glossary
        )
        let dataset = DailyKanjiDataset(
            version: modeDataset.version,
            generatedAt: modeDataset.generatedAt,
            recentMistakeLookbackDays: modeDataset.recentMistakeLookbackDays,
            cards: modeDataset.cards,
            glossary: glossary
        )

        _ = try await cacheStore.makeWriter().write(dataset: dataset, cachedAt: now)

        let appSnapshot = try XCTUnwrap(cacheStore.loadSnapshot(mode: .app, now: now))
        let widgetSnapshot = try XCTUnwrap(cacheStore.loadSnapshot(mode: .widget, now: now))

        XCTAssertEqual(appSnapshot.dataset.glossary, glossary)
        XCTAssertNil(widgetSnapshot.dataset.glossary)
        XCTAssertEqual(widgetSnapshot.dataset.cards, appSnapshot.dataset.cards)
        XCTAssertEqual(widgetSnapshot.dataset.generatedAt, appSnapshot.dataset.generatedAt)
        XCTAssertEqual(widgetSnapshot.metadata, appSnapshot.metadata)
    }

    func testWidgetRepositoryPrefersCardsOnlySyncedCache() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let bundledDataset = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON)
        let bundle = try Self.makeBundle(
            containing: bundledDataset.widgetProjection,
            in: temporaryDirectory,
            resourceName: "daily-kanji-widget-cards"
        )
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let cachedDataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        _ = try await cacheStore.makeWriter().write(dataset: cachedDataset, cachedAt: now)

        let snapshot = DailyKanjiRepository(
            mode: .widget,
            bundle: bundle,
            cacheStore: cacheStore
        ).loadSnapshot(now: now)

        XCTAssertEqual(snapshot.cards.map(\.cardId), cachedDataset.cards.map(\.cardId))
        XCTAssertTrue(snapshot.glossaryEntries.isEmpty)
        XCTAssertEqual(snapshot.source, .cache(metadata: snapshot.cacheMetadata))
    }

    func testWidgetRepositoryNeverFallsBackToTheFullAppCache() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let bundledDataset = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON)
        let bundle = try Self.makeBundle(
            containing: bundledDataset.widgetProjection,
            in: temporaryDirectory,
            resourceName: "daily-kanji-widget-cards"
        )
        let cacheDirectory = temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        let cacheStore = DailyKanjiCacheStore(directoryURL: cacheDirectory)
        let fullCacheDataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        _ = try await cacheStore.makeWriter().write(dataset: fullCacheDataset, cachedAt: now)
        try FileManager.default.removeItem(
            at: cacheDirectory.appendingPathComponent(
                DailyKanjiCacheStore.widgetDatasetFileName
            )
        )

        let snapshot = DailyKanjiRepository(
            mode: .widget,
            bundle: bundle,
            cacheStore: cacheStore
        ).loadSnapshot(now: now)

        XCTAssertEqual(snapshot.cards.map(\.cardId), bundledDataset.cards.map(\.cardId))
        XCTAssertEqual(snapshot.source, .bundle)
    }

    func testCacheStoreDeclaresTheSharedAppGroupIdentifier() {
        XCTAssertEqual(
            DailyKanjiCacheStore.appGroupIdentifier,
            "group.dev.local.daily-kanji"
        )
    }

    func testSyncPolicyRefreshesWhenCacheIsOlderThanFourHours() {
        let policy = DailyKanjiSyncPolicy()
        let metadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: now.addingTimeInterval(-(4 * 60 * 60) - 1),
            generatedAt: "2026-06-11T04:00:00.000Z",
            cardCount: 1
        )

        XCTAssertTrue(
            policy.shouldSync(
                now: now,
                metadata: metadata,
                lastFailureAt: nil,
                consecutiveFailureCount: 0,
                force: false
            )
        )
    }

    func testSyncPolicyDoesNotRefreshAtUtcMidnightWithinTheSameRomeDay() {
        let policy = DailyKanjiSyncPolicy(calendar: Self.romeCalendar())
        let metadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: Self.isoDate("2026-06-10T23:30:00.000Z"),
            generatedAt: "2026-06-10T23:30:00.000Z",
            cardCount: 1
        )

        XCTAssertFalse(
            policy.shouldSync(
                now: Self.isoDate("2026-06-11T00:05:00.000Z"),
                metadata: metadata,
                lastFailureAt: nil,
                consecutiveFailureCount: 0,
                force: false
            )
        )
    }

    func testSyncPolicyRefreshesAfterRomeCalendarDayChange() {
        let policy = DailyKanjiSyncPolicy(calendar: Self.romeCalendar())
        let metadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: Self.isoDate("2026-06-10T21:55:00.000Z"),
            generatedAt: "2026-06-10T21:55:00.000Z",
            cardCount: 1
        )

        XCTAssertTrue(
            policy.shouldSync(
                now: Self.isoDate("2026-06-10T22:05:00.000Z"),
                metadata: metadata,
                lastFailureAt: nil,
                consecutiveFailureCount: 0,
                force: false
            )
        )
    }

    func testSyncPolicyRefreshesFutureMetadataButAcceptsCurrentMetadata() {
        let policy = DailyKanjiSyncPolicy(calendar: Self.romeCalendar())
        let futureMetadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: now.addingTimeInterval(1),
            generatedAt: "2026-06-11T08:00:01.000Z",
            cardCount: 1
        )
        let currentMetadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: now,
            generatedAt: "2026-06-11T08:00:00.000Z",
            cardCount: 1
        )

        XCTAssertTrue(
            policy.shouldSync(
                now: now,
                metadata: futureMetadata,
                lastFailureAt: nil,
                consecutiveFailureCount: 0,
                force: false
            )
        )
        XCTAssertFalse(
            policy.shouldSync(
                now: now,
                metadata: currentMetadata,
                lastFailureAt: nil,
                consecutiveFailureCount: 0,
                force: false
            )
        )
    }

    func testSyncPolicyBacksOffAfterFailure() {
        let policy = DailyKanjiSyncPolicy()
        let metadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: now.addingTimeInterval(-60),
            generatedAt: "2026-06-11T08:00:00.000Z",
            cardCount: 1
        )
        let lastFailureAt = now.addingTimeInterval(-(14 * 60))

        XCTAssertFalse(
            policy.shouldSync(
                now: now,
                metadata: metadata,
                lastFailureAt: lastFailureAt,
                consecutiveFailureCount: 1,
                force: false
            )
        )
        XCTAssertTrue(
            policy.shouldSync(
                now: now,
                metadata: metadata,
                lastFailureAt: lastFailureAt,
                consecutiveFailureCount: 1,
                force: true
            )
        )
    }

    func testSyncPolicyIgnoresFutureFailureTimestampAfterClockRollback() {
        let policy = DailyKanjiSyncPolicy(calendar: Self.romeCalendar())
        let staleMetadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: now.addingTimeInterval(-(5 * 60 * 60)),
            generatedAt: "2026-06-11T03:00:00.000Z",
            cardCount: 1
        )

        XCTAssertTrue(
            policy.shouldSync(
                now: now,
                metadata: staleMetadata,
                lastFailureAt: now.addingTimeInterval(60),
                consecutiveFailureCount: 1,
                force: false
            )
        )
    }

    func testSyncPolicyExponentiallyBacksOffRepeatedFailures() {
        let policy = DailyKanjiSyncPolicy()
        let metadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: now.addingTimeInterval(-(5 * 60 * 60)),
            generatedAt: "2026-06-11T04:00:00.000Z",
            cardCount: 1
        )

        XCTAssertFalse(
            policy.shouldSync(
                now: now,
                metadata: metadata,
                lastFailureAt: now.addingTimeInterval(-(29 * 60)),
                consecutiveFailureCount: 2,
                force: false
            )
        )
        XCTAssertFalse(
            policy.shouldSync(
                now: now,
                metadata: metadata,
                lastFailureAt: now.addingTimeInterval(-(59 * 60)),
                consecutiveFailureCount: 3,
                force: false
            )
        )
        XCTAssertTrue(
            policy.shouldSync(
                now: now,
                metadata: metadata,
                lastFailureAt: now.addingTimeInterval(-(61 * 60)),
                consecutiveFailureCount: 3,
                force: false
            )
        )
    }

    @MainActor
    func testManualRefreshWritesCacheUpdatesSelectionAndReloadsTimelines() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let bundle = try Self.makeBundle(
            containing: try DailyKanjiDataset.decode(jsonData: Self.datasetJSON),
            in: temporaryDirectory
        )
        let syncedDataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T08:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        let syncer = MockDailyKanjiSyncer(result: .success(syncedDataset))
        var reloadCount = 0
        let model = DailyKanjiAppModel(
            repository: DailyKanjiRepository(bundle: bundle, cacheStore: cacheStore),
            cacheStore: cacheStore,
            syncer: syncer,
            reloadTimelines: { reloadCount += 1 },
            now: now
        )

        await model.syncNow(now: now, force: true)

        XCTAssertEqual(syncer.fetchCount, 1)
        XCTAssertEqual(model.cards.map(\.cardId), ["card-0"])
        XCTAssertEqual(model.selectedCard?.cardId, "card-0")
        let cachedMetadata = cacheStore.loadSnapshot(now: now)?.metadata
        XCTAssertEqual(cachedMetadata?.cardCount, 1)
        XCTAssertEqual(reloadCount, 1)
        XCTAssertEqual(model.syncState, .idle(source: .cache(metadata: cachedMetadata)))
    }

    @MainActor
    func testAppModelDoesNotDecodeRepositoryAgainDuringSuccessfulSync() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let bundle = try Self.makeBundle(containing: dataset, in: temporaryDirectory)
        let decoder = CountingDailyKanjiDatasetDecoder()
        let writer = ControllableDailyKanjiCacheWriter()
        let model = DailyKanjiAppModel(
            repository: DailyKanjiRepository(
                bundle: bundle,
                cacheStore: DailyKanjiCacheStore(
                    directoryURL: temporaryDirectory.appendingPathComponent(
                        "Cache",
                        isDirectory: true
                    )
                ),
                decodeDataset: decoder.decode
            ),
            cacheWriter: writer,
            syncer: MockDailyKanjiSyncer(result: .success(dataset)),
            now: now
        )

        XCTAssertEqual(decoder.count, 1)

        await model.syncNow(now: now, force: true)

        XCTAssertEqual(decoder.count, 1)
        XCTAssertEqual(
            model.syncState,
            .idle(
                source: .cache(
                    metadata: DailyKanjiCachedDatasetMetadata(
                        cachedAt: now,
                        generatedAt: dataset.generatedAt,
                        cardCount: dataset.cards.count
                    )
                )
            )
        )
    }

    @MainActor
    func testSyncDoesNotPublishOrReloadBeforeCacheWriterCommits() async throws {
        let initialCards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let replacementDataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T09:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        let writer = ControllableDailyKanjiCacheWriter(pausesWrites: true)
        var reloadCount = 0
        let model = DailyKanjiAppModel(
            cards: initialCards,
            cacheWriter: writer,
            syncer: MockDailyKanjiSyncer(result: .success(replacementDataset)),
            reloadTimelines: { reloadCount += 1 },
            now: now
        )

        let syncTask = Task {
            await model.syncNow(now: now, force: true)
        }
        await Self.waitUntilAsync { await writer.isWaiting }

        XCTAssertEqual(model.cards.map(\.cardId), ["hard", "stable"])
        XCTAssertEqual(model.syncState, .syncing(source: .sample))
        XCTAssertEqual(reloadCount, 0)

        await writer.resolve()
        await syncTask.value

        let metadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: now,
            generatedAt: replacementDataset.generatedAt,
            cardCount: replacementDataset.cards.count
        )
        XCTAssertEqual(model.cards.map(\.cardId), ["card-0"])
        XCTAssertEqual(model.syncState, .idle(source: .cache(metadata: metadata)))
        XCTAssertEqual(reloadCount, 1)
    }

    @MainActor
    func testSyncPreservesUiChangesMadeWhileCacheWriterIsSuspended() async throws {
        let defaultsName = "DailyKanjiCacheWriter-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let refreshedDataset = DailyKanjiDataset(
            version: dataset.version,
            generatedAt: "2026-06-11T09:00:00.000Z",
            recentMistakeLookbackDays: dataset.recentMistakeLookbackDays,
            cards: dataset.cards,
            glossary: dataset.glossary
        )
        let writer = ControllableDailyKanjiCacheWriter(pausesWrites: true)
        let model = DailyKanjiAppModel(
            cards: dataset.cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            cacheWriter: writer,
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            syncer: MockDailyKanjiSyncer(result: .success(refreshedDataset)),
            now: now
        )
        let deepLinkTime = now.addingTimeInterval(1)

        let syncTask = Task {
            await model.syncNow(now: now, force: true)
        }
        await Self.waitUntilAsync { await writer.isWaiting }
        model.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "prestudy-one"),
            now: deepLinkTime
        )
        model.setDraftStudyMode(.prestudy)

        await writer.resolve()
        await syncTask.value

        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertEqual(model.selectedHistoryContext?.source, .widget)
        XCTAssertEqual(
            model.selectedHistoryContext?.shownAt,
            DailyKanjiSelector.currentWidgetSlotStart(for: deepLinkTime)
        )
        XCTAssertEqual(model.draftStudyMode, .prestudy)
        XCTAssertEqual(model.draftMediaSlug, "media-one")
        XCTAssertTrue(model.hasStudyScopeDraftChanges)
    }

    @MainActor
    func testConcurrentDirectSyncNowCallsAreSingleFlight() async throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let dataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T09:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        let syncer = MockDailyKanjiSyncer(result: .success(dataset))
        let writer = ControllableDailyKanjiCacheWriter(pausesWrites: true)
        let model = DailyKanjiAppModel(
            cards: cards,
            cacheWriter: writer,
            syncer: syncer,
            now: now
        )

        let firstTask = Task {
            await model.syncNow(now: now, force: true)
        }
        await Self.waitUntilAsync { await writer.isWaiting }
        let secondTask = Task {
            await model.syncNow(now: now.addingTimeInterval(1), force: true)
        }
        await secondTask.value

        let writeCount = await writer.writeCount
        XCTAssertEqual(syncer.fetchCount, 1)
        XCTAssertEqual(writeCount, 1)

        await writer.resolve()
        await firstTask.value
    }

    @MainActor
    func testCacheWriterFailureDoesNotPublishDatasetOrReloadTimelines() async throws {
        let initialCards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let replacementDataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T09:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        let writer = ControllableDailyKanjiCacheWriter(failsWrites: true)
        var reloadCount = 0
        let model = DailyKanjiAppModel(
            cards: initialCards,
            cacheWriter: writer,
            syncer: MockDailyKanjiSyncer(result: .success(replacementDataset)),
            reloadTimelines: { reloadCount += 1 },
            now: now
        )

        await model.syncNow(now: now, force: true)

        let writeCount = await writer.writeCount
        XCTAssertEqual(model.cards.map(\.cardId), ["hard", "stable"])
        XCTAssertEqual(
            model.syncState,
            .failed(message: "Cache write failed.", source: .sample)
        )
        XCTAssertEqual(reloadCount, 0)
        XCTAssertEqual(writeCount, 1)
    }

    @MainActor
    func testSuccessfulSyncPreservesTheVisibleCardAndWidgetContext() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let defaultsName = "DailyKanjiSync-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let syncer = PausableDailyKanjiSyncer(dataset: dataset)
        let model = DailyKanjiAppModel(
            cards: dataset.cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            cacheStore: cacheStore,
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            syncer: syncer,
            now: now
        )
        let deepLinkTime = now.addingTimeInterval(30)

        let syncTask = Task {
            await model.syncNow(now: deepLinkTime.addingTimeInterval(1), force: true)
        }
        await Self.waitUntil { syncer.fetchCount == 1 }
        model.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "prestudy-one"),
            now: deepLinkTime
        )
        syncer.resolve()
        await syncTask.value

        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertEqual(model.selectedHistoryContext?.source, .widget)
        XCTAssertEqual(
            model.selectedHistoryContext?.shownAt,
            DailyKanjiSelector.currentWidgetSlotStart(for: deepLinkTime)
        )
    }

    @MainActor
    func testSuccessfulSyncPreservesAValidDirtyStudyScopeDraft() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let defaultsName = "DailyKanjiSync-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let syncer = PausableDailyKanjiSyncer(dataset: dataset)
        let model = DailyKanjiAppModel(
            cards: dataset.cards,
            cacheStore: cacheStore,
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            syncer: syncer,
            now: now
        )

        let syncTask = Task {
            await model.syncNow(now: now.addingTimeInterval(1), force: true)
        }
        await Self.waitUntil { syncer.fetchCount == 1 }
        model.setDraftStudyMode(.prestudy)
        syncer.resolve()
        await syncTask.value

        XCTAssertEqual(model.selectedStudyMode, .daily)
        XCTAssertNil(model.selectedMediaSlug)
        XCTAssertEqual(model.draftStudyMode, .prestudy)
        XCTAssertEqual(model.draftMediaSlug, "media-one")
        XCTAssertTrue(model.hasStudyScopeDraftChanges)
    }

    @MainActor
    func testSuccessfulSyncRecordsAReplacementCardImmediately() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let defaultsName = "DailyKanjiHistory-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let initialDataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let replacementDataset = DailyKanjiDataset(
            version: initialDataset.version,
            generatedAt: "2026-06-11T09:00:00.000Z",
            recentMistakeLookbackDays: initialDataset.recentMistakeLookbackDays,
            cards: [initialDataset.cards.first { $0.cardId == "prestudy-one" }!]
        )
        let historyStore = DailyKanjiHistoryStore(defaults: defaults)
        let model = DailyKanjiAppModel(
            cards: initialDataset.cards,
            historyStore: historyStore,
            cacheStore: DailyKanjiCacheStore(
                directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
            ),
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            syncer: MockDailyKanjiSyncer(result: .success(replacementDataset)),
            now: now
        )

        model.activate(now: now)
        await model.syncNow(now: now.addingTimeInterval(10), force: true)

        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertEqual(
            historyStore.allItems().map(\.cardId),
            ["prestudy-one", "daily-global"]
        )
    }

    @MainActor
    func testSyncBeforeActivationKeepsPreparedSelectionDeferred() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let defaultsName = "DailyKanjiSync-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let initialDataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let replacementDataset = DailyKanjiDataset(
            version: initialDataset.version,
            generatedAt: "2026-06-11T09:00:00.000Z",
            recentMistakeLookbackDays: initialDataset.recentMistakeLookbackDays,
            cards: [initialDataset.cards.first { $0.cardId == "prestudy-one" }!]
        )
        let historyStore = DailyKanjiHistoryStore(defaults: defaults)
        let model = DailyKanjiAppModel(
            cards: initialDataset.cards,
            historyStore: historyStore,
            cacheStore: DailyKanjiCacheStore(
                directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
            ),
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            syncer: MockDailyKanjiSyncer(result: .success(replacementDataset)),
            now: now
        )

        await model.syncNow(now: now.addingTimeInterval(1), force: true)
        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertTrue(historyStore.allItems().isEmpty)

        model.activate(now: now.addingTimeInterval(2))
        XCTAssertEqual(historyStore.allItems().map(\.cardId), ["prestudy-one"])
    }

    @MainActor
    func testSyncPreservesTransientInitialSelectionForImmediateWidgetDeepLink() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let defaultsName = "DailyKanjiSync-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let dataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let historyStore = DailyKanjiHistoryStore(defaults: defaults)
        let syncer = PausableDailyKanjiSyncer(dataset: dataset)
        let model = DailyKanjiAppModel(
            cards: dataset.cards,
            historyStore: historyStore,
            cacheStore: DailyKanjiCacheStore(
                directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
            ),
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            syncer: syncer,
            now: now
        )

        model.activate(now: now)
        await Self.waitUntil { syncer.fetchCount == 1 }
        syncer.resolve()
        await Self.waitUntil {
            if case .idle = model.syncState {
                return true
            }
            return false
        }
        model.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "prestudy-one"),
            now: now.addingTimeInterval(2)
        )

        XCTAssertEqual(historyStore.allItems().map(\.cardId), ["prestudy-one"])
    }

    @MainActor
    func testManualRefreshRejectsLegacySyncDatasetWhenBundleRequiresStudyModes() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let bundle = try Self.makeBundle(
            containing: try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON),
            in: temporaryDirectory
        )
        let legacySyncedDataset = DailyKanjiDataset(
            version: 1,
            generatedAt: "2026-06-11T08:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        let syncer = MockDailyKanjiSyncer(result: .success(legacySyncedDataset))
        let model = DailyKanjiAppModel(
            repository: DailyKanjiRepository(bundle: bundle, cacheStore: cacheStore),
            cacheStore: cacheStore,
            syncer: syncer,
            now: now
        )

        await model.syncNow(now: now, force: true)

        XCTAssertEqual(syncer.fetchCount, 1)
        XCTAssertEqual(
            model.cards.map(\.cardId),
            ["daily-global", "prestudy-one", "last-one", "last-two"]
        )
        XCTAssertNil(cacheStore.loadSnapshot(now: now))
        XCTAssertEqual(
            model.syncState,
            .failed(
                message: "Downloaded dataset does not include Daily Kanji study modes.",
                source: .bundle
            )
        )
    }

    @MainActor
    func testManualRefreshRejectsUnsupportedDatasetVersionBeforeCacheWrite() async throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let unsupportedDataset = DailyKanjiDataset(
            version: DailyKanjiDataset.supportedVersion + 1,
            generatedAt: "2026-06-11T09:00:00.000Z",
            recentMistakeLookbackDays: 3,
            cards: try Self.rankedCards(count: 1)
        )
        let writer = ControllableDailyKanjiCacheWriter()
        let model = DailyKanjiAppModel(
            cards: cards,
            cacheWriter: writer,
            syncer: MockDailyKanjiSyncer(result: .success(unsupportedDataset)),
            now: now
        )

        await model.syncNow(now: now, force: true)

        let writeCount = await writer.writeCount
        XCTAssertEqual(writeCount, 0)
        XCTAssertEqual(model.cards.map(\.cardId), cards.map(\.cardId))
        XCTAssertEqual(
            model.syncState,
            .failed(
                message: "Downloaded dataset version is not supported.",
                source: .sample
            )
        )
    }

    @MainActor
    func testAutomaticRefreshUsesExponentialFailureBackoff() async throws {
        let cards = try Self.rankedCards(count: 1)
        let syncer = MockDailyKanjiSyncer(result: .failure(DailyKanjiSyncClientError.invalidResponse))
        let model = DailyKanjiAppModel(cards: cards, syncer: syncer, now: now)

        await model.syncNow(now: now, force: false)
        await model.syncNow(now: now.addingTimeInterval(14 * 60), force: false)
        await model.syncNow(now: now.addingTimeInterval(16 * 60), force: false)
        await model.syncNow(now: now.addingTimeInterval(45 * 60), force: false)
        await model.syncNow(now: now.addingTimeInterval(47 * 60), force: false)

        XCTAssertEqual(syncer.fetchCount, 3)
    }

    @MainActor
    func testSuccessfulRefreshResetsFailureBackoff() async throws {
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let syncedDataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let syncer = MockDailyKanjiSyncer(results: [
            .failure(DailyKanjiSyncClientError.invalidResponse),
            .success(syncedDataset),
            .failure(DailyKanjiSyncClientError.invalidResponse),
            .success(syncedDataset)
        ])
        let model = DailyKanjiAppModel(
            cards: syncedDataset.cards,
            cacheStore: cacheStore,
            syncer: syncer,
            now: now
        )

        await model.syncNow(now: now, force: false)
        await model.syncNow(now: now.addingTimeInterval(16 * 60), force: false)
        await model.syncNow(now: now.addingTimeInterval((4 * 60 * 60) + (17 * 60)), force: false)
        await model.syncNow(now: now.addingTimeInterval((4 * 60 * 60) + (31 * 60)), force: false)
        await model.syncNow(now: now.addingTimeInterval((4 * 60 * 60) + (33 * 60)), force: false)

        XCTAssertEqual(syncer.fetchCount, 4)
    }

    func testSyncStatusPresentationShowsSharedCacheSourceAndLastSync() {
        let metadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: now,
            generatedAt: "2026-06-11T08:00:00.000Z",
            cardCount: 42
        )

        let presentation = DailyKanjiSyncStatusPresentation(
            syncState: .idle(source: .cache(metadata: metadata))
        )

        XCTAssertEqual(presentation.title, "Sincronizzato")
        XCTAssertEqual(presentation.subtitle, "Cache condivisa - 42 card")
        XCTAssertEqual(presentation.lastSyncAt, now)
        XCTAssertEqual(presentation.systemImage, "checkmark.icloud")
        XCTAssertFalse(presentation.isRefreshing)
        XCTAssertTrue(presentation.canRefresh)
    }

    func testSyncStatusPresentationMarksCacheWithoutMetadataAsUnverified() {
        let presentation = DailyKanjiSyncStatusPresentation(
            syncState: .idle(source: .cache(metadata: nil))
        )

        XCTAssertEqual(presentation.title, "Cache da verificare")
        XCTAssertEqual(
            presentation.subtitle,
            "Cache condivisa - aggiornamento richiesto"
        )
        XCTAssertNil(presentation.lastSyncAt)
        XCTAssertEqual(presentation.systemImage, "exclamationmark.triangle")
        XCTAssertFalse(presentation.isRefreshing)
        XCTAssertTrue(presentation.canRefresh)
    }

    func testSyncStatusPresentationDisablesRefreshWhileSyncing() {
        let presentation = DailyKanjiSyncStatusPresentation(
            syncState: .syncing(source: .bundle)
        )

        XCTAssertEqual(presentation.title, "Sincronizzo")
        XCTAssertEqual(presentation.subtitle, "Snapshot incluso")
        XCTAssertTrue(presentation.isRefreshing)
        XCTAssertFalse(presentation.canRefresh)
    }

    func testSyncStatusPresentationKeepsFailureRefreshable() {
        let presentation = DailyKanjiSyncStatusPresentation(
            syncState: .failed(
                message: "Sync server returned HTTP 401.",
                source: .bundle
            )
        )

        XCTAssertEqual(presentation.title, "Cache non aggiornata")
        XCTAssertEqual(presentation.subtitle, "Sync server returned HTTP 401.")
        XCTAssertEqual(presentation.systemImage, "exclamationmark.triangle")
        XCTAssertFalse(presentation.isRefreshing)
        XCTAssertTrue(presentation.canRefresh)
    }

    func testSyncStatusPresentationDisablesRefreshWhenSyncIsUnavailable() {
        let presentation = DailyKanjiSyncStatusPresentation(syncState: .unavailable)

        XCTAssertEqual(presentation.title, "Sync non configurato")
        XCTAssertEqual(presentation.subtitle, "Uso cache o bundle locale")
        XCTAssertEqual(presentation.systemImage, "wifi.slash")
        XCTAssertFalse(presentation.isRefreshing)
        XCTAssertFalse(presentation.canRefresh)
    }

    func testLiveReviewClientFetchesSessionWithBearerAuth() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let urlSession = URLSession(configuration: configuration)
        let capturedRequest = LockedBox<URLRequest?>(nil)
        MockURLProtocol.requestHandler = { request in
            capturedRequest.value = request
            return (
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: nil
                )!,
                Self.liveReviewSessionJSON
            )
        }
        defer {
            MockURLProtocol.requestHandler = nil
        }

        let client = DailyKanjiLiveReviewClient(
            baseURL: URL(string: "https://example.test")!,
            bearerToken: "mobile-token",
            session: urlSession
        )

        let session = try await client.fetchSession()

        XCTAssertEqual(capturedRequest.value?.url?.path, "/api/mobile/review/session")
        XCTAssertEqual(capturedRequest.value?.httpMethod, "GET")
        XCTAssertEqual(
            capturedRequest.value?.value(forHTTPHeaderField: "Authorization"),
            "Bearer mobile-token"
        )
        XCTAssertEqual(session.selectedCard?.cardId, "live-card")
        XCTAssertEqual(session.queue.dueCount, 1)
    }

    func testLiveReviewClientPostsGradePayload() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let urlSession = URLSession(configuration: configuration)
        let capturedRequest = LockedBox<URLRequest?>(nil)
        let capturedBody = LockedBox<Data?>(nil)
        MockURLProtocol.requestHandler = { request in
            capturedRequest.value = request
            capturedBody.value = request.httpBody ?? Self.data(from: request.httpBodyStream)
            return (
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: nil
                )!,
                Self.liveReviewGradeResponseJSON
            )
        }
        defer {
            MockURLProtocol.requestHandler = nil
        }

        let client = DailyKanjiLiveReviewClient(
            baseURL: URL(string: "https://example.test")!,
            bearerToken: "mobile-token",
            session: urlSession
        )

        let result = try await client.grade(
            cardId: "live-card",
            rating: .good,
            expectedUpdatedAt: "2026-06-28T08:00:00.000Z",
            responseMs: 1200
        )
        let body = try XCTUnwrap(capturedBody.value)
        let payload = try JSONSerialization.jsonObject(with: body) as? [String: Any]

        XCTAssertEqual(capturedRequest.value?.url?.path, "/api/mobile/review/grade")
        XCTAssertEqual(capturedRequest.value?.httpMethod, "POST")
        XCTAssertEqual(payload?["cardId"] as? String, "live-card")
        XCTAssertEqual(payload?["rating"] as? String, "good")
        XCTAssertEqual(payload?["expectedUpdatedAt"] as? String, "2026-06-28T08:00:00.000Z")
        XCTAssertEqual(payload?["responseMs"] as? Int, 1200)
        XCTAssertEqual(result.grade.rating, .good)
    }

    func testLiveReviewClientIncludesNullFreshnessTokenForNewCards() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        let urlSession = URLSession(configuration: configuration)
        let capturedBody = LockedBox<Data?>(nil)
        MockURLProtocol.requestHandler = { request in
            capturedBody.value = request.httpBody ?? Self.data(from: request.httpBodyStream)
            return (
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: nil
                )!,
                Self.liveReviewGradeResponseJSON
            )
        }
        defer {
            MockURLProtocol.requestHandler = nil
        }

        let client = DailyKanjiLiveReviewClient(
            baseURL: URL(string: "https://example.test")!,
            bearerToken: "mobile-token",
            session: urlSession
        )

        _ = try await client.grade(
            cardId: "new-live-card",
            rating: .again,
            expectedUpdatedAt: nil,
            responseMs: nil
        )
        let body = try XCTUnwrap(capturedBody.value)
        let payload = try JSONSerialization.jsonObject(with: body) as? [String: Any]

        XCTAssertEqual(payload?["cardId"] as? String, "new-live-card")
        XCTAssertEqual(payload?["rating"] as? String, "again")
        XCTAssertTrue(payload?.keys.contains("expectedUpdatedAt") ?? false)
        XCTAssertTrue(payload?["expectedUpdatedAt"] is NSNull)
    }

    func testLiveReviewFormatterStripsFuriganaMarkup() {
        XCTAssertEqual(
            DailyKanjiReviewTextFormatter.displayText(
                "{{観測|かんそく}}データを {{確認|かくにん}}します。"
            ),
            "観測データを 確認します。"
        )
        XCTAssertEqual(
            DailyKanjiReviewTextFormatter.displayText("{古い|ふるい}表記"),
            "古い表記"
        )
    }

    func testLiveReviewPresentationKeepsAnswerHiddenUntilReveal() throws {
        let session = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let card = try XCTUnwrap(session.selectedCard)
        let hidden = DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: false
        )
        let revealed = DailyKanjiLiveReviewCardPresentation(
            card: card,
            isAnswerRevealed: true
        )

        XCTAssertEqual(hidden.frontText, "観測")
        XCTAssertFalse(hidden.shouldShowAnswer)
        XCTAssertFalse(hidden.canGrade)
        XCTAssertNil(hidden.primaryAudioSource)
        XCTAssertEqual(hidden.answerDetailRows, [])

        XCTAssertEqual(revealed.backText, "osservazione / rilevamento")
        XCTAssertEqual(revealed.readingText, "かんそく")
        XCTAssertEqual(revealed.pitchAccentText, "Heiban (0)")
        XCTAssertEqual(revealed.nextReviewLabel(for: .good), "Domani alle 09:00")
        XCTAssertEqual(
            revealed.primaryAudioURL(
                baseURL: URL(string: "https://daily-kanji.example")!
            )?.absoluteString,
            "https://daily-kanji.example/media-audio/media-one/audio/term/kansoku.mp3?v=2026"
        )
        XCTAssertTrue(revealed.shouldShowAnswer)
        XCTAssertTrue(revealed.canGrade)
    }

    @MainActor
    func testAppModelFetchesLiveReviewWithoutReplacingOfflineDataset() async throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let liveClient = MockDailyKanjiLiveReviewClient(fetchResults: [.success(liveSession)])
        let model = DailyKanjiAppModel(
            cards: cards,
            liveReviewClient: liveClient,
            now: now
        )

        await model.fetchLiveReviewSession()

        XCTAssertEqual(liveClient.fetchCount, 1)
        XCTAssertEqual(model.cards.map(\.cardId), ["hard", "stable"])
        XCTAssertEqual(model.liveReviewState, .ready(session: liveSession))
        XCTAssertTrue(model.liveReviewState.canGrade)
    }

    @MainActor
    func testLiveReviewFailureKeepsStaleSessionReadOnly() async throws {
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let liveClient = MockDailyKanjiLiveReviewClient(fetchResults: [
            .success(liveSession),
            .failure(DailyKanjiLiveReviewClientError.invalidResponse)
        ])
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            now: now
        )

        await model.fetchLiveReviewSession()
        await model.fetchLiveReviewSession()

        XCTAssertEqual(
            model.liveReviewState,
            .failed(
                message: "Review server returned an invalid response.",
                staleSession: liveSession
            )
        )
        XCTAssertFalse(model.liveReviewState.canGrade)
        XCTAssertEqual(model.liveReviewState.session?.selectedCard?.cardId, "live-card")
    }

    @MainActor
    func testLiveReviewGradeUsesExpectedUpdatedAtAndAdvancesSession() async throws {
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let nextSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 0, nextDueAt: nil),
            selectedCard: nil
        )
        let gradeResult = DailyKanjiLiveReviewGradeResult(
            grade: DailyKanjiLiveReviewGradeResult.Grade(cardId: "live-card", rating: .easy),
            session: nextSession
        )
        let liveClient = MockDailyKanjiLiveReviewClient(
            fetchResults: [.success(liveSession)],
            gradeResults: [.success(gradeResult)]
        )
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            now: now
        )

        await model.fetchLiveReviewSession()
        await model.gradeLiveReviewNow(card: liveSession.selectedCard!, rating: .easy)

        XCTAssertEqual(liveClient.gradeRequests.count, 1)
        XCTAssertEqual(liveClient.gradeRequests[0].cardId, "live-card")
        XCTAssertEqual(liveClient.gradeRequests[0].rating, .easy)
        XCTAssertEqual(
            liveClient.gradeRequests[0].expectedUpdatedAt,
            "2026-06-28T08:00:00.000Z"
        )
        XCTAssertNotNil(liveClient.gradeRequests[0].responseMs)
        XCTAssertEqual(model.liveReviewState, .ready(session: nextSession))
    }

    @MainActor
    func testLiveReviewGradeKeepsCurrentCardVisibleWhileSubmitting() async throws {
        let bufferedSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let liveSession = DailyKanjiLiveReviewSession(
            source: bufferedSession.source,
            queue: bufferedSession.queue,
            selectedCard: bufferedSession.selectedCard,
            advanceCards: []
        )
        let nextSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 0, nextDueAt: nil),
            selectedCard: nil,
            advanceCards: []
        )
        let gradeResult = DailyKanjiLiveReviewGradeResult(
            grade: DailyKanjiLiveReviewGradeResult.Grade(cardId: "live-card", rating: .good),
            session: nextSession
        )
        let liveClient = MockDailyKanjiLiveReviewClient(
            fetchResults: [.success(liveSession)],
            gradeResults: [.success(gradeResult)],
            pauseGradesUntilResolved: true
        )
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            now: now
        )

        await model.fetchLiveReviewSession()
        model.gradeLiveReview(.good)
        await Self.waitUntil {
            liveClient.gradeRequests.count == 1
        }

        XCTAssertEqual(model.liveReviewState, .submitting(session: liveSession, rating: .good))
        XCTAssertFalse(model.liveReviewState.canGrade)
        XCTAssertEqual(model.liveReviewState.session?.selectedCard?.cardId, "live-card")

        liveClient.resolvePendingGrade()
        await Self.waitUntil {
            model.liveReviewState == .ready(session: nextSession)
        }

        XCTAssertEqual(model.liveReviewState, .ready(session: nextSession))
    }

    @MainActor
    func testLiveReviewGradeShowsBufferedNextCardWhileSubmitting() async throws {
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let nextCard = try XCTUnwrap(liveSession.advanceCards.first)
        let optimisticSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(
                dueCount: 0,
                queueCount: 2,
                nextDueAt: "2026-06-28T09:00:00.000Z"
            ),
            selectedCard: nextCard,
            advanceCards: []
        )
        let gradeResult = DailyKanjiLiveReviewGradeResult(
            grade: DailyKanjiLiveReviewGradeResult.Grade(cardId: "live-card", rating: .good),
            session: optimisticSession
        )
        let liveClient = MockDailyKanjiLiveReviewClient(
            fetchResults: [.success(liveSession)],
            gradeResults: [.success(gradeResult)],
            pauseGradesUntilResolved: true
        )
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            now: now
        )

        await model.fetchLiveReviewSession()
        model.gradeLiveReview(.good)
        await Self.waitUntil {
            liveClient.gradeRequests.count == 1
        }

        XCTAssertEqual(model.liveReviewState, .submitting(session: optimisticSession, rating: .good))
        XCTAssertTrue(model.liveReviewState.canReveal)
        XCTAssertFalse(model.liveReviewState.canGrade)
        XCTAssertEqual(model.liveReviewState.session?.selectedCard?.cardId, "next-live-card")

        liveClient.resolvePendingGrade()
        await Self.waitUntil {
            model.liveReviewState == .ready(session: optimisticSession)
        }

        XCTAssertEqual(model.liveReviewState, .ready(session: optimisticSession))
    }

    @MainActor
    func testForcedLiveReviewRefreshWaitsForGradeWithoutCancellingIt() async throws {
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let refreshedSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 1, nextDueAt: nil),
            selectedCard: try XCTUnwrap(liveSession.advanceCards.first),
            advanceCards: []
        )
        let gradeSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 0, nextDueAt: nil),
            selectedCard: nil,
            advanceCards: []
        )
        let gradeResult = DailyKanjiLiveReviewGradeResult(
            grade: DailyKanjiLiveReviewGradeResult.Grade(
                cardId: "live-card",
                rating: .good
            ),
            session: gradeSession
        )
        let liveClient = MockDailyKanjiLiveReviewClient(
            fetchResults: [.success(liveSession), .success(refreshedSession)],
            gradeResults: [.success(gradeResult)],
            pauseGradesUntilResolved: true
        )
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            now: now
        )

        await model.fetchLiveReviewSession()
        model.gradeLiveReview(.good)
        await Self.waitUntil {
            liveClient.gradeRequests.count == 1
        }

        model.refreshLiveReviewNow()
        await Task.yield()

        XCTAssertEqual(liveClient.fetchCount, 1)
        XCTAssertFalse(liveClient.wasPendingGradeCancelled)
        XCTAssertTrue(model.liveReviewState.isSubmitting)

        liveClient.resolvePendingGrade()
        await Self.waitUntil {
            liveClient.fetchCount == 2
                && model.liveReviewState == .ready(session: refreshedSession)
        }

        XCTAssertFalse(liveClient.wasPendingGradeCancelled)
        XCTAssertEqual(model.liveReviewState, .ready(session: refreshedSession))
    }

    @MainActor
    func testControllableLiveReviewClientBuffersResolutionBeforeContinuationRegistration()
        async throws {
        let session = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let liveClient = ControllableDailyKanjiLiveReviewClient(
            pausesBeforeContinuationRegistration: true
        )
        let fetchTask = Task {
            try await liveClient.fetchSession()
        }

        await Self.waitUntil {
            liveClient.pausedRegistrationIndexes.contains(0)
        }
        XCTAssertEqual(liveClient.fetchCount, 1)

        liveClient.resolveFetch(at: 0, with: .success(session))
        XCTAssertFalse(liveClient.completedFetches.contains(0))
        liveClient.resumeFetchRegistration(at: 0)

        let resolvedSession = try await fetchTask.value
        XCTAssertEqual(resolvedSession, session)
        XCTAssertTrue(liveClient.completedFetches.contains(0))
    }

    @MainActor
    func testSupersededLiveReviewFetchCannotPublishOrClearNewerHandle() async throws {
        let staleSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let currentSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 1, nextDueAt: nil),
            selectedCard: try XCTUnwrap(staleSession.advanceCards.first),
            advanceCards: []
        )
        let liveClient = ControllableDailyKanjiLiveReviewClient()
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            now: now
        )

        model.refreshLiveReviewNow()
        await Self.waitUntil {
            liveClient.fetchCount == 1
        }
        model.refreshLiveReviewNow()
        await Self.waitUntil {
            liveClient.fetchCount == 2
        }

        liveClient.resolveFetch(at: 0, with: .success(staleSession))
        await Self.waitUntil {
            liveClient.completedFetches.contains(0)
        }
        await Task.yield()

        XCTAssertEqual(model.liveReviewState, .loading(staleSession: nil))

        model.activate(now: now)
        await Task.yield()
        XCTAssertEqual(liveClient.fetchCount, 2)

        liveClient.resolveFetch(at: 1, with: .success(currentSession))
        await Self.waitUntil {
            model.liveReviewState == .ready(session: currentSession)
        }

        XCTAssertEqual(model.liveReviewState, .ready(session: currentSession))
    }

    @MainActor
    func testSupersededLiveReviewFetchCancellationIsSilent() async throws {
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let liveClient = ControllableDailyKanjiLiveReviewClient()
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            now: now
        )

        model.refreshLiveReviewNow()
        await Self.waitUntil {
            liveClient.fetchCount == 1
        }
        model.refreshLiveReviewNow()
        await Self.waitUntil {
            liveClient.fetchCount == 2
        }

        liveClient.resolveFetch(at: 0, with: .failure(CancellationError()))
        await Self.waitUntil {
            liveClient.completedFetches.contains(0)
        }
        await Task.yield()

        XCTAssertEqual(model.liveReviewState, .loading(staleSession: nil))

        liveClient.resolveFetch(at: 1, with: .success(liveSession))
        await Self.waitUntil {
            model.liveReviewState == .ready(session: liveSession)
        }

        XCTAssertEqual(model.liveReviewState, .ready(session: liveSession))
    }

    @MainActor
    func testFailedBufferedGradeRestoresOriginalSessionAndPresentationClock() async throws {
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let completedSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 0, nextDueAt: nil),
            selectedCard: nil,
            advanceCards: []
        )
        let gradeResult = DailyKanjiLiveReviewGradeResult(
            grade: DailyKanjiLiveReviewGradeResult.Grade(
                cardId: "live-card",
                rating: .good
            ),
            session: completedSession
        )
        let liveClient = MockDailyKanjiLiveReviewClient(
            fetchResults: [.success(liveSession), .success(liveSession)],
            gradeResults: [
                .failure(DailyKanjiLiveReviewClientError.invalidResponse),
                .success(gradeResult)
            ]
        )
        var liveReviewTime = now
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            liveReviewNow: { liveReviewTime },
            now: now
        )

        await model.fetchLiveReviewSession()
        liveReviewTime = now.addingTimeInterval(5)
        await model.gradeLiveReviewNow(card: try XCTUnwrap(liveSession.selectedCard), rating: .good)

        XCTAssertEqual(liveClient.gradeRequests[0].responseMs, 5_000)
        XCTAssertEqual(
            model.liveReviewState,
            .failed(
                message: "Review server returned an invalid response.",
                staleSession: liveSession
            )
        )
        XCTAssertEqual(model.liveReviewState.session?.selectedCard?.cardId, "live-card")
        XCTAssertEqual(model.liveReviewState.session?.advanceCards, liveSession.advanceCards)

        liveReviewTime = now.addingTimeInterval(8)
        await model.fetchLiveReviewSession()
        liveReviewTime = now.addingTimeInterval(10)
        await model.gradeLiveReviewNow(card: try XCTUnwrap(liveSession.selectedCard), rating: .good)

        XCTAssertEqual(liveClient.gradeRequests[1].responseMs, 10_000)
        XCTAssertEqual(model.liveReviewState, .ready(session: completedSession))
    }

    @MainActor
    func testSameCardLiveReviewRefetchPreservesPresentationClock() async throws {
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let completedSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 0, nextDueAt: nil),
            selectedCard: nil,
            advanceCards: []
        )
        let liveClient = MockDailyKanjiLiveReviewClient(
            fetchResults: [.success(liveSession), .success(liveSession)],
            gradeResults: [
                .success(
                    DailyKanjiLiveReviewGradeResult(
                        grade: DailyKanjiLiveReviewGradeResult.Grade(
                            cardId: "live-card",
                            rating: .easy
                        ),
                        session: completedSession
                    )
                )
            ]
        )
        var liveReviewTime = now
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            liveReviewNow: { liveReviewTime },
            now: now
        )

        await model.fetchLiveReviewSession()
        liveReviewTime = now.addingTimeInterval(5)
        await model.fetchLiveReviewSession()
        liveReviewTime = now.addingTimeInterval(8)
        await model.gradeLiveReviewNow(card: try XCTUnwrap(liveSession.selectedCard), rating: .easy)

        XCTAssertEqual(liveClient.gradeRequests[0].responseMs, 8_000)
    }

    @MainActor
    func testDifferentCardLiveReviewRefetchResetsPresentationClock() async throws {
        let liveSession = try JSONDecoder().decode(
            DailyKanjiLiveReviewSession.self,
            from: Self.liveReviewSessionJSON
        )
        let nextCard = try XCTUnwrap(liveSession.advanceCards.first)
        let nextSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 1, nextDueAt: nil),
            selectedCard: nextCard,
            advanceCards: []
        )
        let completedSession = DailyKanjiLiveReviewSession(
            source: "live",
            queue: DailyKanjiLiveReviewQueue(dueCount: 0, queueCount: 0, nextDueAt: nil),
            selectedCard: nil,
            advanceCards: []
        )
        let liveClient = MockDailyKanjiLiveReviewClient(
            fetchResults: [.success(liveSession), .success(nextSession)],
            gradeResults: [
                .success(
                    DailyKanjiLiveReviewGradeResult(
                        grade: DailyKanjiLiveReviewGradeResult.Grade(
                            cardId: nextCard.cardId,
                            rating: .easy
                        ),
                        session: completedSession
                    )
                )
            ]
        )
        var liveReviewTime = now
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 1),
            liveReviewClient: liveClient,
            liveReviewNow: { liveReviewTime },
            now: now
        )

        await model.fetchLiveReviewSession()
        liveReviewTime = now.addingTimeInterval(5)
        await model.fetchLiveReviewSession()
        liveReviewTime = now.addingTimeInterval(7)
        await model.gradeLiveReviewNow(card: nextCard, rating: .easy)

        XCTAssertEqual(liveClient.gradeRequests[0].responseMs, 2_000)
    }

    @MainActor
    func testNotificationRegistrationRequiresConfiguredLiveReviewClient() async throws {
        let cards = try Self.rankedCards(count: 1)
        let unconfiguredRegistrar = MockDailyKanjiNotificationRegistrar()
        let unconfiguredModel = DailyKanjiAppModel(
            cards: cards,
            liveReviewClient: nil,
            notificationRegistrar: unconfiguredRegistrar,
            now: now
        )

        unconfiguredModel.requestNotificationRegistration()
        await Task.yield()

        XCTAssertEqual(unconfiguredRegistrar.requestCount, 0)

        let configuredRegistrar = MockDailyKanjiNotificationRegistrar()
        let configuredModel = DailyKanjiAppModel(
            cards: cards,
            liveReviewClient: MockDailyKanjiLiveReviewClient(),
            notificationRegistrar: configuredRegistrar,
            now: now
        )

        configuredModel.requestNotificationRegistration()
        await Self.waitUntil {
            configuredRegistrar.requestCount == 1
        }

        XCTAssertEqual(configuredRegistrar.requestCount, 1)
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
            now: Date(timeIntervalSince1970: 15 * 60),
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

    @MainActor
    func testAppModelSelectsMediaScopedPrestudyAndGlobalLastLessonsModes() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let defaultsName = "DailyKanjiScope.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            widgetHistoryStore: DailyKanjiWidgetTimelineHistoryStore(defaults: defaults),
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            now: now
        )

        XCTAssertEqual(model.availableMedia.map(\.slug), ["media-one", "media-two"])
        XCTAssertEqual(model.mediaPickerOptions.map(\.slug), ["media-one", "media-two"])

        model.setDraftStudyMode(.prestudy)
        XCTAssertEqual(model.mediaPickerOptions.map(\.slug), ["media-one"])
        model.applyStudyScope(now: now)
        XCTAssertEqual(model.selectedMediaSlug, "media-one")
        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertEqual(model.scopedCardCount, 1)

        model.setDraftSelectedMediaSlug("media-two")
        model.applyStudyScope(now: now)
        XCTAssertEqual(model.mediaPickerOptions.map(\.slug), ["media-one"])
        XCTAssertEqual(model.selectedMediaSlug, "media-one")
        XCTAssertEqual(model.scopedCardCount, 1)
        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")

        model.setDraftSelectedMediaSlug("media-one")
        model.applyStudyScope(now: now)
        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")

        model.setDraftStudyMode(.lastLessonsHardAgain)
        model.applyStudyScope(now: now)
        XCTAssertNil(model.selectedMediaSlug)
        XCTAssertEqual(model.selectedCard?.cardId, "last-one")
        XCTAssertEqual(model.scopedCardCount, 2)

        model.setDraftSelectedMediaSlug("media-two")
        model.applyStudyScope(now: now)
        XCTAssertEqual(model.selectedStudyMode, .lastLessonsHardAgain)
        XCTAssertNil(model.selectedMediaSlug)
        XCTAssertEqual(model.selectedCard?.cardId, "last-one")

        model.setDraftStudyMode(.daily)
        model.setDraftSelectedMediaSlug(nil)
        model.applyStudyScope(now: now)
        XCTAssertNil(model.selectedMediaSlug)
        XCTAssertEqual(model.selectedCard?.cardId, "daily-global")
    }

    @MainActor
    func testStudyScopeChangesWaitForExplicitApplyBeforeReloadingWidgets() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let defaultsName = "DailyKanjiScope-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let scopeStore = DailyKanjiStudyScopeStore(defaults: defaults)
        var reloadCount = 0
        let model = DailyKanjiAppModel(
            cards: cards,
            scopeStore: scopeStore,
            reloadTimelines: { reloadCount += 1 },
            now: now
        )

        model.setDraftStudyMode(.prestudy)

        XCTAssertEqual(model.selectedStudyMode, .daily)
        XCTAssertNil(model.selectedMediaSlug)
        XCTAssertEqual(model.draftMediaSlug, "media-one")
        XCTAssertEqual(scopeStore.load(), DailyKanjiStudyScope(studyMode: .daily, mediaSlug: nil))
        XCTAssertEqual(reloadCount, 0)

        model.setDraftSelectedMediaSlug("media-two")

        XCTAssertEqual(model.selectedStudyMode, .daily)
        XCTAssertNil(model.selectedMediaSlug)
        XCTAssertEqual(model.draftMediaSlug, "media-one")
        XCTAssertEqual(scopeStore.load(), DailyKanjiStudyScope(studyMode: .daily, mediaSlug: nil))
        XCTAssertEqual(reloadCount, 0)
    }

    @MainActor
    func testDraftModeChangesResetMediaSelectionForTheNewMode() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let defaultsName = "DailyKanjiScope-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let model = DailyKanjiAppModel(
            cards: cards,
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            now: now
        )

        model.setDraftStudyMode(.prestudy)
        XCTAssertEqual(model.draftStudyMode, .prestudy)
        XCTAssertEqual(model.draftMediaSlug, "media-one")

        model.applyStudyScope(now: now)
        model.setDraftStudyMode(.daily)
        XCTAssertEqual(model.draftStudyMode, .daily)
        XCTAssertNil(model.draftMediaSlug)

        model.applyStudyScope(now: now)
        model.setDraftStudyMode(.lastLessonsHardAgain)
        XCTAssertEqual(model.draftStudyMode, .lastLessonsHardAgain)
        XCTAssertNil(model.draftMediaSlug)

        model.setDraftSelectedMediaSlug("media-two")
        XCTAssertNil(model.draftMediaSlug)
    }

    @MainActor
    func testApplyingStudyScopePersistsAndReloadsWidgetTimelines() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let defaultsName = "DailyKanjiScope-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let scopeStore = DailyKanjiStudyScopeStore(defaults: defaults)
        var reloadCount = 0
        let model = DailyKanjiAppModel(
            cards: cards,
            scopeStore: scopeStore,
            reloadTimelines: { reloadCount += 1 },
            now: now
        )

        model.setDraftStudyMode(.prestudy)
        model.applyStudyScope(now: now)

        XCTAssertEqual(
            scopeStore.load(),
            DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-one")
        )
        XCTAssertEqual(reloadCount, 1)

        model.setDraftSelectedMediaSlug("media-two")
        model.applyStudyScope(now: now)

        XCTAssertEqual(
            scopeStore.load(),
            DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-one")
        )
        XCTAssertEqual(model.selectedMediaSlug, "media-one")
        XCTAssertEqual(model.scopedCardCount, 1)
        XCTAssertEqual(reloadCount, 1)
    }

    @MainActor
    func testApplyingStudyScopeRecordsTheCardShownImmediately() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let defaultsName = "DailyKanjiHistory-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let historyStore = DailyKanjiHistoryStore(defaults: defaults)
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: historyStore,
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            now: now
        )

        model.setDraftStudyMode(.prestudy)
        model.applyStudyScope(now: now.addingTimeInterval(5))

        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertEqual(historyStore.allItems().map(\.cardId), ["prestudy-one"])
    }

    @MainActor
    func testStartupNormalizesPersistedEmptyPrestudyScopeAndPersistsCorrection() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let defaultsName = "DailyKanjiScope-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let scopeStore = DailyKanjiStudyScopeStore(defaults: defaults)
        scopeStore.save(DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-two"))
        var reloadCount = 0

        let model = DailyKanjiAppModel(
            cards: cards,
            scopeStore: scopeStore,
            reloadTimelines: { reloadCount += 1 },
            now: now
        )

        XCTAssertEqual(model.selectedStudyMode, .prestudy)
        XCTAssertEqual(model.selectedMediaSlug, "media-one")
        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertEqual(model.scopedCardCount, 1)
        XCTAssertEqual(
            scopeStore.load(),
            DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-one")
        )
        XCTAssertEqual(reloadCount, 1)
    }

    @MainActor
    func testStartupFallsBackToDailyWhenPersistedPrestudyHasNoAvailableCards() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let defaultsName = "DailyKanjiScope-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let scopeStore = DailyKanjiStudyScopeStore(defaults: defaults)
        scopeStore.save(DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-one"))
        var reloadCount = 0

        let model = DailyKanjiAppModel(
            cards: cards,
            scopeStore: scopeStore,
            reloadTimelines: { reloadCount += 1 },
            now: now
        )

        XCTAssertEqual(model.selectedStudyMode, .daily)
        XCTAssertNil(model.selectedMediaSlug)
        XCTAssertEqual(model.selectedCard?.cardId, "hard")
        XCTAssertEqual(model.scopedCardCount, 2)
        XCTAssertEqual(scopeStore.load(), DailyKanjiStudyScope(studyMode: .daily, mediaSlug: nil))
        XCTAssertEqual(reloadCount, 1)
    }

    @MainActor
    func testSuccessfulSyncNormalizesPersistedScopeAfterCardReplacement() async throws {
        let initialDataset = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON)
        let syncedDataset = Self.datasetMovingPrestudyCardToMediaTwo(initialDataset)
        let defaultsName = "DailyKanjiScope-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let temporaryDirectory = try Self.makeTemporaryDirectory()
        defer { Self.removeTemporaryDirectory(temporaryDirectory) }
        let scopeStore = DailyKanjiStudyScopeStore(defaults: defaults)
        scopeStore.save(DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-one"))
        let cacheStore = DailyKanjiCacheStore(
            directoryURL: temporaryDirectory.appendingPathComponent("Cache", isDirectory: true)
        )
        let syncer = MockDailyKanjiSyncer(result: .success(syncedDataset))
        var reloadCount = 0
        let model = DailyKanjiAppModel(
            cards: initialDataset.cards,
            cacheStore: cacheStore,
            scopeStore: scopeStore,
            syncer: syncer,
            reloadTimelines: { reloadCount += 1 },
            now: now
        )

        await model.syncNow(now: now, force: true)

        XCTAssertEqual(model.selectedStudyMode, .prestudy)
        XCTAssertEqual(model.selectedMediaSlug, "media-two")
        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertEqual(model.scopedCardCount, 1)
        XCTAssertEqual(
            scopeStore.load(),
            DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-two")
        )
        XCTAssertEqual(reloadCount, 1)
    }

    func testWidgetTimelineUsesOnlyDailyModeCards() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let dates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: Date(timeIntervalSince1970: 0),
            count: 4
        )

        let timelineCardIds = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: dates
        ).map(\.cardId)

        XCTAssertEqual(timelineCardIds, Array(repeating: "daily-global", count: 4))
    }

    func testWidgetTimelineUsesPersistedStudyScopeInputs() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let dates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: Date(timeIntervalSince1970: 0),
            count: 4
        )

        let timelineCardIds = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: dates,
            mediaSlug: "media-one",
            studyMode: .prestudy
        ).map(\.cardId)

        XCTAssertEqual(timelineCardIds, Array(repeating: "prestudy-one", count: 4))
    }

    func testWidgetTimelineResolvesStalePrestudyScopeBeforeSelectingCards() throws {
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let rawScope = DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-two")
        let resolvedScope = DailyKanjiStudyScopeResolver.resolve(rawScope, cards: cards)
        let dates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: Date(timeIntervalSince1970: 0),
            count: 4
        )

        let timelineCardIds = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: dates,
            mediaSlug: resolvedScope.mediaSlug,
            studyMode: resolvedScope.studyMode
        ).map(\.cardId)

        XCTAssertEqual(
            resolvedScope,
            DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-one")
        )
        XCTAssertEqual(timelineCardIds, Array(repeating: "prestudy-one", count: 4))
        XCTAssertFalse(timelineCardIds.contains(DailyKanjiSampleData.card.cardId))
    }

    func testWidgetRefreshUsesNextRotationSlotBoundary() {
        let date = Date(timeIntervalSince1970: (60 * 60) + 123)

        XCTAssertEqual(
            DailyKanjiSelector.nextWidgetRefreshDate(after: date),
            Date(timeIntervalSince1970: (60 * 60) + (15 * 60))
        )
    }

    func testWidgetTimelineDatesPrebuildCanonicalFifteenMinuteRotationSlots() {
        let now = Date(timeIntervalSince1970: (60 * 60) + 123)

        XCTAssertEqual(
            DailyKanjiSelector.widgetTimelineDates(startingAt: now, count: 4),
            [
                Date(timeIntervalSince1970: 60 * 60),
                Date(timeIntervalSince1970: (60 * 60) + (15 * 60)),
                Date(timeIntervalSince1970: (60 * 60) + (30 * 60)),
                Date(timeIntervalSince1970: (60 * 60) + (45 * 60))
            ]
        )
    }

    func testWidgetSnapshotAndTimelineUseTheSameFullRotationPool() throws {
        let cards = try Self.rankedCards(count: 120)
        let now = Date(
            timeIntervalSince1970: 50 * DailyKanjiSelector.widgetSlotDuration
        )
        let snapshotDates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: now,
            count: 1
        )
        let timelineDates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: now
        )
        let snapshotCard = try XCTUnwrap(
            DailyKanjiSelector.widgetTimelineCards(
                cards: cards,
                dates: snapshotDates
            ).first
        )
        let firstTimelineCard = try XCTUnwrap(
            DailyKanjiSelector.widgetTimelineCards(
                cards: cards,
                dates: timelineDates
            ).first
        )
        let legacyWindowCard = DailyKanjiSelector.select(
            cards: cards,
            history: [],
            now: now,
            mode: .widgetTimeline
        )

        XCTAssertEqual(snapshotCard.cardId, firstTimelineCard.cardId)
        XCTAssertEqual(snapshotCard.cardId, "card-50")
        XCTAssertNotEqual(snapshotCard.cardId, legacyWindowCard?.cardId)
    }

    func testWidgetProviderUsesOneTimelineBuilderForSnapshotAndTimeline() throws {
        let source = try Self.widgetSourceFileContents()
        guard
            let providerStart = source.range(of: "struct KanjiProvider"),
            let providerEnd = source.range(of: "\nenum DailyKanjiLockScreenWidgetRole")
        else {
            XCTFail("Could not isolate KanjiProvider.")
            return
        }
        let providerBlock = String(
            source[providerStart.lowerBound..<providerEnd.lowerBound]
        )

        XCTAssertTrue(providerBlock.contains("DailyKanjiRepository(mode: .widget)"))
        XCTAssertTrue(
            providerBlock.contains("timelineEntries(startingAt: now, count: 1)")
        )
        XCTAssertTrue(
            providerBlock.contains("let entries = timelineEntries(startingAt: now)")
        )
        XCTAssertFalse(providerBlock.contains("mode: .widgetTimeline"))
    }

    func testWidgetTimelineDatesStaySynchronizedWithinTheSameRotationSlot() throws {
        let cards = try Self.rankedCards(count: 120)
        let earlyRequest = Date(timeIntervalSince1970: (72 * 60 * 60) + 1)
        let lateRequest = Date(timeIntervalSince1970: (72 * 60 * 60) + (14 * 60) + 59)

        let earlyDates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: earlyRequest,
            count: 8
        )
        let lateDates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: lateRequest,
            count: 8
        )

        XCTAssertEqual(earlyDates, lateDates)
        XCTAssertEqual(
            DailyKanjiSelector.widgetTimelineCards(cards: cards, dates: earlyDates).map(\.cardId),
            DailyKanjiSelector.widgetTimelineCards(cards: cards, dates: lateDates).map(\.cardId)
        )
    }

    func testWidgetTimelineDatesKeepOverlappingBoundarySlotsSynchronized() throws {
        let cards = try Self.rankedCards(count: 120)
        let beforeBoundary = Date(timeIntervalSince1970: (72 * 60 * 60) + (14 * 60) + 59)
        let afterBoundary = Date(timeIntervalSince1970: (72 * 60 * 60) + (15 * 60) + 1)

        let beforeDates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: beforeBoundary,
            count: 4
        )
        let afterDates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: afterBoundary,
            count: 4
        )
        let beforeCards = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: beforeDates
        )
        let afterCards = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: afterDates
        )

        XCTAssertEqual(beforeDates[1], afterDates[0])
        XCTAssertEqual(beforeCards[1].cardId, afterCards[0].cardId)
    }

    func testWidgetTimelineCardsAvoidRepeatingCardsAcrossTwentyFourHoursWhenPossible() throws {
        let cards = try Self.rankedCards(count: 120)
        let dates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: Date(timeIntervalSince1970: (72 * 60 * 60) + 60),
            count: 96
        )

        let selectedCards = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: dates
        )

        XCTAssertEqual(selectedCards.count, 96)
        XCTAssertEqual(Set(selectedCards.map(\.cardId)).count, 96)
    }

    func testWidgetTimelineCardsPreferPitchKnownCardsWhileFillingTwentyFourHourPool() throws {
        let pitchKnownIndices = Set([10, 30])
        let pitchAccents: [Int?] = (0..<120).map { index in
            pitchKnownIndices.contains(index) ? 1 : nil
        }
        let cards = try Self.rankedCards(count: 120, pitchAccents: pitchAccents)
        let dates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: Date(timeIntervalSince1970: 0),
            count: 96
        )

        let selectedCards = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: dates
        )

        XCTAssertEqual(selectedCards.count, 96)
        XCTAssertEqual(Set(selectedCards.map(\.cardId)).count, 96)
        XCTAssertEqual(selectedCards.prefix(2).map(\.cardId), ["card-10", "card-30"])
        XCTAssertTrue(selectedCards.prefix(2).allSatisfy { $0.entry.pitchAccent != nil })
        XCTAssertTrue(selectedCards.dropFirst(2).contains { $0.entry.pitchAccent == nil })
    }

    func testWidgetTimelineCardsFallBackToRankedCardsWhenNoCardsHaveKnownPitch() throws {
        let cards = try Self.rankedCards(count: 4)
        let dates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: Date(timeIntervalSince1970: 0),
            count: 4
        )

        let timelineCardIds = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: dates
        ).map(\.cardId)

        XCTAssertEqual(timelineCardIds, ["card-0", "card-1", "card-2", "card-3"])
    }

    func testWidgetTimelineRegenerationDoesNotRepeatAlreadyShownOverlappingSlots() throws {
        let cards = try Self.rankedCards(count: 120)
        let firstTimelineDates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: Date(timeIntervalSince1970: 0),
            count: 8
        )
        let firstTimelineCards = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: firstTimelineDates
        )
        let reloadTime = Date(timeIntervalSince1970: 30 * 60)
        let regeneratedDates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: reloadTime,
            count: 8
        )
        let regeneratedCards = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: regeneratedDates
        )
        let alreadyShownBeforeReload = Set(
            zip(firstTimelineDates, firstTimelineCards)
                .filter { date, _ in date < reloadTime }
                .map { _, card in card.cardId }
        )

        XCTAssertFalse(alreadyShownBeforeReload.contains(regeneratedCards[0].cardId))
    }

    func testSupportedWidgetFamiliesKeepLockScreenOnRectangularLayout() {
        XCTAssertEqual(
            DailyKanjiWidgetFamilies.supported,
            [.systemSmall, .systemMedium, .accessoryRectangular]
        )
        XCTAssertEqual(
            DailyKanjiWidgetFamilies.readingSupported,
            [.accessoryRectangular]
        )
        XCTAssertFalse(DailyKanjiWidgetFamilies.supported.contains(.accessoryCircular))
        XCTAssertFalse(DailyKanjiWidgetFamilies.supported.contains(.accessoryInline))
        XCTAssertFalse(DailyKanjiWidgetFamilies.readingSupported.contains(.systemMedium))
    }

    func testWidgetTimelineHistoryPreservesCompletedSlotsAndReplacesCurrentAndFuture() {
        let defaultsName = "DailyKanjiWidgetHistory.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let store = DailyKanjiWidgetTimelineHistoryStore(defaults: defaults)
        let firstSlot = Date(timeIntervalSince1970: 72 * 60 * 60)
        let secondSlot = firstSlot.addingTimeInterval(15 * 60)
        let thirdSlot = secondSlot.addingTimeInterval(15 * 60)

        store.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: firstSlot,
                    cardId: "first-original"
                ),
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: secondSlot,
                    cardId: "second-original"
                ),
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: thirdSlot,
                    cardId: "third-original"
                )
            ],
            generatedAt: firstSlot.addingTimeInterval(60)
        )
        store.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: secondSlot,
                    cardId: "second-replacement"
                ),
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: thirdSlot,
                    cardId: "third-replacement"
                )
            ],
            generatedAt: secondSlot.addingTimeInterval(60)
        )

        let items = store.recentItems(now: thirdSlot.addingTimeInterval(60))
        XCTAssertEqual(
            items.map(\.cardId),
            ["third-replacement", "second-replacement", "first-original"]
        )
        XCTAssertEqual(items.map(\.slotStart), [thirdSlot, secondSlot, firstSlot])
    }

    func testWidgetTimelineHistoryRejectsOlderWritesAndDoesNotExposeFutureSlots() {
        let defaultsName = "DailyKanjiWidgetHistory.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let store = DailyKanjiWidgetTimelineHistoryStore(defaults: defaults)
        let currentSlot = Date(timeIntervalSince1970: 72 * 60 * 60)
        let futureSlot = currentSlot.addingTimeInterval(15 * 60)

        store.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: currentSlot,
                    cardId: "current-new"
                ),
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: futureSlot,
                    cardId: "future-new"
                )
            ],
            generatedAt: currentSlot.addingTimeInterval(0.8)
        )
        store.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: currentSlot,
                    cardId: "stale-current"
                )
            ],
            generatedAt: currentSlot.addingTimeInterval(0.2)
        )

        XCTAssertEqual(
            store.recentItems(now: currentSlot.addingTimeInterval(180)).map(\.cardId),
            ["current-new"]
        )
        XCTAssertEqual(
            store.recentItems(now: futureSlot.addingTimeInterval(60)).map(\.cardId),
            ["future-new", "current-new"]
        )
    }

    func testWidgetTimelineHistoryPrunesCompletedSlotsOutsideRetention() {
        let defaultsName = "DailyKanjiWidgetHistory.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let store = DailyKanjiWidgetTimelineHistoryStore(defaults: defaults, retentionDays: 3)
        let expiredSlot = Date(timeIntervalSince1970: 0)
        let currentSlot = expiredSlot.addingTimeInterval((4 * 24 * 60 * 60) + (15 * 60))

        store.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: expiredSlot,
                    cardId: "expired"
                )
            ],
            generatedAt: expiredSlot.addingTimeInterval(60)
        )
        store.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: currentSlot,
                    cardId: "current"
                )
            ],
            generatedAt: currentSlot.addingTimeInterval(60)
        )

        XCTAssertEqual(
            store.recentItems(now: currentSlot.addingTimeInterval(60)).map(\.cardId),
            ["current"]
        )
    }

    @MainActor
    func testFirstActivationRecordsInitialAppSelectionAndUniqueRecentWidgetCards() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let now = Date(timeIntervalSince1970: (72 * 60 * 60) + 60)
        let cards = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards
        let widgetHistoryStore = DailyKanjiWidgetTimelineHistoryStore(defaults: defaults)
        let currentSlot = DailyKanjiSelector.currentWidgetSlotStart(for: now)
        let previousSlot = currentSlot.addingTimeInterval(-15 * 60)
        widgetHistoryStore.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: previousSlot,
                    cardId: "stable"
                ),
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: currentSlot,
                    cardId: "hard"
                )
            ],
            generatedAt: previousSlot.addingTimeInterval(60)
        )
        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            widgetHistoryStore: widgetHistoryStore,
            now: now
        )

        model.activate(now: now)

        XCTAssertEqual(model.recentHistory.count, 2)
        XCTAssertEqual(model.recentHistory.first?.source, .app)
        XCTAssertEqual(model.recentHistory.first?.shownAt, now)
        XCTAssertEqual(model.recentHistory.dropFirst().first?.source, .widget)
        XCTAssertEqual(
            model.recentHistory.dropFirst().first?.shownAt,
            previousSlot
        )
    }

    @MainActor
    func testPersistedWidgetHistoryDoesNotChangeWithTheCurrentStudyScope() throws {
        let defaultsName = "DailyKanjiWidgetHistory.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let cards = try DailyKanjiDataset.decode(jsonData: Self.modeScopedDatasetJSON).cards
        let scopeStore = DailyKanjiStudyScopeStore(defaults: defaults)
        scopeStore.save(
            DailyKanjiStudyScope(studyMode: .prestudy, mediaSlug: "media-one")
        )
        let widgetHistoryStore = DailyKanjiWidgetTimelineHistoryStore(defaults: defaults)
        let pastSlot = DailyKanjiSelector.currentWidgetSlotStart(for: now)
            .addingTimeInterval(-15 * 60)
        widgetHistoryStore.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: pastSlot,
                    cardId: "daily-global"
                )
            ],
            generatedAt: pastSlot.addingTimeInterval(60)
        )

        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            widgetHistoryStore: widgetHistoryStore,
            scopeStore: scopeStore,
            now: now
        )

        XCTAssertEqual(model.selectedStudyMode, .prestudy)
        XCTAssertEqual(model.selectedCard?.cardId, "prestudy-one")
        XCTAssertEqual(
            model.recentHistory.filter { $0.source == .widget }.map(\.cardId),
            ["daily-global"]
        )
        XCTAssertEqual(
            model.recentHistory.first { $0.source == .widget }?.shownAt,
            pastSlot
        )
    }

    @MainActor
    func testPersistedWidgetHistorySurvivesRerankingAndDrivesAntiRepeat() throws {
        let defaultsName = "DailyKanjiWidgetHistory.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let cards = try Self.rankedCards(count: 2)
        let widgetHistoryStore = DailyKanjiWidgetTimelineHistoryStore(defaults: defaults)
        let pastSlot = DailyKanjiSelector.currentWidgetSlotStart(for: now)
            .addingTimeInterval(-15 * 60)
        widgetHistoryStore.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: pastSlot,
                    cardId: "card-0"
                )
            ],
            generatedAt: pastSlot.addingTimeInterval(60)
        )

        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            widgetHistoryStore: widgetHistoryStore,
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            now: now
        )

        XCTAssertEqual(model.selectedCard?.cardId, "card-1")
        XCTAssertEqual(
            model.recentHistory.filter { $0.source == .widget }.map(\.cardId),
            ["card-0"]
        )
    }

    @MainActor
    func testRemovedWidgetHistoryCardIsDroppedInsteadOfSubstituted() throws {
        let defaultsName = "DailyKanjiWidgetHistory.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let cards = try Self.rankedCards(count: 2)
        let widgetHistoryStore = DailyKanjiWidgetTimelineHistoryStore(defaults: defaults)
        let pastSlot = DailyKanjiSelector.currentWidgetSlotStart(for: now)
            .addingTimeInterval(-15 * 60)
        widgetHistoryStore.replaceTimeline(
            entries: [
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: pastSlot,
                    cardId: "removed-card"
                )
            ],
            generatedAt: pastSlot.addingTimeInterval(60)
        )

        let model = DailyKanjiAppModel(
            cards: cards,
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            widgetHistoryStore: widgetHistoryStore,
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            now: now
        )

        XCTAssertFalse(model.recentHistory.contains { $0.source == .widget })
        XCTAssertEqual(model.selectedCard?.cardId, "card-0")
    }

    @MainActor
    func testEmptyWidgetHistoryDoesNotSynthesizeLegacyRows() throws {
        let defaultsName = "DailyKanjiWidgetHistory.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }

        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 2),
            historyStore: DailyKanjiHistoryStore(defaults: defaults),
            widgetHistoryStore: DailyKanjiWidgetTimelineHistoryStore(defaults: defaults),
            scopeStore: DailyKanjiStudyScopeStore(defaults: defaults),
            now: now
        )

        XCTAssertTrue(model.recentHistory.isEmpty)
        XCTAssertEqual(model.selectedCard?.cardId, "card-0")
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

        XCTAssertEqual(model.selectedCard?.cardId, "card-0")

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

    func testPresentationHistoryMergesNewestUniqueCardExposureEventsFirst() {
        let appItems = [
            DailyKanjiHistoryItem(
                cardId: "stable",
                shownAt: Date(timeIntervalSince1970: (12 * 60 * 60) + 120)
            ),
            DailyKanjiHistoryItem(
                cardId: "hard",
                shownAt: Date(timeIntervalSince1970: (12 * 60 * 60) + 30)
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

        XCTAssertEqual(merged.map(\.cardId), ["stable", "hard"])
        XCTAssertEqual(merged.map(\.source), [.app, .app])
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

    func testAppSelectionUsesTheLastTwentyFourHoursOfWidgetHistory() throws {
        let cards = try Self.rankedCards(count: 120)
        let now = Date(timeIntervalSince1970: (72 * 60 * 60) + 60)
        let defaultsName = "DailyKanjiWidgetHistory.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let store = DailyKanjiWidgetTimelineHistoryStore(defaults: defaults)
        let firstSlot = DailyKanjiSelector.currentWidgetSlotStart(for: now)
            .addingTimeInterval(-95 * 15 * 60)
        let dates = DailyKanjiSelector.widgetTimelineDates(
            startingAt: firstSlot,
            count: 96
        )
        let timelineCards = DailyKanjiSelector.widgetTimelineCards(
            cards: cards,
            dates: dates
        )
        store.replaceTimeline(
            entries: zip(dates, timelineCards).map { date, card in
                DailyKanjiWidgetTimelineHistoryItem(
                    slotStart: date,
                    cardId: card.cardId
                )
            },
            generatedAt: firstSlot.addingTimeInterval(60)
        )
        let widgetSelectionHistory = store.recentSelectionItems(now: now)
        let selected = DailyKanjiSelector.select(
            cards: cards,
            history: widgetSelectionHistory,
            now: now,
            mode: .appOpen
        )

        XCTAssertEqual(widgetSelectionHistory.count, 96)
        XCTAssertEqual(Set(widgetSelectionHistory.map(\.cardId)).count, 96)
        XCTAssertFalse(Set(widgetSelectionHistory.map(\.cardId)).contains(selected?.cardId ?? ""))
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

    func testLockScreenCardWidgetUsesOnlyTheFrontText() throws {
        let card = try Self.cardReplacingBackAndMeaning(
            back: "けが — ferita",
            meaning: "ferita"
        )

        XCTAssertEqual(card.lockScreenFrontText, "観点")
    }

    func testLockScreenReadingWidgetUsesShortTranslationInsteadOfNotes() throws {
        let card = try Self.cardReplacingBackMeaningAndNotes(
            back: "けが — ferita",
            meaning: "ferita",
            notes: "Long note that should stay out of the lock screen reading widget."
        )

        XCTAssertEqual(card.lockScreenTranslationText, "ferita")
    }

    func testLockScreenTranslationFallsBackByStrippingLeadingReading() throws {
        let card = try Self.cardReplacingBackAndMeaning(
            back: "けが — ferita",
            meaning: ""
        )

        XCTAssertEqual(card.lockScreenTranslationText, "ferita")
    }

    func testLockScreenReadingWidgetTranslationUsesWhiteForeground() throws {
        let source = try Self.widgetSourceFileContents()
        guard let viewStart = source.range(of: "private struct DailyKanjiLockScreenReadingView") else {
            XCTFail("Could not find the lock screen reading widget view.")
            return
        }

        let viewSource = source[viewStart.lowerBound...]
        guard let viewEnd = viewSource.range(of: "\nprivate struct DailyKanjiPitchAccentReadingView") else {
            XCTFail("Could not isolate the lock screen reading widget view.")
            return
        }

        let viewBlock = String(viewSource[..<viewEnd.lowerBound])
        guard let textStart = viewBlock.range(of: "Text(card.lockScreenTranslationText)") else {
            XCTFail("Could not find the lock screen translation text view.")
            return
        }

        let textBlockSource = viewBlock[textStart.lowerBound...]
        guard let textBlockEnd = textBlockSource.range(
            of: "\n        }\n        .frame(maxWidth: .infinity"
        ) else {
            XCTFail("Could not isolate the lock screen translation text view.")
            return
        }

        let textBlock = String(textBlockSource[..<textBlockEnd.lowerBound])
        XCTAssertTrue(textBlock.contains(".foregroundStyle(.white)"))
        XCTAssertFalse(textBlock.contains(".foregroundStyle(.secondary)"))
    }

    func testLockScreenPitchAccentPatternMarksDropAfterAccentMora() throws {
        let card = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards[0]
        let pattern = try XCTUnwrap(card.lockScreenPitchAccentPattern)

        XCTAssertEqual(pattern.moras.map(\.text), ["か", "ん", "て", "ん"])
        XCTAssertEqual(pattern.moras.map(\.isHigh), [false, true, false, false])
    }

    func testLockScreenPitchAccentPatternCombinesContractedKana() throws {
        let card = try Self.cardReplacingReadingAndPitchAccent(
            reading: "きょう",
            pitchAccent: 1
        )
        let pattern = try XCTUnwrap(card.lockScreenPitchAccentPattern)

        XCTAssertEqual(pattern.moras.map(\.text), ["きょ", "う"])
        XCTAssertEqual(pattern.moras.map(\.isHigh), [true, false])
    }

    func testLockScreenPitchAccentRendererKeepsContractedMoraReadable() throws {
        let source = try Self.widgetSourceFileContents()
        guard let viewStart = source.range(of: "private struct DailyKanjiPitchAccentReadingView") else {
            XCTFail("Could not find the pitch accent reading view.")
            return
        }

        let viewSource = source[viewStart.lowerBound...]
        guard let viewEnd = viewSource.range(of: "\nstruct DailyKanjiWidget") else {
            XCTFail("Could not isolate the pitch accent reading view.")
            return
        }

        let viewBlock = String(viewSource[..<viewEnd.lowerBound])
        XCTAssertTrue(viewBlock.contains("DailyKanjiMoraTextView(text: mora.text"))
        XCTAssertFalse(viewBlock.contains("Text(mora.text)"))
        XCTAssertTrue(viewBlock.contains("isContractedKana"))
        XCTAssertTrue(viewBlock.contains("contractedMoraWidthExpansion"))
        XCTAssertTrue(viewBlock.contains("contractedCharacterSpacing"))
        XCTAssertFalse(viewBlock.contains("-max(fontSize"))
    }

    func testLockScreenPitchAccentPatternMarksHeibanAfterFirstMoraHigh() throws {
        let card = try DailyKanjiDataset.decode(jsonData: Self.datasetJSON).cards[1]
        let pattern = try XCTUnwrap(card.lockScreenPitchAccentPattern)

        XCTAssertEqual(pattern.moras.map(\.text), ["あ", "ん", "て", "い"])
        XCTAssertEqual(pattern.moras.map(\.isHigh), [false, true, true, true])
    }

    func testLockScreenPitchAccentPatternBuildsContinuousHeibanTrace() throws {
        let card = try Self.cardReplacingReadingAndPitchAccent(
            reading: "けが",
            pitchAccent: 0
        )
        let pattern = try XCTUnwrap(card.lockScreenPitchAccentPattern)

        XCTAssertEqual(pattern.lowerRails, [
            DailyKanjiPitchAccentPattern.Rail(start: 0, length: 1, tail: false)
        ])
        XCTAssertEqual(pattern.upperRails, [
            DailyKanjiPitchAccentPattern.Rail(start: 1, length: 1, tail: true)
        ])
        XCTAssertEqual(pattern.connectors, [
            DailyKanjiPitchAccentPattern.Connector(boundary: 1, kind: .rise)
        ])
    }

    func testLockScreenPitchAccentPatternBuildsContinuousNakadakaTrace() throws {
        let card = try Self.cardReplacingReadingAndPitchAccent(
            reading: "しんか",
            pitchAccent: 2
        )
        let pattern = try XCTUnwrap(card.lockScreenPitchAccentPattern)

        XCTAssertEqual(pattern.lowerRails, [
            DailyKanjiPitchAccentPattern.Rail(start: 0, length: 1, tail: false),
            DailyKanjiPitchAccentPattern.Rail(start: 2, length: 1, tail: true)
        ])
        XCTAssertEqual(pattern.upperRails, [
            DailyKanjiPitchAccentPattern.Rail(start: 1, length: 1, tail: false)
        ])
        XCTAssertEqual(pattern.connectors, [
            DailyKanjiPitchAccentPattern.Connector(boundary: 1, kind: .rise),
            DailyKanjiPitchAccentPattern.Connector(boundary: 2, kind: .drop)
        ])
    }

    func testLockScreenPitchAccentPatternBuildsContinuousOdakaTrace() throws {
        let card = try Self.cardReplacingReadingAndPitchAccent(
            reading: "かんてん",
            pitchAccent: 4
        )
        let pattern = try XCTUnwrap(card.lockScreenPitchAccentPattern)

        XCTAssertEqual(pattern.lowerRails, [
            DailyKanjiPitchAccentPattern.Rail(start: 0, length: 1, tail: false)
        ])
        XCTAssertEqual(pattern.upperRails, [
            DailyKanjiPitchAccentPattern.Rail(start: 1, length: 3, tail: false)
        ])
        XCTAssertEqual(pattern.connectors, [
            DailyKanjiPitchAccentPattern.Connector(boundary: 1, kind: .rise),
            DailyKanjiPitchAccentPattern.Connector(boundary: 4, kind: .drop)
        ])
    }

    func testLockScreenPitchAccentPatternAllowsFinalMoraDrop() throws {
        let card = try Self.cardReplacingReadingAndPitchAccent(
            reading: "かんてん",
            pitchAccent: 4
        )
        let pattern = try XCTUnwrap(card.lockScreenPitchAccentPattern)

        XCTAssertEqual(pattern.moras.map(\.isHigh), [false, true, true, true])
    }

    func testLockScreenPitchAccentPatternRequiresReadingAndValidPitch() throws {
        XCTAssertNil(
            try Self.cardReplacingReadingAndPitchAccent(
                reading: nil,
                pitchAccent: 2
            ).lockScreenPitchAccentPattern
        )
        XCTAssertNil(
            try Self.cardReplacingReadingAndPitchAccent(
                reading: "かんてん",
                pitchAccent: nil
            ).lockScreenPitchAccentPattern
        )
        XCTAssertNil(
            try Self.cardReplacingReadingAndPitchAccent(
                reading: "かんてん",
                pitchAccent: 5
            ).lockScreenPitchAccentPattern
        )
    }

    func testLockScreenPitchAccentLabelRequiresValidPattern() throws {
        XCTAssertNil(
            try Self.cardReplacingReadingAndPitchAccent(
                reading: nil,
                pitchAccent: 2
            ).lockScreenPitchAccentText
        )
        XCTAssertNil(
            try Self.cardReplacingReadingAndPitchAccent(
                reading: "かんてん",
                pitchAccent: -1
            ).lockScreenPitchAccentText
        )
        XCTAssertNil(
            try Self.cardReplacingReadingAndPitchAccent(
                reading: "かんてん",
                pitchAccent: 5
            ).lockScreenPitchAccentText
        )
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

    func testHomeWidgetForegroundsUseSemanticSystemColors() throws {
        let source = try Self.widgetSourceFileContents()
        guard let mediumStart = source.range(of: "private struct DailyKanjiHomeMediumWidgetView") else {
            XCTFail("Could not find the dedicated medium home widget view.")
            return
        }

        let mediumSource = source[mediumStart.lowerBound...]
        guard let mediumEnd = mediumSource.range(of: "\nprivate struct DailyKanjiHomeSmallWidgetView") else {
            XCTFail("Could not isolate the medium home widget view.")
            return
        }

        let mediumBlock = String(mediumSource[..<mediumEnd.lowerBound])
        XCTAssertFalse(mediumBlock.contains(".foregroundStyle(.white"))
        XCTAssertTrue(mediumBlock.contains(".foregroundStyle(.primary)"))
        XCTAssertTrue(mediumBlock.contains(".foregroundStyle(.secondary)"))

        guard
            let mediumPitchStart = mediumBlock.range(of: "DailyKanjiPitchAccentReadingView("),
            let mediumPitchEnd = mediumBlock[mediumPitchStart.lowerBound...].range(
                of: "\n                    .layoutPriority(2)"
            )
        else {
            XCTFail("Could not isolate the medium home pitch accent branch.")
            return
        }

        let mediumPitchBlock = String(
            mediumBlock[mediumPitchStart.lowerBound..<mediumPitchEnd.lowerBound]
        )
        XCTAssertTrue(mediumPitchBlock.contains(".foregroundStyle(.secondary)"))

        guard let smallStart = source.range(of: "private struct DailyKanjiHomeSmallWidgetView") else {
            XCTFail("Could not find the dedicated small home widget view.")
            return
        }

        let smallSource = source[smallStart.lowerBound...]
        guard let smallEnd = smallSource.range(of: "\nprivate struct DailyKanjiLockScreenCardView") else {
            XCTFail("Could not isolate the small home widget view.")
            return
        }

        let smallBlock = String(smallSource[..<smallEnd.lowerBound])
        XCTAssertFalse(smallBlock.contains(".foregroundStyle(.white"))
        XCTAssertTrue(smallBlock.contains(".foregroundStyle(.primary)"))
        XCTAssertTrue(smallBlock.contains(".foregroundStyle(.secondary)"))
    }

    func testHomeMediumWidgetUsesSideBySideReadableLayoutWithoutSourceFooter() throws {
        let source = try Self.widgetSourceFileContents()
        guard let viewStart = source.range(of: "private struct DailyKanjiHomeMediumWidgetView") else {
            XCTFail("Could not find the dedicated medium home widget view.")
            return
        }

        let viewSource = source[viewStart.lowerBound...]
        guard let viewEnd = viewSource.range(of: "\nprivate struct DailyKanjiHomeSmallWidgetView") else {
            XCTFail("Could not isolate the medium home widget view.")
            return
        }

        let viewBlock = String(viewSource[..<viewEnd.lowerBound])
        XCTAssertTrue(viewBlock.contains("HStack(alignment: .center"))
        XCTAssertTrue(viewBlock.contains("Text(card.displayFront)"))
        XCTAssertTrue(viewBlock.contains("Text(card.lockScreenTranslationText)"))
        XCTAssertTrue(viewBlock.contains("DailyKanjiPitchAccentReadingView"))
        XCTAssertFalse(viewBlock.contains("Text(card.sourceText)"))
        XCTAssertFalse(viewBlock.contains("Spacer(minLength: 0)"))

        guard
            let frontStart = viewBlock.range(of: "Text(card.displayFront)"),
            let translationStart = viewBlock.range(of: "Text(card.lockScreenTranslationText)"),
            let explanationStart = viewBlock.range(of: "Text(explanation)")
        else {
            XCTFail("Could not find the front, translation, and explanation text in the medium widget view.")
            return
        }

        XCTAssertLessThan(frontStart.lowerBound, translationStart.lowerBound)

        let frontBlock = String(viewBlock[frontStart.lowerBound..<translationStart.lowerBound])
        XCTAssertTrue(frontBlock.contains(".lineLimit(1)"))
        XCTAssertFalse(frontBlock.contains(".lineLimit(2)"))

        let explanationBlock = String(viewBlock[explanationStart.lowerBound...])
        XCTAssertTrue(explanationBlock.contains(".lineLimit(2)"))
    }

    func testHomeSmallWidgetKeepsFrontOnOneLine() throws {
        let source = try Self.widgetSourceFileContents()
        guard let viewStart = source.range(of: "private struct DailyKanjiHomeSmallWidgetView") else {
            XCTFail("Could not find the dedicated small home widget view.")
            return
        }

        let viewSource = source[viewStart.lowerBound...]
        guard let viewEnd = viewSource.range(of: "\nprivate struct DailyKanjiLockScreenCardView") else {
            XCTFail("Could not isolate the small home widget view.")
            return
        }

        let viewBlock = String(viewSource[..<viewEnd.lowerBound])
        guard
            let frontStart = viewBlock.range(of: "Text(card.displayFront)"),
            let translationStart = viewBlock.range(of: "Text(card.lockScreenTranslationText)")
        else {
            XCTFail("Could not find the front and translation text in the small widget view.")
            return
        }

        let frontBlock = String(viewBlock[frontStart.lowerBound..<translationStart.lowerBound])
        XCTAssertTrue(frontBlock.contains(".lineLimit(1)"))
        XCTAssertTrue(frontBlock.contains(".minimumScaleFactor"))
        XCTAssertFalse(frontBlock.contains(".lineLimit(2)"))
    }

    func testRecentHistoryRowsKeepFrontOnOneLine() throws {
        let source = try Self.appSourceFileContents()
        guard let viewStart = source.range(of: "private var historyView") else {
            XCTFail("Could not find historyView.")
            return
        }

        let viewSource = source[viewStart.lowerBound...]
        guard let viewEnd = viewSource.range(of: "\n}\n\n#Preview") else {
            XCTFail("Could not isolate historyView.")
            return
        }

        let viewBlock = String(viewSource[..<viewEnd.lowerBound])
        guard
            let frontStart = viewBlock.range(of: "Text(card.displayFront)"),
            let detailsStart = viewBlock.range(of: "VStack(alignment: .leading, spacing: 2)")
        else {
            XCTFail("Could not find the recent row front and details column.")
            return
        }

        let frontBlock = String(viewBlock[frontStart.lowerBound..<detailsStart.lowerBound])
        XCTAssertTrue(frontBlock.contains(".lineLimit(1)"))
        XCTAssertTrue(frontBlock.contains(".minimumScaleFactor"))
        XCTAssertFalse(frontBlock.contains(".lineLimit(2)"))
    }

    func testLeavingGlossaryDismissesThePresentedEntry() throws {
        let source = try Self.appSourceFileContents()

        XCTAssertTrue(
            source.contains(
                """
                if section != .glossary {
                                    selectedGlossaryEntry = nil
                                }
                """
            )
        )
    }

    func testAppBootstrapLoadsRepositoryBeforeConstructingTheModel() throws {
        let source = try Self.appEntrySourceFileContents()

        XCTAssertFalse(
            source.contains("@StateObject private var model = DailyKanjiAppModel()")
        )
        XCTAssertTrue(source.contains("await repository.loadSnapshotAsync"))
        XCTAssertTrue(source.contains("initialRepositorySnapshot: snapshot"))
        XCTAssertTrue(source.contains("ProgressView(\"Caricamento Daily Kanji\")"))
    }

    func testJapaneseFrontTypographyUsesSystemDefaultInsteadOfSerif() throws {
        let appSource = try Self.appSourceFileContents()
        let widgetSource = try Self.widgetSourceFileContents()

        XCTAssertFalse(appSource.contains("design: .serif"))
        XCTAssertFalse(widgetSource.contains("design: .serif"))
    }

    func testDetailExampleLinesKeepItalianExampleWhenJapaneseExampleIsMissing() throws {
        let card = try Self.cardReplacingExamples(exampleJp: nil, exampleIt: "Solo esempio italiano.")

        XCTAssertEqual(card.detailExampleLines, ["Solo esempio italiano."])
    }

    func testSelectedCardViewStacksFrontAboveDetailsAndAudio() throws {
        let source = try Self.appSourceFileContents()
        guard let viewStart = source.range(of: "private func selectedCardView") else {
            XCTFail("Could not find selectedCardView.")
            return
        }

        let viewSource = source[viewStart.lowerBound...]
        guard let viewEnd = viewSource.range(of: "\n    private func studySignalsView") else {
            XCTFail("Could not isolate selectedCardView.")
            return
        }

        let viewBlock = String(viewSource[..<viewEnd.lowerBound])
        XCTAssertFalse(viewBlock.contains("HStack(alignment: .firstTextBaseline"))

        guard
            let frontStart = viewBlock.range(of: "Text(card.displayFront)"),
            let detailsStart = viewBlock.range(of: "Text(card.back)"),
            let audioStart = viewBlock.range(
                of: "Label(\"Audio\", systemImage: \"speaker.wave.2.fill\")"
            )
        else {
            XCTFail("Could not find the selected card front, detail text, and audio button.")
            return
        }

        XCTAssertLessThan(frontStart.lowerBound, detailsStart.lowerBound)
        XCTAssertLessThan(detailsStart.lowerBound, audioStart.lowerBound)

        let frontBlock = String(viewBlock[frontStart.lowerBound..<detailsStart.lowerBound])
        XCTAssertTrue(frontBlock.contains(".lineLimit(1)"))
        XCTAssertFalse(frontBlock.contains(".lineLimit(2)"))
        XCTAssertFalse(frontBlock.contains("Label(\"Audio\""))
        XCTAssertTrue(frontBlock.contains(".frame(maxWidth: .infinity, alignment: .leading)"))
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
    func testOfflineStartupAndCardDeepLinksChooseTheDailySection() throws {
        let cards = try Self.rankedCards(count: 3)
        let offlineModel = DailyKanjiAppModel(
            cards: cards,
            liveReviewClient: nil,
            now: now
        )
        let liveModel = DailyKanjiAppModel(
            cards: cards,
            liveReviewClient: MockDailyKanjiLiveReviewClient(),
            now: now
        )

        XCTAssertEqual(offlineModel.selectedAppSection, .daily)
        XCTAssertEqual(liveModel.selectedAppSection, .review)

        liveModel.selectAppSection(.glossary)
        liveModel.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "card-2"),
            now: now.addingTimeInterval(1)
        )

        XCTAssertEqual(liveModel.selectedAppSection, .daily)
        XCTAssertEqual(liveModel.selectedCard?.cardId, "card-2")
    }

    @MainActor
    func testStaleCardDeepLinkStillRoutesToTheDailyFallback() throws {
        let model = DailyKanjiAppModel(
            cards: try Self.rankedCards(count: 2),
            liveReviewClient: MockDailyKanjiLiveReviewClient(),
            now: now
        )

        model.selectAppSection(.glossary)
        model.openDeepLink(
            DailyKanjiDeepLink.cardURL(cardId: "removed-card"),
            now: now.addingTimeInterval(1)
        )

        XCTAssertEqual(model.selectedAppSection, .daily)
        XCTAssertNotNil(model.selectedCard)
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

    func testHistoryStoreStillDecodesLegacyAppItemsWithoutEventIds() throws {
        let defaultsName = "DailyKanjiTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: defaultsName)!
        defer {
            defaults.removePersistentDomain(forName: defaultsName)
        }
        let legacyJSON = """
        [
          {
            "cardId": "legacy-card",
            "shownAt": "2027-01-15T08:00:00Z"
          }
        ]
        """.data(using: .utf8)!
        defaults.set(legacyJSON, forKey: "daily-kanji.history.v1")

        let item = try XCTUnwrap(DailyKanjiHistoryStore(defaults: defaults).allItems().first)

        XCTAssertEqual(item.cardId, "legacy-card")
        XCTAssertEqual(item.shownAt, Self.isoDate("2027-01-15T08:00:00.000Z"))
        XCTAssertFalse(item.eventId.isEmpty)
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

    func testPresentationHistoryKeepsOnlyNewestRepeatedSameCardExposure() {
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
        XCTAssertEqual(presentationItems.count, 1)
        XCTAssertEqual(presentationItems.first?.cardId, "hard")
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

    func testRemoteAudioCacheUsesDeterministicBoundedLRUEviction() {
        let firstURL = URL(string: "https://example.test/first.mp3")!
        let secondURL = URL(string: "https://example.test/second.mp3")!
        let thirdURL = URL(string: "https://example.test/third.mp3")!
        let oversizedURL = URL(string: "https://example.test/oversized.mp3")!
        var cache = DailyKanjiRemoteAudioCache(
            maximumEntryCount: 2,
            maximumByteCount: 6
        )

        XCTAssertTrue(cache.insert(Data(repeating: 1, count: 3), for: firstURL))
        XCTAssertTrue(cache.insert(Data(repeating: 2, count: 3), for: secondURL))
        XCTAssertNotNil(cache.data(for: firstURL))
        XCTAssertTrue(cache.insert(Data(repeating: 3, count: 3), for: thirdURL))

        XCTAssertEqual(cache.count, 2)
        XCTAssertEqual(cache.byteCount, 6)
        XCTAssertEqual(
            cache.urlsInLeastRecentlyUsedOrder,
            [firstURL, thirdURL]
        )
        XCTAssertFalse(cache.contains(secondURL))
        XCTAssertFalse(
            cache.insert(Data(repeating: 4, count: 7), for: oversizedURL)
        )
        XCTAssertFalse(cache.contains(oversizedURL))
        XCTAssertEqual(cache.count, 2)
        XCTAssertEqual(cache.byteCount, 6)
    }

    @MainActor
    func testRemoteAudioPreloadRejectsStaleAndCancelledCompletions() async {
        let loader = ControllableDailyKanjiAudioLoader()
        let player = DailyKanjiAudioPlayer(
            maximumRemoteCacheEntries: 8,
            maximumRemoteCacheBytes: 64,
            remoteAudioLoader: { try await loader.load($0) }
        )
        let firstURL = URL(string: "https://example.test/first.mp3")!
        let secondURL = URL(string: "https://example.test/second.mp3")!
        let cancelledURL = URL(string: "https://example.test/cancelled.mp3")!

        player.preload(url: firstURL)
        await loader.waitForRequestCount(1)
        player.preload(url: secondURL)
        await loader.waitForRequestCount(2)

        await loader.resolveRequest(at: 0, with: Data(repeating: 1, count: 4))
        await Task.yield()
        XCTAssertEqual(player.cachedRemoteAudioCount, 0)
        XCTAssertEqual(player.activePreloadURL, secondURL)

        await loader.resolveRequest(at: 1, with: Data(repeating: 2, count: 5))
        await player.waitForPendingPreload()
        XCTAssertEqual(player.cachedRemoteAudioCount, 1)
        XCTAssertEqual(player.cachedRemoteAudioByteCount, 5)
        XCTAssertEqual(
            player.cachedRemoteAudioURLsInLeastRecentlyUsedOrder,
            [secondURL]
        )

        player.preload(url: cancelledURL)
        await loader.waitForRequestCount(3)
        player.preload(url: nil)
        XCTAssertNil(player.activePreloadURL)
        await loader.resolveRequest(at: 2, with: Data(repeating: 3, count: 6))
        await Task.yield()
        XCTAssertEqual(
            player.cachedRemoteAudioURLsInLeastRecentlyUsedOrder,
            [secondURL]
        )
    }

    @MainActor
    func testRemoteAudioPreloadDeduplicatesActiveAndCachedURLs() async {
        let loader = ControllableDailyKanjiAudioLoader()
        let player = DailyKanjiAudioPlayer(
            remoteAudioLoader: { try await loader.load($0) }
        )
        let url = URL(string: "https://example.test/audio.mp3")!

        player.preload(url: url)
        player.preload(url: url)
        await loader.waitForRequestCount(1)
        let activeRequestCount = await loader.requestCount
        XCTAssertEqual(activeRequestCount, 1)

        await loader.resolveRequest(at: 0, with: Data(repeating: 1, count: 4))
        await player.waitForPendingPreload()
        player.preload(url: url)
        await Task.yield()

        let finalRequestCount = await loader.requestCount
        XCTAssertEqual(finalRequestCount, 1)
        XCTAssertEqual(player.cachedRemoteAudioCount, 1)
    }

    func testAudioPlayerStopsBothBackendsBeforeStartingPlayback() throws {
        let source = try Self.audioPlayerSourceFileContents()
        guard
            let bundledStart = source.range(of: "private func playBundled"),
            let remoteStart = source.range(of: "\n    func play(url: URL)"),
            let preloadStart = source.range(of: "\n    func preload(url: URL?)")
        else {
            XCTFail("Could not isolate audio playback methods.")
            return
        }

        let bundledBlock = String(source[bundledStart.lowerBound..<remoteStart.lowerBound])
        let remoteBlock = String(source[remoteStart.lowerBound..<preloadStart.lowerBound])
        XCTAssertTrue(bundledBlock.contains("stopPlayback()"))
        XCTAssertTrue(remoteBlock.contains("stopPlayback()"))
        XCTAssertTrue(source.contains("player?.stop()"))
        XCTAssertTrue(source.contains("remotePlayer?.pause()"))
        XCTAssertTrue(source.contains("remotePlayer?.replaceCurrentItem(with: nil)"))
        XCTAssertTrue(source.contains("remoteAudioCache.removeData(for: url)"))
    }

    func testLiveReviewPreloadCancelsWhenTheReviewIsNotVisible() throws {
        let source = try Self.appSourceFileContents()

        XCTAssertTrue(
            source.contains(
                """
                .onDisappear {
                                audioPlayer.stopPlayback()
                                audioPlayer.preload(url: nil)
                            }
                """
            )
        )
        XCTAssertTrue(
            source.contains(
                """
                private func resetAndPreloadCurrentLiveReviewAudio() {
                        audioPlayer.stopPlayback()
                """
            )
        )
        XCTAssertTrue(
            source.contains(
                """
                .onChange(of: currentLiveReviewCardKey) { _, _ in
                                guard model.selectedAppSection == .review else {
                                    return
                                }
                """
            )
        )
        XCTAssertTrue(
            source.contains(
                """
                else {
                            audioPlayer.preload(url: nil)
                            return
                        }
                """
            )
        )
    }

    private static let liveReviewSessionJSON = """
    {
      "ok": true,
      "source": "live",
      "queue": {
        "dueCount": 1,
        "queueCount": 3,
        "nextDueAt": "2026-06-28T09:00:00.000Z"
      },
      "selectedCard": {
        "cardId": "live-card",
        "front": "{{観測|かんそく}}",
        "back": "osservazione / rilevamento",
        "mediaSlug": "media-one",
        "mediaTitle": "Media One",
        "reviewStateUpdatedAt": "2026-06-28T08:00:00.000Z",
        "reading": "かんそく",
        "gradePreviews": [
          {
            "nextReviewLabel": "Subito",
            "rating": "again"
          },
          {
            "nextReviewLabel": "Tra 10 min",
            "rating": "hard"
          },
          {
            "nextReviewLabel": "Domani alle 09:00",
            "rating": "good"
          },
          {
            "nextReviewLabel": "Tra 4 giorni",
            "rating": "easy"
          }
        ],
        "entries": [
          {
            "id": "term-1",
            "kind": "term",
            "label": "観測",
            "meaning": "osservazione / rilevamento",
            "reading": "かんそく"
          }
        ],
        "pronunciations": [
          {
            "audio": {
              "label": "bundle",
              "pitchAccent": {
                "downstep": 0,
                "levels": ["low", "high", "high", "high"],
                "morae": ["か", "ん", "そ", "く"],
                "shape": "heiban",
                "trailingLevel": "high"
              },
              "pitchAccentSource": "fixture",
              "source": "bundle",
              "src": "/media-audio/media-one/audio/term/kansoku.mp3?v=2026"
            },
            "kind": "term",
            "label": "観測",
            "meaning": "osservazione / rilevamento",
            "reading": "かんそく",
            "relationshipLabel": "Termine"
          }
        ],
        "exampleJp": "{{観測|かんそく}}データを {{確認|かくにん}}します。",
        "exampleIt": "Controllo i dati osservati.",
        "notes": "Live review card."
      },
      "advanceCards": [
        {
          "cardId": "next-live-card",
          "front": "{{確認|かくにん}}",
          "back": "conferma / controllo",
          "mediaSlug": "media-one",
          "mediaTitle": "Media One",
          "reviewStateUpdatedAt": "2026-06-28T08:05:00.000Z",
          "reading": "かくにん",
          "gradePreviews": [
            {
              "nextReviewLabel": "Subito",
              "rating": "again"
            },
            {
              "nextReviewLabel": "Tra 10 min",
              "rating": "hard"
            },
            {
              "nextReviewLabel": "Domani alle 09:00",
              "rating": "good"
            },
            {
              "nextReviewLabel": "Tra 4 giorni",
              "rating": "easy"
            }
          ],
          "entries": [
            {
              "id": "term-2",
              "kind": "term",
              "label": "確認",
              "meaning": "conferma / controllo",
              "reading": "かくにん"
            }
          ],
          "pronunciations": [],
          "exampleJp": "{{確認|かくにん}}します。",
          "exampleIt": "Controllo.",
          "notes": "Buffered next card."
        }
      ]
    }
    """.data(using: .utf8)!

    private static let liveReviewGradeResponseJSON = """
    {
      "ok": true,
      "grade": {
        "cardId": "live-card",
        "rating": "good"
      },
      "session": {
        "source": "live",
        "queue": {
          "dueCount": 0,
          "queueCount": 0
        },
        "selectedCard": null
      }
    }
    """.data(using: .utf8)!

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

    private static let glossaryDatasetJSON = """
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
          "front": "観点",
          "back": "point of view",
          "kanji": ["観", "点"],
          "entry": {
            "id": "entry-hard",
            "kind": "term",
            "label": "観点",
            "meaning": "point of view",
            "reading": "かんてん"
          },
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
        }
      ],
      "glossary": {
        "version": 1,
        "generatedAt": "2026-06-10T12:00:00.000Z",
        "entryCount": 2,
        "entries": [
          {
            "id": "term:term_fixture_iku",
            "kind": "term",
            "label": "行く",
            "reading": "いく",
            "romaji": "iku",
            "meaning": "andare",
            "notes": "Verbo base molto frequente.",
            "pitchAccent": null,
            "pitchAccentSource": null,
            "aliases": [
              { "text": "いきます", "type": "inflected" },
              { "text": "iku", "type": "romaji" }
            ],
            "media": [
              {
                "audioSrc": "assets/audio/term/term-fixture-iku/iku.mp3",
                "entryId": "term_fixture_iku",
                "sourceId": "term_fixture_iku",
                "mediaSlug": "fixture-tcg",
                "mediaTitle": "Fixture TCG",
                "segmentTitle": "Starter Core"
              }
            ],
            "searchText": "行く いく iku andare muoversi verso una destinazione Verbo base molto frequente. いきます iku Fixture TCG Starter Core"
          },
          {
            "id": "grammar:grammar_fixture_teiru",
            "kind": "grammar",
            "label": "〜ている",
            "title": "Progressive / resultant state",
            "reading": null,
            "romaji": "teiru",
            "meaning": "azione in corso o stato risultante",
            "notes": "Pattern base usato molto presto in quasi ogni corso.",
            "pitchAccent": null,
            "pitchAccentSource": null,
            "aliases": [
              { "text": "〜てる" }
            ],
            "media": [
              {
                "entryId": "grammar_fixture_teiru",
                "sourceId": "grammar_fixture_teiru",
                "mediaSlug": "fixture-tcg",
                "mediaTitle": "Fixture TCG",
                "segmentTitle": "Starter Core"
              }
            ],
            "searchText": "〜ている Progressive / resultant state teiru azione in corso o stato risultante Pattern base usato molto presto in quasi ogni corso. 〜てる Fixture TCG Starter Core"
          }
        ]
      }
    }
    """.data(using: .utf8)!

    private static let modeScopedDatasetJSON = """
    {
      "version": 1,
      "generatedAt": "2026-06-11T08:00:00.000Z",
      "recentMistakeLookbackDays": 3,
      "cards": [
        {
          "cardId": "daily-global",
          "subjectKey": "entry:term:daily-global",
          "media": { "slug": "media-two", "title": "Media Two" },
          "lesson": { "slug": "daily", "title": "Daily", "orderIndex": 10 },
          "cardOrderIndex": 1,
          "front": "全体",
          "back": "ぜんたい — globale",
          "kanji": ["全", "体"],
          "entry": {
            "id": "daily-global",
            "kind": "term",
            "label": "全体",
            "meaning": "globale",
            "reading": "ぜんたい"
          },
          "notes": "Daily global",
          "studyModes": { "daily": true },
          "srs": {
            "difficulty": 9,
            "dueAt": "2026-06-11T08:00:00.000Z",
            "lapses": 0,
            "lastHardAgainAt": null,
            "lastInteractionAt": "2026-06-11T08:00:00.000Z",
            "lastReviewedAt": "2026-06-11T08:00:00.000Z",
            "learningSteps": 0,
            "priorityReasons": ["high-difficulty"],
            "priorityScore": 9000,
            "recentHardAgainCount": 0,
            "reps": 3,
            "scheduledDays": 1,
            "stability": 8,
            "state": "review"
          }
        },
        {
          "cardId": "prestudy-one",
          "subjectKey": "entry:term:prestudy-one",
          "media": { "slug": "media-one", "title": "Media One" },
          "lesson": { "slug": "next", "title": "Next Lesson", "orderIndex": 20 },
          "cardOrderIndex": 1,
          "front": "予習",
          "back": "よしゅう — prestudio",
          "kanji": ["予", "習"],
          "entry": {
            "id": "prestudy-one",
            "kind": "term",
            "label": "予習",
            "meaning": "prestudio",
            "reading": "よしゅう"
          },
          "studyModes": {
            "prestudy": {
              "lessonSlug": "next",
              "lessonTitle": "Next Lesson",
              "lessonOrderIndex": 20,
              "order": 1
            }
          },
          "srs": {
            "difficulty": null,
            "dueAt": null,
            "lapses": 0,
            "lastHardAgainAt": null,
            "lastInteractionAt": "2026-06-11T08:00:00.000Z",
            "lastReviewedAt": null,
            "learningSteps": 0,
            "priorityReasons": [],
            "priorityScore": 0,
            "recentHardAgainCount": 0,
            "reps": 0,
            "scheduledDays": 0,
            "stability": null,
            "state": "learning"
          }
        },
        {
          "cardId": "last-one",
          "subjectKey": "entry:term:last-one",
          "media": { "slug": "media-one", "title": "Media One" },
          "lesson": { "slug": "recent", "title": "Recent Lesson", "orderIndex": 18 },
          "cardOrderIndex": 1,
          "front": "復習",
          "back": "ふくしゅう — ripasso",
          "kanji": ["復", "習"],
          "entry": {
            "id": "last-one",
            "kind": "term",
            "label": "復習",
            "meaning": "ripasso",
            "reading": "ふくしゅう"
          },
          "studyModes": {
            "lastLessonsHardAgain": {
              "lessonSlug": "recent",
              "lessonTitle": "Recent Lesson",
              "lessonOrderIndex": 18,
              "order": 1
            }
          },
          "srs": {
            "difficulty": 4,
            "dueAt": "2026-06-11T08:00:00.000Z",
            "lapses": 0,
            "lastHardAgainAt": "2026-06-10T08:00:00.000Z",
            "lastInteractionAt": "2026-06-10T08:00:00.000Z",
            "lastReviewedAt": "2026-06-10T08:00:00.000Z",
            "learningSteps": 0,
            "priorityReasons": ["recent-hard-again"],
            "priorityScore": 10000,
            "recentHardAgainCount": 1,
            "reps": 3,
            "scheduledDays": 1,
            "stability": 8,
            "state": "review"
          }
        },
        {
          "cardId": "last-two",
          "subjectKey": "entry:term:last-two",
          "media": { "slug": "media-two", "title": "Media Two" },
          "lesson": { "slug": "recent-two", "title": "Recent Two", "orderIndex": 18 },
          "cardOrderIndex": 1,
          "front": "苦手",
          "back": "にがて — debolezza",
          "kanji": ["苦", "手"],
          "entry": {
            "id": "last-two",
            "kind": "term",
            "label": "苦手",
            "meaning": "debolezza",
            "reading": "にがて"
          },
          "studyModes": {
            "lastLessonsHardAgain": {
              "lessonSlug": "recent-two",
              "lessonTitle": "Recent Two",
              "lessonOrderIndex": 18,
              "order": 1
            }
          },
          "srs": {
            "difficulty": 4,
            "dueAt": "2026-06-11T08:00:00.000Z",
            "lapses": 0,
            "lastHardAgainAt": "2026-06-10T08:00:00.000Z",
            "lastInteractionAt": "2026-06-10T08:00:00.000Z",
            "lastReviewedAt": "2026-06-10T08:00:00.000Z",
            "learningSteps": 0,
            "priorityReasons": ["recent-hard-again"],
            "priorityScore": 10000,
            "recentHardAgainCount": 1,
            "reps": 3,
            "scheduledDays": 1,
            "stability": 8,
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

    private static func cardReplacingBackAndMeaning(
        back: String,
        meaning: String
    ) throws -> DailyKanjiCard {
        try cardReplacingBackMeaningAndNotes(
            back: back,
            meaning: meaning,
            notes: "Plain note"
        )
    }

    private static func cardReplacingBackMeaningAndNotes(
        back: String,
        meaning: String,
        notes: String
    ) throws -> DailyKanjiCard {
        let json = String(data: datasetJSON, encoding: .utf8)!
            .replacingOccurrences(
                of: "\"back\": \"point of view\"",
                with: "\"back\": \"\(back)\""
            )
            .replacingOccurrences(
                of: "\"meaning\": \"point of view\"",
                with: "\"meaning\": \"\(meaning)\""
            )
            .replacingOccurrences(
                of: "\"Plain note\"",
                with: "\"\(notes)\""
            )
            .data(using: .utf8)!

        return try DailyKanjiDataset.decode(jsonData: json).cards[0]
    }

    private static func cardReplacingReadingAndPitchAccent(
        reading: String?,
        pitchAccent: Int?
    ) throws -> DailyKanjiCard {
        let json = String(data: datasetJSON, encoding: .utf8)!
            .replacingOccurrences(
                of: "\"pitchAccent\": 2",
                with: pitchAccent.map { "\"pitchAccent\": \($0)" } ?? "\"pitchAccent\": null"
            )
            .replacingOccurrences(
                of: "\"reading\": \"かんてん\"",
                with: reading.map { "\"reading\": \"\($0)\"" } ?? "\"reading\": null"
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

    private static func datasetMovingPrestudyCardToMediaTwo(
        _ dataset: DailyKanjiDataset
    ) -> DailyKanjiDataset {
        DailyKanjiDataset(
            version: dataset.version,
            generatedAt: dataset.generatedAt,
            recentMistakeLookbackDays: dataset.recentMistakeLookbackDays,
            cards: dataset.cards.map { card in
                guard card.cardId == "prestudy-one" else {
                    return card
                }

                return Self.card(
                    card,
                    replacingMedia: DailyKanjiCard.Media(
                        slug: "media-two",
                        title: "Media Two"
                    )
                )
            }
        )
    }

    private static func card(
        _ card: DailyKanjiCard,
        replacingMedia media: DailyKanjiCard.Media
    ) -> DailyKanjiCard {
        DailyKanjiCard(
            cardId: card.cardId,
            subjectKey: card.subjectKey,
            cardOrderIndex: card.cardOrderIndex,
            media: media,
            lesson: card.lesson,
            segment: card.segment,
            front: card.front,
            back: card.back,
            kanji: card.kanji,
            entry: card.entry,
            exampleIt: card.exampleIt,
            exampleJp: card.exampleJp,
            notes: card.notes,
            studyModes: card.studyModes,
            srs: card.srs
        )
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

    private static func makeTemporaryDirectory() throws -> URL {
        let directoryURL = FileManager.default.temporaryDirectory.appendingPathComponent(
            "DailyKanjiTests-\(UUID().uuidString)",
            isDirectory: true
        )
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        return directoryURL
    }

    private static func removeTemporaryDirectory(_ directoryURL: URL) {
        try? FileManager.default.removeItem(at: directoryURL)
    }

    private static func widgetSourceFileContents() throws -> String {
        let testFileURL = URL(fileURLWithPath: #filePath)
        let projectURL = testFileURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let widgetSourceURL = projectURL.appendingPathComponent(
            "WidgetExtension/DailyKanjiWidget.swift"
        )
        return try String(contentsOf: widgetSourceURL, encoding: .utf8)
    }

    private static func appSourceFileContents() throws -> String {
        let testFileURL = URL(fileURLWithPath: #filePath)
        let projectURL = testFileURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let appSourceURL = projectURL.appendingPathComponent("App/ContentView.swift")
        return try String(contentsOf: appSourceURL, encoding: .utf8)
    }

    private static func audioPlayerSourceFileContents() throws -> String {
        let testFileURL = URL(fileURLWithPath: #filePath)
        let projectURL = testFileURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let audioPlayerSourceURL = projectURL.appendingPathComponent(
            "App/DailyKanjiAudioPlayer.swift"
        )
        return try String(contentsOf: audioPlayerSourceURL, encoding: .utf8)
    }

    private static func appEntrySourceFileContents() throws -> String {
        let testFileURL = URL(fileURLWithPath: #filePath)
        let projectURL = testFileURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let appSourceURL = projectURL.appendingPathComponent("App/DailyKanjiApp.swift")
        return try String(contentsOf: appSourceURL, encoding: .utf8)
    }

    private static func makeBundle(
        containing dataset: DailyKanjiDataset,
        in directoryURL: URL,
        resourceName: String = "daily-kanji-cards"
    ) throws -> Bundle {
        let bundleURL = directoryURL.appendingPathComponent(
            "DailyKanjiTest-\(UUID().uuidString).bundle",
            isDirectory: true
        )
        try FileManager.default.createDirectory(
            at: bundleURL,
            withIntermediateDirectories: true
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        try encoder
            .encode(dataset)
            .write(to: bundleURL.appendingPathComponent("\(resourceName).json"))

        let bundleIdentifier = "dev.local.daily-kanji.tests.\(UUID().uuidString)"
        let infoPlist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
          <key>CFBundleIdentifier</key>
          <string>\(bundleIdentifier)</string>
          <key>CFBundleName</key>
          <string>DailyKanjiTest</string>
          <key>CFBundlePackageType</key>
          <string>BNDL</string>
        </dict>
        </plist>
        """.data(using: .utf8)!
        try infoPlist.write(to: bundleURL.appendingPathComponent("Info.plist"))

        guard let bundle = Bundle(url: bundleURL) else {
            throw NSError(
                domain: "DailyKanjiTests",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Could not create test bundle."]
            )
        }

        return bundle
    }

    private static func isoDate(_ value: String) -> Date {
        ISO8601DateFormatter.dailyKanjiTestFormatter.date(from: value)!
    }

    private static func romeCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Rome")!
        return calendar
    }

    private static func writeCacheMetadata(
        _ metadata: DailyKanjiCachedDatasetMetadata,
        to directoryURL: URL
    ) throws {
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        try JSONEncoder()
            .encode(metadata)
            .write(
                to: directoryURL.appendingPathComponent(
                    DailyKanjiCacheStore.metadataFileName
                )
            )
    }

    private static func data(from stream: InputStream?) -> Data? {
        guard let stream else {
            return nil
        }

        stream.open()
        defer {
            stream.close()
        }

        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let readCount = stream.read(&buffer, maxLength: buffer.count)
            if readCount < 0 {
                return nil
            }
            if readCount == 0 {
                break
            }

            data.append(buffer, count: readCount)
        }

        return data
    }

    private static func waitUntil(
        condition: @escaping () -> Bool
    ) async {
        for _ in 0..<50 where !condition() {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
    }

    private static func waitUntilAsync(
        condition: @escaping () async -> Bool
    ) async {
        for _ in 0..<50 {
            if await condition() {
                return
            }
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
    }
}

private final class CountingDailyKanjiDatasetDecoder: @unchecked Sendable {
    private let lock = NSLock()
    private var storedCount = 0
    private var storedWasCalledOnMainThread = false

    var count: Int {
        lock.withLock {
            storedCount
        }
    }

    var wasCalledOnMainThread: Bool {
        lock.withLock {
            storedWasCalledOnMainThread
        }
    }

    func decode(_ data: Data) throws -> DailyKanjiDataset {
        lock.withLock {
            storedCount += 1
            storedWasCalledOnMainThread = storedWasCalledOnMainThread || Thread.isMainThread
        }
        return try DailyKanjiDataset.decode(jsonData: data)
    }
}

private enum MockDailyKanjiCacheWriterError: LocalizedError, Sendable {
    case failed

    var errorDescription: String? {
        "Cache write failed."
    }
}

private actor ControllableDailyKanjiCacheWriter: DailyKanjiCacheWriting {
    private let pausesWrites: Bool
    private let failsWrites: Bool
    private var pendingContinuation: CheckedContinuation<Void, Never>?
    private(set) var writeCount = 0

    init(
        pausesWrites: Bool = false,
        failsWrites: Bool = false
    ) {
        self.pausesWrites = pausesWrites
        self.failsWrites = failsWrites
    }

    var isWaiting: Bool {
        pendingContinuation != nil
    }

    func write(
        dataset: DailyKanjiDataset,
        cachedAt: Date
    ) async throws -> DailyKanjiCachedDatasetMetadata {
        writeCount += 1
        if pausesWrites {
            await withCheckedContinuation { continuation in
                pendingContinuation = continuation
            }
        }
        if failsWrites {
            throw MockDailyKanjiCacheWriterError.failed
        }

        return DailyKanjiCachedDatasetMetadata(
            cachedAt: cachedAt,
            generatedAt: dataset.generatedAt,
            cardCount: dataset.cards.count
        )
    }

    func resolve() {
        pendingContinuation?.resume()
        pendingContinuation = nil
    }
}

private final class MockDailyKanjiSyncer: DailyKanjiSyncing {
    private var results: [Result<DailyKanjiDataset, Error>]
    private(set) var fetchCount = 0

    init(result: Result<DailyKanjiDataset, Error>) {
        self.results = [result]
    }

    init(results: [Result<DailyKanjiDataset, Error>]) {
        self.results = results
    }

    func fetchDataset() async throws -> DailyKanjiDataset {
        fetchCount += 1
        guard results.count > 1 else {
            return try results[0].get()
        }

        return try results.removeFirst().get()
    }
}

private final class PausableDailyKanjiSyncer: DailyKanjiSyncing {
    private let dataset: DailyKanjiDataset
    private var continuation: CheckedContinuation<Void, Never>?
    private(set) var fetchCount = 0

    init(dataset: DailyKanjiDataset) {
        self.dataset = dataset
    }

    func fetchDataset() async throws -> DailyKanjiDataset {
        fetchCount += 1
        await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
        return dataset
    }

    func resolve() {
        continuation?.resume()
        continuation = nil
    }
}

private final class MockDailyKanjiLiveReviewClient: DailyKanjiLiveReviewing {
    struct GradeRequest: Equatable {
        let cardId: String
        let rating: DailyKanjiLiveReviewRating
        let expectedUpdatedAt: String?
        let responseMs: Int?
    }

    private var fetchResults: [Result<DailyKanjiLiveReviewSession, Error>]
    private var gradeResults: [Result<DailyKanjiLiveReviewGradeResult, Error>]
    private let pauseGradesUntilResolved: Bool
    private var pendingGradeContinuation: CheckedContinuation<Void, Never>?
    private let pendingGradeWasCancelled = LockedBox(false)
    private(set) var fetchCount = 0
    private(set) var gradeRequests: [GradeRequest] = []
    private(set) var registeredDeviceTokens: [String] = []

    var wasPendingGradeCancelled: Bool {
        pendingGradeWasCancelled.value
    }

    init(
        fetchResults: [Result<DailyKanjiLiveReviewSession, Error>] = [],
        gradeResults: [Result<DailyKanjiLiveReviewGradeResult, Error>] = [],
        pauseGradesUntilResolved: Bool = false
    ) {
        self.fetchResults = fetchResults
        self.gradeResults = gradeResults
        self.pauseGradesUntilResolved = pauseGradesUntilResolved
    }

    func fetchSession() async throws -> DailyKanjiLiveReviewSession {
        fetchCount += 1
        guard fetchResults.count > 1 else {
            return try fetchResults[0].get()
        }

        return try fetchResults.removeFirst().get()
    }

    func grade(
        cardId: String,
        rating: DailyKanjiLiveReviewRating,
        expectedUpdatedAt: String?,
        responseMs: Int?
    ) async throws -> DailyKanjiLiveReviewGradeResult {
        gradeRequests.append(
            GradeRequest(
                cardId: cardId,
                rating: rating,
                expectedUpdatedAt: expectedUpdatedAt,
                responseMs: responseMs
            )
        )
        if pauseGradesUntilResolved {
            let cancellationState = pendingGradeWasCancelled
            await withTaskCancellationHandler {
                await withCheckedContinuation { continuation in
                    pendingGradeContinuation = continuation
                }
            } onCancel: {
                cancellationState.value = true
            }
        }
        guard gradeResults.count > 1 else {
            return try gradeResults[0].get()
        }

        return try gradeResults.removeFirst().get()
    }

    func resolvePendingGrade() {
        pendingGradeContinuation?.resume()
        pendingGradeContinuation = nil
    }

    func registerDeviceToken(_ deviceToken: String) async throws {
        registeredDeviceTokens.append(deviceToken)
    }
}

private final class ControllableDailyKanjiLiveReviewClient: DailyKanjiLiveReviewing {
    private let lock = NSLock()
    private let pausesBeforeContinuationRegistration: Bool
    private var storedPendingFetches: [
        Int: CheckedContinuation<DailyKanjiLiveReviewSession, Error>
    ] = [:]
    private var storedEarlyFetchResults: [
        Int: Result<DailyKanjiLiveReviewSession, Error>
    ] = [:]
    private var storedRegistrationPauseContinuations: [
        Int: CheckedContinuation<Void, Never>
    ] = [:]
    private var storedPausedRegistrationIndexes: Set<Int> = []
    private var storedFetchCount = 0
    private var storedCompletedFetches: Set<Int> = []

    init(pausesBeforeContinuationRegistration: Bool = false) {
        self.pausesBeforeContinuationRegistration = pausesBeforeContinuationRegistration
    }

    var fetchCount: Int {
        lock.withLock {
            storedFetchCount
        }
    }

    var completedFetches: Set<Int> {
        lock.withLock {
            storedCompletedFetches
        }
    }

    var pausedRegistrationIndexes: Set<Int> {
        lock.withLock {
            storedPausedRegistrationIndexes
        }
    }

    func fetchSession() async throws -> DailyKanjiLiveReviewSession {
        let fetchIndex = lock.withLock {
            let index = storedFetchCount
            storedFetchCount += 1
            return index
        }
        if pausesBeforeContinuationRegistration {
            await withCheckedContinuation { continuation in
                lock.withLock {
                    _ = storedPausedRegistrationIndexes.insert(fetchIndex)
                    storedRegistrationPauseContinuations[fetchIndex] = continuation
                }
            }
        }
        defer {
            lock.withLock {
                _ = storedCompletedFetches.insert(fetchIndex)
            }
        }

        return try await withCheckedThrowingContinuation { continuation in
            let earlyResult: Result<DailyKanjiLiveReviewSession, Error>? = lock.withLock {
                if let result = storedEarlyFetchResults.removeValue(forKey: fetchIndex) {
                    return result
                }

                storedPendingFetches[fetchIndex] = continuation
                return nil
            }
            if let earlyResult {
                continuation.resume(with: earlyResult)
            }
        }
    }

    func resolveFetch(
        at index: Int,
        with result: Result<DailyKanjiLiveReviewSession, Error>
    ) {
        let continuation: CheckedContinuation<DailyKanjiLiveReviewSession, Error>? = lock.withLock {
            if let continuation = storedPendingFetches.removeValue(forKey: index) {
                return continuation
            }

            if index >= 0, index < storedFetchCount, storedEarlyFetchResults[index] == nil {
                storedEarlyFetchResults[index] = result
            }
            return nil
        }
        continuation?.resume(with: result)
    }

    func resumeFetchRegistration(at index: Int) {
        let continuation = lock.withLock {
            _ = storedPausedRegistrationIndexes.remove(index)
            return storedRegistrationPauseContinuations.removeValue(forKey: index)
        }
        continuation?.resume()
    }

    func grade(
        cardId: String,
        rating: DailyKanjiLiveReviewRating,
        expectedUpdatedAt: String?,
        responseMs: Int?
    ) async throws -> DailyKanjiLiveReviewGradeResult {
        throw DailyKanjiLiveReviewClientError.invalidResponse
    }

    func registerDeviceToken(_ deviceToken: String) async throws {}
}

private actor ControllableGlossaryDebounceSleeper {
    private var continuations: [CheckedContinuation<Void, Error>] = []

    func sleep() async throws {
        try await withCheckedThrowingContinuation { continuation in
            continuations.append(continuation)
        }
    }

    func waitForPendingCount(_ expectedCount: Int) async {
        for _ in 0..<1_000 {
            if continuations.count >= expectedCount {
                return
            }
            await Task.yield()
        }

        XCTFail(
            "Expected \(expectedCount) pending glossary searches, found \(continuations.count)"
        )
    }

    func resumeNext() {
        guard !continuations.isEmpty else {
            XCTFail("Expected a pending glossary search")
            return
        }

        continuations.removeFirst().resume(returning: ())
    }
}

private actor ControllableDailyKanjiAudioLoader {
    private var nextRequestIndex = 0
    private var continuations: [Int: CheckedContinuation<Data, Error>] = [:]
    private var requestedURLs: [URL] = []

    var requestCount: Int {
        requestedURLs.count
    }

    func load(_ url: URL) async throws -> Data {
        let requestIndex = nextRequestIndex
        nextRequestIndex += 1
        requestedURLs.append(url)

        return try await withCheckedThrowingContinuation { continuation in
            continuations[requestIndex] = continuation
        }
    }

    func waitForRequestCount(_ expectedCount: Int) async {
        for _ in 0..<1_000 {
            if requestCount >= expectedCount {
                return
            }
            await Task.yield()
        }

        XCTFail(
            "Expected \(expectedCount) audio requests, found \(requestCount)"
        )
    }

    func resolveRequest(at index: Int, with data: Data) {
        guard let continuation = continuations.removeValue(forKey: index) else {
            XCTFail("Expected pending audio request \(index)")
            return
        }

        continuation.resume(returning: data)
    }
}

private final class MockDailyKanjiNotificationRegistrar: DailyKanjiNotificationRegistering {
    private let lock = NSLock()
    private var storedRequestCount = 0

    var requestCount: Int {
        lock.withLock {
            storedRequestCount
        }
    }

    func requestAuthorizationAndRegister() async {
        lock.withLock {
            storedRequestCount += 1
        }
    }
}

private final class LockedBox<Value> {
    private let lock = NSLock()
    private var storedValue: Value

    init(_ value: Value) {
        self.storedValue = value
    }

    var value: Value {
        get {
            lock.withLock {
                storedValue
            }
        }
        set {
            lock.withLock {
                storedValue = newValue
            }
        }
    }
}

private final class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let requestHandler = Self.requestHandler else {
            client?.urlProtocol(
                self,
                didFailWithError: URLError(.badServerResponse)
            )
            return
        }

        do {
            let (response, data) = try requestHandler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private extension ISO8601DateFormatter {
    static let dailyKanjiTestFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
