export type PitchAccentPatternKey =
  | "pitch0"
  | "pitch1"
  | "pitch2"
  | "pitch3"
  | "pitch4";

export type PitchAccentPatternFilter = {
  readonly onlyDevoiced: boolean;
  readonly patternKeys: readonly PitchAccentPatternKey[];
  readonly strictPairFinding: boolean;
};

export type PitchAccentPairOption = {
  readonly accentedMora: number;
  readonly audioAttribution?: string;
  readonly audioLicense?: string;
  readonly audioMime?: string;
  readonly audioPageUrl?: string;
  readonly audioSha256?: string;
  readonly audioSrc: string;
  readonly byteLength?: number;
  readonly homophoneSource?: string;
  readonly id: string;
  readonly moraCount: number;
  readonly pitchAccent: number;
  readonly pitchAccentSource?: string;
  readonly rawPronunciation: string;
  readonly reading?: string;
  readonly silencedMoras: readonly number[];
  readonly sourceCorpus?: string;
  readonly surface?: string;
};

export type PitchAccentPitchGraphExtractor =
  | "autocorrelation-v1"
  | "kotu-api"
  | "onsei-praat"
  | "praat"
  | "pyin"
  | "swift-f0-normalized"
  | "swift-f0-raw"
  | "swift-f0-smoothed"
  | "world-harvest";

export type PitchAccentPitchGraphRenderStrategy =
  | "local-improved"
  | "local-kotu-like"
  | "strict-v1";

export type PitchAccentExpectedAccentOverlay = {
  readonly sampleIntervalMs: number;
  readonly values: readonly (0 | 1 | null)[];
};

export type PitchAccentAudioPitchGraph = {
  readonly durationMs: number;
  readonly expectedAccentOverlay?: PitchAccentExpectedAccentOverlay;
  readonly extractor?: PitchAccentPitchGraphExtractor;
  readonly qualityScore?: number;
  readonly rawValues?: readonly (number | null)[];
  readonly renderStrategy?: PitchAccentPitchGraphRenderStrategy;
  readonly sampleIntervalMs: number;
  readonly values: readonly (number | null)[];
  readonly version?: 2;
};

export type PitchAccentPitchGraphManifest = {
  readonly graphs: Readonly<Record<string, PitchAccentAudioPitchGraph>>;
  readonly version: 1 | 2;
};

export type PitchAccentMinimalPair = {
  readonly hasDevoiced: boolean;
  readonly id: string;
  readonly kana: string;
  readonly optionCount: number;
  readonly options: readonly PitchAccentPairOption[];
  readonly patternKeys: readonly PitchAccentPatternKey[];
};

export type PitchAccentMinimalPairsCorpus = {
  readonly pairs: readonly PitchAccentMinimalPair[];
  readonly source: {
    readonly importedAt: string;
    readonly license: string;
    readonly repository: string;
    readonly revision: string;
  };
  readonly version: 1;
};

export type PitchAccentSessionTrialPlan = {
  readonly correctOptionId: string;
  readonly correctPatternKey: PitchAccentPatternKey;
  readonly kana: string;
  readonly options: readonly PitchAccentPairOption[];
  readonly pairId: string;
  readonly sessionId: string;
  readonly sortOrder: number;
  readonly trialId: string;
};

export type PitchAccentSessionStatus = "active" | "completed" | "abandoned";

export type PitchAccentTrialStatus = "planned" | "answered" | "skipped";
