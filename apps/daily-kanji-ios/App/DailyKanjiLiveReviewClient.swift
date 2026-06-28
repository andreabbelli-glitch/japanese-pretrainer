import Foundation
import UIKit
import UserNotifications

enum DailyKanjiLiveReviewRating: String, Codable, CaseIterable, Equatable {
    case again
    case hard
    case good
    case easy
}

struct DailyKanjiLiveReviewQueue: Codable, Equatable {
    let dueCount: Int
    let queueCount: Int
    let nextDueAt: String?
}

struct DailyKanjiLiveReviewCard: Codable, Equatable, Identifiable {
    struct Entry: Codable, Equatable, Identifiable {
        let id: String
        let kind: String?
        let label: String?
        let meaning: String?
        let reading: String?
    }

    struct Pronunciation: Codable, Equatable {
        let audioSrc: String?
        let label: String?
        let reading: String?
        let source: String?
    }

    var id: String { cardId }

    let cardId: String
    let front: String
    let back: String
    let mediaSlug: String
    let mediaTitle: String
    let reviewStateUpdatedAt: String?
    let entries: [Entry]?
    let pronunciations: [Pronunciation]?
    let exampleJp: String?
    let exampleIt: String?
    let notes: String?
}

struct DailyKanjiLiveReviewSession: Codable, Equatable {
    let source: String
    let queue: DailyKanjiLiveReviewQueue
    let selectedCard: DailyKanjiLiveReviewCard?

    var isLive: Bool {
        source == "live"
    }
}

struct DailyKanjiLiveReviewGradeResult: Codable, Equatable {
    struct Grade: Codable, Equatable {
        let cardId: String
        let rating: DailyKanjiLiveReviewRating
    }

    let grade: Grade
    let session: DailyKanjiLiveReviewSession
}

enum DailyKanjiLiveReviewState: Equatable {
    case unavailable
    case loading(staleSession: DailyKanjiLiveReviewSession?)
    case ready(session: DailyKanjiLiveReviewSession)
    case failed(message: String, staleSession: DailyKanjiLiveReviewSession?)

    var session: DailyKanjiLiveReviewSession? {
        switch self {
        case .unavailable:
            return nil
        case .loading(let staleSession):
            return staleSession
        case .ready(let session):
            return session
        case .failed(_, let staleSession):
            return staleSession
        }
    }

    var canGrade: Bool {
        if case .ready(let session) = self {
            return session.isLive && session.selectedCard != nil
        }

        return false
    }
}

protocol DailyKanjiLiveReviewing {
    func fetchSession() async throws -> DailyKanjiLiveReviewSession
    func grade(
        cardId: String,
        rating: DailyKanjiLiveReviewRating,
        expectedUpdatedAt: String?,
        responseMs: Int?
    ) async throws -> DailyKanjiLiveReviewGradeResult
    func registerDeviceToken(_ deviceToken: String) async throws
}

struct DailyKanjiLiveReviewClient: DailyKanjiLiveReviewing {
    private struct SessionResponse: Decodable {
        let ok: Bool
        let source: String
        let queue: DailyKanjiLiveReviewQueue
        let selectedCard: DailyKanjiLiveReviewCard?
    }

    private struct GradeRequest: Encodable {
        let cardId: String
        let rating: DailyKanjiLiveReviewRating
        let expectedUpdatedAt: String?
        let responseMs: Int?

        enum CodingKeys: String, CodingKey {
            case cardId
            case expectedUpdatedAt
            case rating
            case responseMs
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)

            try container.encode(cardId, forKey: .cardId)
            try container.encode(rating, forKey: .rating)
            try container.encode(responseMs, forKey: .responseMs)

