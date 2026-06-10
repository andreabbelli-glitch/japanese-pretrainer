import Foundation

enum DailyKanjiDeepLink {
    static let scheme = "dailykanji"
    private static let cardHost = "card"

    static func cardURL(cardId: String) -> URL {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/")
        let encodedCardId = cardId.addingPercentEncoding(withAllowedCharacters: allowed) ?? cardId
        return URL(string: "\(scheme)://\(cardHost)/\(encodedCardId)")!
    }

    static func cardId(from url: URL) -> String? {
        guard url.scheme == scheme, url.host == cardHost else {
            return nil
        }

        let rawPath = String(url.path.dropFirst())
        guard !rawPath.isEmpty else {
            return nil
        }

        return rawPath.removingPercentEncoding
    }
}
