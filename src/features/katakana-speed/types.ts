export type KatakanaSpeedItemKind =
  | "extended_chunk"
  | "single_kana"
  | "core_mora"
  | "word"
  | "pseudoword"
  | "sentence";

export type KatakanaSpeedTier = "A" | "B" | "C" | "visual" | "mora";

export type KatakanaSpeedRarity = "core" | "edge" | "rare";

export type KatakanaSpeedConfusionKind = "phonological" | "visual";

export type KatakanaSpeedTrialMode =
  | "minimal_pair"
  | "blink"
  | "word_naming"
  | "pseudoword_sprint"
  | "sentence_sprint"
  | "ran_grid";

export type KatakanaSpeedSessionMode = "daily" | "diagnostic_probe" | "repair";

export type KatakanaSpeedManualExercise =
  | "contrast"
  | "mora_contrast"
  | "ran_grid"
  | "reading"
  | "romaji_to_katakana";

export type KatakanaSpeedSelfRating = "clean" | "hesitated" | "wrong";

export type KatakanaSpeedErrorTag =
  | "slow_correct"
  | "small_kana_ignored"
  | "long_vowel_missed"
  | "sokuon_missed"
  | "visual_confusion"
  | "phonological_confusion"
  | "unclassified_error";

export type KatakanaSpeedItem = {
  readonly confusionClusterIds: readonly string[];
  readonly distractorItemIds: readonly string[];
  readonly displaySegments: readonly string[];
  readonly family: string;
  readonly focusChunks: readonly string[];
  readonly id: string;
  readonly isPseudo?: boolean;
  readonly kind: KatakanaSpeedItemKind;
  readonly meaningIt?: string;
  readonly moraCount: number;
  readonly rarity: KatakanaSpeedRarity;
  readonly reading: string;
  readonly sentenceId?: string;
  readonly surface: string;
  readonly tags: readonly string[];
  readonly targetRtMs: number;
  readonly tier: KatakanaSpeedTier;
};

export type KatakanaSpeedConfusionCluster = {
  readonly id: string;
  readonly itemIds: readonly string[];
  readonly kind: KatakanaSpeedConfusionKind;
};

export type KatakanaSpeedItemStatus = "new" | "learning" | "review";

export type KatakanaSpeedItemState = {
  readonly correctStreak: number;
  readonly itemId: string;
  readonly lapses: number;
  readonly lastAttemptAt: string | null;
  readonly lastCorrectAt: string | null;
  readonly lastErrorTags: readonly KatakanaSpeedErrorTag[];
  readonly lastResponseMs: number | null;
  readonly reps: number;
  readonly slowStreak: number;
  readonly status: KatakanaSpeedItemStatus;
};

export type KatakanaSpeedState = {
  readonly createdAt: string;
  readonly items: Readonly<Record<string, KatakanaSpeedItemState>>;
  readonly schedulerVersion: "katakana_speed_mvp_v1";
  readonly updatedAt: string;
};

export type KatakanaSpeedTrialPlan = {
  readonly blockId?: string;
  readonly confusionClusterId?: string;
  readonly correctItemId: string;
  readonly exerciseId?: string;
  readonly exposureMs?: number;
  readonly expectedSurface?: string;
  readonly features?: Readonly<Record<string, unknown>>;
  readonly focusChunks?: readonly string[];
  readonly itemId: string;
  readonly itemType?: KatakanaSpeedItemKind | string;
  readonly metadataRole?:
    | "confusion_repair"
    | "word_transfer"
    | "pseudoword_transfer"
    | "ran_grid"
    | "diagnostic_probe"
    | "repair_block";
  readonly metrics?: Readonly<Record<string, unknown>>;
  readonly mode: KatakanaSpeedTrialMode;
  readonly optionItemIds: readonly string[];
  readonly promptSurface: string;
  readonly rarity?: KatakanaSpeedRarity;
  readonly selfRating?: KatakanaSpeedSelfRating;
  readonly sortOrder?: number;
  readonly targetRtMs: number;
  readonly trialId: string;
  readonly wasPseudo?: boolean;
  readonly wasRepair?: boolean;
  readonly wasTransfer?: boolean;
};