            if let expectedUpdatedAt {
                try container.encode(expectedUpdatedAt, forKey: .expectedUpdatedAt)
            } else {
                try container.encodeNil(forKey: .expectedUpdatedAt)
            }
        }
    }

    private struct GradeResponse: Decodable {
        let ok: Bool
        let grade: DailyKanjiLiveReviewGradeResult.Grade
        let session: DailyKanjiLiveReviewSession
    }

    private struct DeviceTokenRequest: Encodable {
        let deviceToken: String
    }

    private struct OkResponse: Decodable {
        let ok: Bool
    }

    private let baseURL: URL
    private let bearerToken: String
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init?(
        configuration: DailyKanjiMobileReviewConfiguration = .load(),
        session: URLSession = .shared
    ) {
        guard
            let endpointURL = configuration.endpointURL,
            let bearerToken = configuration.bearerToken,
            !bearerToken.isEmpty
        else {
            return nil
        }

        self.baseURL = endpointURL
        self.bearerToken = bearerToken
        self.session = session
    }

    init(baseURL: URL, bearerToken: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.bearerToken = bearerToken
        self.session = session
    }

    func fetchSession() async throws -> DailyKanjiLiveReviewSession {
        let response: SessionResponse = try await send(
            path: "/api/mobile/review/session",
            method: "GET"
        )
        guard response.ok else {
            throw DailyKanjiLiveReviewClientError.notOk
        }

        return DailyKanjiLiveReviewSession(
            source: response.source,
            queue: response.queue,
            selectedCard: response.selectedCard
        )
    }

    func grade(
        cardId: String,
        rating: DailyKanjiLiveReviewRating,
        expectedUpdatedAt: String?,
        responseMs: Int?
    ) async throws -> DailyKanjiLiveReviewGradeResult {
        let response: GradeResponse = try await send(
            path: "/api/mobile/review/grade",
            method: "POST",
            body: GradeRequest(
                cardId: cardId,
                rating: rating,
                expectedUpdatedAt: expectedUpdatedAt,
                responseMs: responseMs
            )
        )
        guard response.ok else {
            throw DailyKanjiLiveReviewClientError.notOk
        }

        return DailyKanjiLiveReviewGradeResult(
            grade: response.grade,
            session: response.session
        )
    }

    func registerDeviceToken(_ deviceToken: String) async throws {
        let response: OkResponse = try await send(
            path: "/api/mobile/review/device-token",
            method: "POST",
            body: DeviceTokenRequest(deviceToken: deviceToken)
        )
        guard response.ok else {
            throw DailyKanjiLiveReviewClientError.notOk
        }
    }

    private func send<Response: Decodable>(
        path: String,
        method: String
    ) async throws -> Response {
        try await send(path: path, method: method, bodyData: nil)
    }

    private func send<Request: Encodable, Response: Decodable>(
        path: String,
        method: String,
        body: Request
    ) async throws -> Response {
        try await send(
            path: path,
            method: method,
            bodyData: try encoder.encode(body)
        )
    }

    private func send<Response: Decodable>(
        path: String,
        method: String,
        bodyData: Data?
    ) async throws -> Response {
        var request = URLRequest(url: endpointURL(path: path))
        request.httpMethod = method
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let bodyData {
            request.httpBody = bodyData
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DailyKanjiLiveReviewClientError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw DailyKanjiLiveReviewClientError.httpStatus(httpResponse.statusCode)
        }

        return try decoder.decode(Response.self, from: data)
    }

    private func endpointURL(path: String) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        components?.path = "/" + path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components?.query = nil
        components?.fragment = nil
        return components?.url ?? baseURL
    }
}

struct DailyKanjiMobileReviewConfiguration: Equatable {
    let endpointURL: URL?
    let bearerToken: String?

    static func load(bundle: Bundle = .main) -> DailyKanjiMobileReviewConfiguration {
        let endpoint = normalizedPlistString(
            bundle.object(forInfoDictionaryKey: "MOBILE_API_ENDPOINT")
        ).flatMap(URL.init(string:))
        let token = normalizedPlistString(
            bundle.object(forInfoDictionaryKey: "MOBILE_API_TOKEN")
        )

        return DailyKanjiMobileReviewConfiguration(
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

enum DailyKanjiLiveReviewClientError: LocalizedError, Equatable {
    case invalidResponse
    case httpStatus(Int)
    case notOk

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Review server returned an invalid response."
        case .httpStatus(let statusCode):
            return "Review server returned HTTP \(statusCode)."
        case .notOk:
            return "Review server rejected the request."
        }
    }
}

protocol DailyKanjiNotificationRegistering {
    func requestAuthorizationAndRegister() async
}

struct DailyKanjiPushNotificationRegistrar: DailyKanjiNotificationRegistering {
    func requestAuthorizationAndRegister() async {
        do {
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            guard granted else {
                return
            }

            await MainActor.run {
                UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            return
        }
    }
}

@MainActor
final class DailyKanjiPushTokenDispatcher {
    static let shared = DailyKanjiPushTokenDispatcher()

    var onDeviceToken: ((String) -> Void)?

    private init() {}

    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        onDeviceToken?(token)
    }
}

final class DailyKanjiAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            DailyKanjiPushTokenDispatcher.shared.didRegister(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {}
}
