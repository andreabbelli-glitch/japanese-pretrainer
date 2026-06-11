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
        var request = URLRequest(url: endpointURL)
        request.httpMethod = "GET"
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DailyKanjiSyncClientError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw DailyKanjiSyncClientError.httpStatus(httpResponse.statusCode)
        }

        let dataset = try DailyKanjiDataset.decode(jsonData: data)
        guard dataset.version == 1, !dataset.cards.isEmpty else {
            throw DailyKanjiSyncClientError.invalidDataset
        }

        return dataset
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
