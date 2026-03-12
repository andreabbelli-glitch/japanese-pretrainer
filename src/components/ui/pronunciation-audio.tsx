import type { PronunciationData } from "@/lib/pronunciation";

type PronunciationAudioProps = {
  audio: PronunciationData;
  compact?: boolean;
  title?: string;
};

export function PronunciationAudio({
  audio,
  compact = false,
  title = "Pronuncia"
}: PronunciationAudioProps) {
  return (
    <section
      className={`pronunciation-audio${compact ? " pronunciation-audio--compact" : ""}`}
    >
      {!compact ? (
        <div className="pronunciation-audio__header">
          <span className="eyebrow">{title}</span>
          {audio.label ? (
            <span className="pronunciation-audio__label">{audio.label}</span>
          ) : null}
        </div>
      ) : null}
      <audio className="pronunciation-audio__player" controls preload="none">
        <source src={audio.src} />
      </audio>
      {!compact && (audio.attribution || audio.license || audio.pageUrl) ? (
        <p className="pronunciation-audio__meta">
          {audio.attribution ? <span>{audio.attribution}</span> : null}
          {audio.license ? <span>{audio.license}</span> : null}
          {audio.pageUrl ? (
            <a
              href={audio.pageUrl}
              rel="noreferrer"
              target="_blank"
            >
              Fonte
            </a>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
