import AVFoundation
import Foundation

final class DailyKanjiAudioPlayer {
    private var player: AVAudioPlayer?

    func play(audioSrc: String?) {
        guard let audioSrc, let url = bundledAudioURL(for: audioSrc) else {
            return
        }

        player = try? AVAudioPlayer(contentsOf: url)
        player?.prepareToPlay()
        player?.play()
    }

    func hasBundledAudio(audioSrc: String?) -> Bool {
        bundledAudioURL(for: audioSrc) != nil
    }

    private func bundledAudioURL(for audioSrc: String?) -> URL? {
        guard let audioSrc else {
            return nil
        }

        let candidate = URL(fileURLWithPath: audioSrc)
        let fileName = candidate.deletingPathExtension().lastPathComponent
        let fileExtension = candidate.pathExtension

        if let url = Bundle.main.url(forResource: fileName, withExtension: fileExtension) {
            return url
        }

        return Bundle.main.url(forResource: candidate.lastPathComponent, withExtension: nil)
    }
}
