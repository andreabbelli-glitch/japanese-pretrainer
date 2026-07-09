import Foundation

typealias DailyKanjiDatasetDecoder = @Sendable (Data) throws -> DailyKanjiDataset

struct DailyKanjiCachedDatasetMetadata: Codable, Equatable, Sendable {
    let cachedAt: Date
    let generatedAt: String
    let cardCount: Int
}

struct DailyKanjiCachedDatasetSnapshot: Sendable {
    let dataset: DailyKanjiDataset
    let metadata: DailyKanjiCachedDatasetMetadata?
}

protocol DailyKanjiCacheWriting: Sendable {
    func write(
        dataset: DailyKanjiDataset,
        cachedAt: Date
    ) async throws -> DailyKanjiCachedDatasetMetadata
}

actor DailyKanjiCacheWriter: DailyKanjiCacheWriting {
    private let cacheStore: DailyKanjiCacheStore

    init(cacheStore: DailyKanjiCacheStore) {
        self.cacheStore = cacheStore
    }

    func write(
        dataset: DailyKanjiDataset,
        cachedAt: Date
    ) async throws -> DailyKanjiCachedDatasetMetadata {
        try cacheStore.writeSynchronously(dataset: dataset, cachedAt: cachedAt)
    }
}

struct DailyKanjiCacheStore: Sendable {
    static let appGroupIdentifier = "group.dev.local.daily-kanji"
    static let datasetFileName = "daily-kanji-cards.json"
    static let metadataFileName = "daily-kanji-cache-metadata.json"

    private let directoryURL: URL

    init(directoryURL: URL = DailyKanjiCacheStore.defaultDirectoryURL()) {
        self.directoryURL = directoryURL
    }

    func loadSnapshot(
        now: Date = .now,
        decodeDataset: DailyKanjiDatasetDecoder = {
            try DailyKanjiDataset.decode(jsonData: $0)
        }
    ) -> DailyKanjiCachedDatasetSnapshot? {
        guard
            let data = try? Data(contentsOf: datasetURL),
            let dataset = try? decodeDataset(data),
            dataset.version == DailyKanjiDataset.supportedVersion
        else {
            return nil
        }

        return DailyKanjiCachedDatasetSnapshot(
            dataset: dataset,
            metadata: loadCoherentMetadata(for: dataset, now: now)
        )
    }

    func makeWriter() -> DailyKanjiCacheWriter {
        DailyKanjiCacheWriter(cacheStore: self)
    }

    private func loadCoherentMetadata(
        for dataset: DailyKanjiDataset,
        now: Date
    ) -> DailyKanjiCachedDatasetMetadata? {
        guard
            let data = try? Data(contentsOf: metadataURL),
            let metadata = try? JSONDecoder().decode(
                DailyKanjiCachedDatasetMetadata.self,
                from: data
            ),
            metadata.generatedAt == dataset.generatedAt,
            metadata.cardCount == dataset.cards.count,
            metadata.cachedAt <= now
        else {
            return nil
        }

        return metadata
    }

    fileprivate func writeSynchronously(
        dataset: DailyKanjiDataset,
        cachedAt: Date
    ) throws -> DailyKanjiCachedDatasetMetadata {
        let fileManager = FileManager.default
        try fileManager.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]

        let metadata = DailyKanjiCachedDatasetMetadata(
            cachedAt: cachedAt,
            generatedAt: dataset.generatedAt,
            cardCount: dataset.cards.count
        )

        try writeAtomically(
            try encoder.encode(dataset),
            to: datasetURL,
            fileManager: fileManager
        )
        try writeAtomically(
            try encoder.encode(metadata),
            to: metadataURL,
            fileManager: fileManager
        )

        return metadata
    }

    private var datasetURL: URL {
        directoryURL.appendingPathComponent(Self.datasetFileName)
    }

    private var metadataURL: URL {
        directoryURL.appendingPathComponent(Self.metadataFileName)
    }

    private func writeAtomically(
        _ data: Data,
        to destinationURL: URL,
        fileManager: FileManager
    ) throws {
        let temporaryURL = directoryURL.appendingPathComponent(
            ".\(destinationURL.lastPathComponent).\(UUID().uuidString).tmp"
        )
        defer {
            if fileManager.fileExists(atPath: temporaryURL.path) {
                try? fileManager.removeItem(at: temporaryURL)
            }
        }
        try data.write(to: temporaryURL)

        if fileManager.fileExists(atPath: destinationURL.path) {
            let _ = try fileManager.replaceItemAt(
                destinationURL,
                withItemAt: temporaryURL,
                backupItemName: nil,
                options: .usingNewMetadataOnly
            )
            return
        }

        try fileManager.moveItem(at: temporaryURL, to: destinationURL)
    }

    private static func defaultDirectoryURL() -> URL {
        if let appGroupURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) {
            return appGroupURL.appendingPathComponent(
                "DailyKanji",
                isDirectory: true
            )
        }

        if let applicationSupportURL = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: false
        ) {
            return applicationSupportURL.appendingPathComponent(
                "DailyKanji",
                isDirectory: true
            )
        }

        return FileManager.default.temporaryDirectory.appendingPathComponent(
            "DailyKanji",
            isDirectory: true
        )
    }
}
