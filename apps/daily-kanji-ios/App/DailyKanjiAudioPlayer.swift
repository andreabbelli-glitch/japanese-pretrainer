import AVFoundation
import Foundation

final class DailyKanjiAudioPlayer {
    private var player: AVAudioPlayer?

    func play(card: DailyKanjiCard) {
        guard let url = DailyKanjiAudioResource.url(for: card) else {
            return
        }

        player = try? AVAudioPlayer(contentsOf: url)
        player?.prepareToPlay()
        player?.play()
    }

    func hasBundledAudio(card: DailyKanjiCard) -> Bool {
        DailyKanjiAudioResource.url(for: card) != nil
    }
}

enum DailyKanjiAudioResource {
    private static let safeStemMaxLength = 72
    private static let allowedAudioExtensions = Set(["aac", "m4a", "mp3", "wav"])

    static func url(for card: DailyKanjiCard, in bundle: Bundle = .main) -> URL? {
        guard let relativePath = bundleRelativePath(for: card) else {
            return nil
        }

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
            isSafeMediaSlug(card.media.slug),
            isSafeAudioSrc(audioSrc)
        else {
            return nil
        }

        return buildBundleFileName(mediaSlug: card.media.slug, audioSrc: audioSrc)
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
