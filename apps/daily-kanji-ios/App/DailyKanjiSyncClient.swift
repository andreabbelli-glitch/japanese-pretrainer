import Foundation

protocol DailyKanjiSyncing {
    func fetchDataset() async throws -> DailyKanjiDataset
}

struct DailyKanjiSyncConfiguration: Equatable {
    let endpointURL: URL?
    let bearerToken: String?

    static func load(bundle: Bundle = .main) -> DailyKanjiSyncConfiguration {
        let endpoint = normalizedPlistString(
            bundle.object(forInfoDictionaryKey: "DAILY_KANJI_IOS_SYNC_ENDPOINT")
        ).flatMap(URL.init(string:))
        let token = normalizedPlistString(
            bundle.object(forInfoDictionaryKey: "DAILY_KANJI_IOS_SYNC_TOKEN")
        )

        return DailyKanjiSyncConfiguration(
            endpointURL: endpoint,
            bearerToken: token
        )
    }

    private static func normalizedPlistString(_ value: Any?) -> String? {
        guard let string = value as? String else {
            return nil
        }

        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.hasPrefix("$(") else {
            return nil
        }

        return trimmed
    }
}

struct DailyKanjiSyncClient: DailyKanjiSyncing {
    private let endpointURL: URL
    private let bearerToken: String
    private let session: URLSession

    init?(
        configuration: DailyKanjiSyncConfiguration = .load(),
        session: URLSession = .shared
    ) {
        guard
            let endpointURL = configuration.endpointURL,
            let bearerToken = configuration.bearerToken,
            !bearerToken.isEmpty
        else {
            return nil
        }

        self.endpointURL = endpointURL
        self.bearerToken = bearerToken
        self.session = session
    }

    func fetchDataset() async throws -> DailyKanjiDataset {
        async let glossary = fetchGlossaryIfAvailable()
        let dataset = try await fetchCardDataset()

        return dataset.replacingGlossary(await glossary ?? dataset.glossary)
    }

    private func fetchCardDataset() async throws -> DailyKanjiDataset {
        let data = try await fetchData(from: endpointURL)
        let dataset = try DailyKanjiDataset.decode(jsonData: data)
        guard dataset.version == 1, !dataset.cards.isEmpty else {
            throw DailyKanjiSyncClientError.invalidDataset
        }

        return dataset
    }

    private func fetchGlossaryIfAvailable() async -> DailyKanjiGlossarySnapshot? {
        let glossaryURL = endpointURL
            .deletingLastPathComponent()
            .appendingPathComponent("ios-glossary")

        guard
            let data = try? await fetchData(from: glossaryURL),
            let glossary = try? JSONDecoder().decode(
                DailyKanjiGlossarySnapshot.self,
                from: data
            ),
            glossary.version == 1,
            glossary.entryCount == glossary.entries.count
        else {
            return nil
        }

        return glossary
    }

    private func fetchData(from url: URL) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.cachePolicy = .useProtocolCachePolicy
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DailyKanjiSyncClientError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw DailyKanjiSyncClientError.httpStatus(httpResponse.statusCode)
        }

        return data
    }
}

enum DailyKanjiSyncClientError: LocalizedError, Equatable {
    case invalidDataset
    case invalidResponse
    case httpStatus(Int)

    var errorDescription: String? {
        switch self {
        case .invalidDataset:
            return "Downloaded dataset is not usable."
        case .invalidResponse:
            return "Sync server returned an invalid response."
        case .httpStatus(let statusCode):
            return "Sync server returned HTTP \(statusCode)."
        }
    }
}
