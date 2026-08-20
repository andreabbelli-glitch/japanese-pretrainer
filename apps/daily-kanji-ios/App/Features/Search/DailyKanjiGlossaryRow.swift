import SwiftUI

struct DailyKanjiGlossaryRow: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let entry: DailyKanjiGlossaryEntry
    @ObservedObject var audioPlayer: DailyKanjiAudioPlayer
    private let presentation = DailyKanjiGlossaryRowPresentation()

    var body: some View {
        Group {
            if presentation.rowLayout(for: dynamicTypeSize) == .stacked {
                VStack(alignment: .leading, spacing: 8) {
                    navigationSummary
                    audioRow
                }
            } else {
                HStack(alignment: .center, spacing: 12) {
                    navigationSummary
                    audioButton
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var navigationSummary: some View {
        NavigationLink {
            DailyKanjiGlossaryDetailView(entry: entry, audioPlayer: audioPlayer)
        } label: {
            summary
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel(entry.rowAccessibilityLabel)
        .accessibilityHint(entry.rowAccessibilityHint)
    }

    @ViewBuilder
    private var audioRow: some View {
        if entry.primaryAudioMedia != nil {
            HStack {
                Spacer()
                audioButton
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    @ViewBuilder
    private var audioButton: some View {
        if let audio = entry.primaryAudioMedia {
            Button {
                audioPlayer.play(mediaSlug: audio.mediaSlug, audioSrc: audio.audioSrc ?? "")
            } label: {
                Label("Riproduci audio di \(entry.label)", systemImage: "speaker.wave.2.fill")
                    .labelStyle(.iconOnly)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.circle)
            .disabled(!audioPlayer.hasBundledAudio(mediaSlug: audio.mediaSlug, audioSrc: audio.audioSrc))
            .accessibilityLabel("Riproduci audio di \(entry.label)")
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 4) {
            titleLine

            if let readingLine = entry.readingLine {
                Text(readingLine)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(entry.rowSummary)
                .font(.subheadline)
                .lineLimit(2)
        }
    }

    @ViewBuilder
    private var titleLine: some View {
        if dynamicTypeSize.isAccessibilitySize {
            verticalTitleLine
        } else {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    entryLabel
                        .fixedSize(horizontal: true, vertical: false)
                    kindLabel
                        .fixedSize(horizontal: true, vertical: false)
                }

                verticalTitleLine
            }
        }
    }

    private var verticalTitleLine: some View {
        VStack(alignment: .leading, spacing: 2) {
            entryLabel
            kindLabel
        }
    }

    private var entryLabel: some View {
        Text(entry.label)
            .font(.headline)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var kindLabel: some View {
        Text(entry.kind.glossaryLabel)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
    }
}
