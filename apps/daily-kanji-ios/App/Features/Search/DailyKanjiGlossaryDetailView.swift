import SwiftUI

struct DailyKanjiGlossaryDetailView: View {
    let entry: DailyKanjiGlossaryEntry
    @ObservedObject var audioPlayer: DailyKanjiAudioPlayer

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(entry.kind.glossaryLabel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)

                    Text(entry.label)
                        .font(.largeTitle.weight(.semibold))
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)

                    if let title = entry.title, !title.isEmpty {
                        Text(title)
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }

            Section("Significato") {
                Text(entry.meaning)

                if let title = entry.title, !title.isEmpty {
                    LabeledContent("Titolo", value: title)
                }

                if !entry.aliases.isEmpty {
                    LabeledContent("Alias") {
                        Text(entry.aliases.map(\.displayText).joined(separator: ", "))
                            .multilineTextAlignment(.trailing)
                    }
                }
            }

            Section("Pronuncia") {
                if let readingLine = entry.readingLine {
                    LabeledContent("Lettura", value: readingLine)
                } else {
                    Text("Lettura non disponibile")
                        .foregroundStyle(.secondary)
                }

                if let pitchAccentText = entry.pitchAccentText {
                    LabeledContent("Accento", value: pitchAccentText)
                }

                if let pattern = entry.pitchAccentPattern {
                    DailyKanjiGlossaryPitchAccentView(pattern: pattern)
                }

                if let source = entry.pitchAccentSourceText {
                    LabeledContent("Fonte accento", value: source)
                }

                if let audio = entry.primaryAudioMedia {
                    Button {
                        audioPlayer.play(mediaSlug: audio.mediaSlug, audioSrc: audio.audioSrc ?? "")
                    } label: {
                        Label("Riproduci audio", systemImage: "speaker.wave.2.fill")
                            .frame(minHeight: 44)
                    }
                    .disabled(
                        !audioPlayer.hasBundledAudio(
                            mediaSlug: audio.mediaSlug,
                            audioSrc: audio.audioSrc
                        )
                    )
                }
            }

            Section("Esempio e note") {
                if let notes = entry.notes, !notes.isEmpty {
                    Text(notes)
                } else {
                    Text("Nessun esempio o nota disponibile.")
                        .foregroundStyle(.secondary)
                }
            }

            Section("Fonti") {
                if entry.media.isEmpty {
                    Text("Nessuna fonte disponibile.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(entry.media, id: \.stableId) { media in
                        sourceRow(media)
                    }
                }
            }
        }
        .navigationTitle(entry.label)
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            audioPlayer.suspend()
        }
    }

    @ViewBuilder
    private func sourceRow(_ media: DailyKanjiGlossaryEntry.MediaRef) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(media.displayText)

            if media.audioSrc != nil {
                Button {
                    audioPlayer.play(mediaSlug: media.mediaSlug, audioSrc: media.audioSrc ?? "")
                } label: {
                    Label("Riproduci audio da \(media.displayText)", systemImage: "speaker.wave.2.fill")
                        .frame(minHeight: 44)
                }
                .disabled(
                    !audioPlayer.hasBundledAudio(
                        mediaSlug: media.mediaSlug,
                        audioSrc: media.audioSrc
                    )
                )
            }
        }
        .padding(.vertical, 2)
    }
}

private struct DailyKanjiGlossaryPitchAccentView: View {
    let pattern: DailyKanjiPitchAccentPattern

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(pattern.moras) { mora in
                VStack(spacing: 4) {
                    Circle()
                        .fill(mora.isHigh ? Color.accentColor : Color.secondary)
                        .frame(width: 7, height: 7)
                        .offset(y: mora.isHigh ? -9 : 0)

                    Text(mora.text)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .frame(minWidth: 20)
            }
        }
        .padding(.vertical, 8)
        .accessibilityLabel("Schema di accento tonale")
    }
}
