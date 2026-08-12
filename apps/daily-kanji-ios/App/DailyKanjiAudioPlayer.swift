import AVFoundation
import Combine
import Foundation

struct DailyKanjiRemoteAudioCache {
    private struct Entry {
        let data: Data
        let accessOrder: UInt64
    }

    let maximumEntryCount: Int
    let maximumByteCount: Int

    private var entries: [URL: Entry] = [:]
    private var nextAccessOrder: UInt64 = 0
    private(set) var byteCount = 0

    init(maximumEntryCount: Int = 8, maximumByteCount: Int = 16 * 1_024 * 1_024) {
        self.maximumEntryCount = max(maximumEntryCount, 0)
        self.maximumByteCount = max(maximumByteCount, 0)
    }

    var count: Int {
        entries.count
    }

    var urlsInLeastRecentlyUsedOrder: [URL] {
        entries.sorted { lhs, rhs in
            if lhs.value.accessOrder != rhs.value.accessOrder {
                return lhs.value.accessOrder < rhs.value.accessOrder
            }
            return lhs.key.absoluteString < rhs.key.absoluteString
        }.map(\.key)
    }

    func contains(_ url: URL) -> Bool {
        entries[url] != nil
    }

    mutating func data(for url: URL) -> Data? {
        guard let entry = entries[url] else {
            return nil
        }

        nextAccessOrder &+= 1
        entries[url] = Entry(data: entry.data, accessOrder: nextAccessOrder)
        return entry.data
    }

    @discardableResult
    mutating func insert(_ data: Data, for url: URL) -> Bool {
        removeData(for: url)
        guard
            maximumEntryCount > 0,
            maximumByteCount > 0,
            !data.isEmpty,
            data.count <= maximumByteCount
        else {
            return false
        }

        nextAccessOrder &+= 1
        entries[url] = Entry(data: data, accessOrder: nextAccessOrder)
        byteCount += data.count
        evictIfNeeded()
        return entries[url] != nil
    }

    mutating func removeData(for url: URL) {
        guard let removedEntry = entries.removeValue(forKey: url) else {
            return
        }

        byteCount -= removedEntry.data.count
    }

    private mutating func evictIfNeeded() {
        while entries.count > maximumEntryCount || byteCount > maximumByteCount {
            guard let oldestURL = urlsInLeastRecentlyUsedOrder.first else {
                return
            }
            removeData(for: oldestURL)
        }
    }
}

typealias DailyKanjiRemoteAudioLoading = @Sendable (URL) async throws -> Data

@MainActor
final class DailyKanjiAudioPlayer: ObservableObject {
    private var player: AVAudioPlayer?
    private var remotePlayer: AVPlayer?
    private var remoteAudioCache: DailyKanjiRemoteAudioCache
    private let remoteAudioLoader: DailyKanjiRemoteAudioLoading
    private var preloadTask: Task<Void, Never>?
    private var preloadURL: URL?
    private var preloadRequestID: UUID?

    init(
        maximumRemoteCacheEntries: Int = 8,
        maximumRemoteCacheBytes: Int = 16 * 1_024 * 1_024,
        remoteAudioLoader: @escaping DailyKanjiRemoteAudioLoading = { url in
            let (data, response) = try await URLSession.shared.data(from: url)
            guard
                let httpResponse = response as? HTTPURLResponse,
                (200..<300).contains(httpResponse.statusCode)
            else {
                throw URLError(.badServerResponse)
            }
            return data
        }
    ) {
        remoteAudioCache = DailyKanjiRemoteAudioCache(
            maximumEntryCount: maximumRemoteCacheEntries,
            maximumByteCount: maximumRemoteCacheBytes
        )
        self.remoteAudioLoader = remoteAudioLoader
    }

    var cachedRemoteAudioCount: Int {
        remoteAudioCache.count
    }

    var cachedRemoteAudioByteCount: Int {
        remoteAudioCache.byteCount
    }

    var cachedRemoteAudioURLsInLeastRecentlyUsedOrder: [URL] {
        remoteAudioCache.urlsInLeastRecentlyUsedOrder
    }

    var activePreloadURL: URL? {
        preloadURL
    }

    func play(card: DailyKanjiCard) {
        guard let url = DailyKanjiAudioResource.url(for: card) else {
            return
        }

        playBundled(url: url)
    }

    func play(mediaSlug: String, audioSrc: String) {
        guard let url = DailyKanjiAudioResource.url(
            mediaSlug: mediaSlug,
            audioSrc: audioSrc
        ) else {
            return
        }

        playBundled(url: url)
    }

    private func playBundled(url: URL) {
        stopPlayback()
        player = try? AVAudioPlayer(contentsOf: url)
        player?.prepareToPlay()
        player?.play()
    }

    func play(url: URL) {
        stopPlayback()

        if let data = remoteAudioCache.data(for: url) {
            if let audioPlayer = try? AVAudioPlayer(data: data) {
                player = audioPlayer
                player?.prepareToPlay()
                player?.play()
                return
            }

            remoteAudioCache.removeData(for: url)
        }

        remotePlayer = AVPlayer(url: url)
        remotePlayer?.play()
        preload(url: url)
    }

