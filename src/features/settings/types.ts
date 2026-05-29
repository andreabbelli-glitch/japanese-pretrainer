export type FuriganaMode = "on" | "off" | "hover";
export type GlossaryDefaultSort = "lesson_order" | "alphabetical";
export type KanjiClashDefaultScope = "global" | "media";

export type StudySettings = {
  furiganaMode: FuriganaMode;
  glossaryDefaultSort: GlossaryDefaultSort;
  kanjiClashDailyNewLimit: number;
  kanjiClashDefaultScope: KanjiClashDefaultScope;
  kanjiClashManualDefaultSize: number;
  reviewAutoplayAudioOnReveal: boolean;
  reviewFrontFurigana: boolean;
  reviewDailyLimit: number;
};

export type StudySettingsInput = Partial<StudySettings>;

export const kanjiClashManualDefaultSizeOptions = [10, 20, 40] as const;
