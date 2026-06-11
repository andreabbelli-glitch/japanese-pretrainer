import Foundation

struct DailyKanjiCachedDatasetMetadata: Codable, Equatable {
    let cachedAt: Date
    let generatedAt: String
    let cardCount: Int
}

struct DailyKanjiCacheStore {
    static let datasetFileName = "daily-kanji-cards.json"
    static let metadataFileName = "daily-kanji-cache-metadata.json"

    private let directoryURL: URL
    private let fileManager: FileManager

    init(
        directoryURL: URL = DailyKanjiCacheStore.defaultDirectoryURL(),
        fileManager: FileManager = .default
    ) {
        self.directoryURL = directoryURL
        self.fileManager = fileManager
    }

    func loadDataset() -> DailyKanjiDataset? {
        guard
            let data = try? Data(contentsOf: datasetURL),
            let dataset = try? DailyKanjiDataset.decode(jsonData: data)
        else {
            return nil
        }

        return dataset
    }

    func loadMetadata() -> DailyKanjiCachedDatasetMetadata? {
        guard
            let data = try? Data(contentsOf: metadataURL),
            let metadata = try? JSONDecoder().decode(
                DailyKanjiCachedDatasetMetadata.self,
                from: data
            )
        else {
            return nil
        }

        return metadata
    }

    func write(dataset: DailyKanjiDataset, cachedAt: Date) throws {
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

        try writeAtomically(try encoder.encode(dataset), to: datasetURL)
        try writeAtomically(try encoder.encode(metadata), to: metadataURL)
    }

    private var datasetURL: URL {
        directoryURL.appendingPathComponent(Self.datasetFileName)
    }

    private var metadataURL: URL {
        directoryURL.appendingPathComponent(Self.metadataFileName)
    }

    private func writeAtomically(_ data: Data, to destinationURL: URL) throws {
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