    func preload(url: URL?) {
        guard let url else {
            cancelPreload()
            return
        }

        guard preloadURL != url else {
            return
        }

        cancelPreload()
        guard !remoteAudioCache.contains(url) else {
            return
        }

        let requestID = UUID()
        let remoteAudioLoader = remoteAudioLoader
        preloadURL = url
        preloadRequestID = requestID
        preloadTask = Task { @MainActor [weak self] in
            do {
                let data = try await remoteAudioLoader(url)
                guard
                    let self,
                    !Task.isCancelled,
                    self.preloadRequestID == requestID,
                    self.preloadURL == url
                else {
                    return
                }

                self.remoteAudioCache.insert(data, for: url)
                self.clearPreload(requestID: requestID)
            } catch {
                guard
                    let self,
                    self.preloadRequestID == requestID,
                    self.preloadURL == url
                else {
                    return
                }
                self.clearPreload(requestID: requestID)
            }
        }
    }

    func stopPlayback() {
        player?.stop()
        player = nil
        remotePlayer?.pause()
        remotePlayer?.replaceCurrentItem(with: nil)
        remotePlayer = nil
    }

    func suspend() {
        stopPlayback()
        cancelPreload()
    }

    func waitForPendingPreload() async {
        await preloadTask?.value
    }

    func hasBundledAudio(card: DailyKanjiCard) -> Bool {
        DailyKanjiAudioResource.url(for: card) != nil
    }

    func hasBundledAudio(mediaSlug: String, audioSrc: String?) -> Bool {
        guard let audioSrc else {
            return false
        }

        return DailyKanjiAudioResource.url(mediaSlug: mediaSlug, audioSrc: audioSrc) != nil
    }

    private func cancelPreload() {
        preloadRequestID = nil
        preloadURL = nil
        preloadTask?.cancel()
        preloadTask = nil
    }

    private func clearPreload(requestID: UUID) {
        guard preloadRequestID == requestID else {
            return
        }

        preloadRequestID = nil
        preloadURL = nil
        preloadTask = nil
    }
}

enum DailyKanjiAudioResource {
    private static let safeStemMaxLength = 72
    private static let allowedAudioExtensions = Set(["aac", "m4a", "mp3", "wav"])

    static func url(for card: DailyKanjiCard, in bundle: Bundle = .main) -> URL? {
        guard let relativePath = bundleRelativePath(for: card) else {
            return nil
        }

        return url(forRelativePath: relativePath, in: bundle)
    }

    static func url(mediaSlug: String, audioSrc: String, in bundle: Bundle = .main) -> URL? {
        guard let relativePath = bundleRelativePath(mediaSlug: mediaSlug, audioSrc: audioSrc) else {
            return nil
        }

        return url(forRelativePath: relativePath, in: bundle)
    }

    private static func url(forRelativePath relativePath: String, in bundle: Bundle) -> URL? {
        let url = bundle.url(
            forResource: (relativePath as NSString).deletingPathExtension,
            withExtension: (relativePath as NSString).pathExtension
        )

        guard let url, FileManager.default.fileExists(atPath: url.path) else {
            return nil
        }

        return url
    }

    static func bundleRelativePath(for card: DailyKanjiCard) -> String? {
        guard
            let audioSrc = card.entry.audioSrc,
            let relativePath = bundleRelativePath(
                mediaSlug: card.media.slug,
                audioSrc: audioSrc
            )
        else {
            return nil
        }

        return relativePath
    }

    static func bundleRelativePath(mediaSlug: String, audioSrc: String) -> String? {
        guard
            isSafeMediaSlug(mediaSlug),
            isSafeAudioSrc(audioSrc)
        else {
            return nil
        }

        return buildBundleFileName(mediaSlug: mediaSlug, audioSrc: audioSrc)
    }

    private static func isSafeMediaSlug(_ mediaSlug: String) -> Bool {
        mediaSlug.range(
            of: #"^[a-z0-9][a-z0-9-]*$"#,
            options: .regularExpression
        ) != nil
    }

    private static func isSafeAudioSrc(_ audioSrc: String) -> Bool {
        let components = audioSrc.split(separator: "/", omittingEmptySubsequences: false)
        let fileExtension = (audioSrc as NSString).pathExtension.lowercased()

        return !audioSrc.isEmpty
            && !audioSrc.hasPrefix("/")
            && audioSrc.hasPrefix("assets/audio/")
            && !audioSrc.contains("\\")
            && allowedAudioExtensions.contains(fileExtension)
            && !components.contains("..")
            && !components.contains("")
    }

    private static func buildBundleFileName(mediaSlug: String, audioSrc: String) -> String {
        let nsAudioSrc = audioSrc as NSString
        let fileExtension = nsAudioSrc.pathExtension
        let stem = fileExtension.isEmpty
            ? audioSrc
            : String(audioSrc.dropLast(fileExtension.count + 1))
        let safeStem = readableBundleFileNameStem(stem)
        let hash = fnv1a64Hex(audioSrc)

        if fileExtension.isEmpty {
            return "daily-kanji-audio__\(mediaSlug)__\(safeStem)__\(hash)"
        }

        return "daily-kanji-audio__\(mediaSlug)__\(safeStem)__\(hash).\(fileExtension)"
    }

    private static func readableBundleFileNameStem(_ stem: String) -> String {
        let sanitized = stem.unicodeScalars.map { scalar in
            isBundleFileNameScalarAllowed(scalar) ? String(scalar) : "_"
        }.joined()
        let trimmed = String(sanitized.prefix(safeStemMaxLength))
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))

        return trimmed.isEmpty ? "audio" : trimmed
    }

    private static func fnv1a64Hex(_ value: String) -> String {
        var hash: UInt64 = 0xcbf29ce484222325

        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x100000001b3
        }

        return String(format: "%016llx", hash)
    }

    private static func isBundleFileNameScalarAllowed(_ scalar: UnicodeScalar) -> Bool {
        let value = scalar.value

        return (65...90).contains(value)
            || (97...122).contains(value)
            || (48...57).contains(value)
            || value == 45
    }
}
